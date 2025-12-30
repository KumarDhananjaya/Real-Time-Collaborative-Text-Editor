import { Server as SocketServer } from 'socket.io';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { documentManager } from '../crdt/DocumentManager';
import { AuthenticatedSocket } from './middleware';
import { DocumentModel } from '../models/Document';

/** Message types */
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

/** Track which rooms each socket is in */
const socketRooms = new Map<string, Set<string>>();

/**
 * Get room name for a document
 */
function getDocRoom(docId: string): string {
    return `doc:${docId}`;
}

/**
 * Setup socket event handlers
 */
export function setupSocketHandlers(io: SocketServer): void {
    io.on('connection', (rawSocket) => {
        const socket = rawSocket as AuthenticatedSocket;
        console.log(`🔌 Socket connected: ${socket.id} (${socket.userName})`);
        socketRooms.set(socket.id, new Set());

        /**
         * Join a document room and sync initial state
         */
        socket.on('join-document', async (docId: string, callback) => {
            try {
                const room = getDocRoom(docId);

                // Leave any previous document room
                const currentRooms = socketRooms.get(socket.id);
                if (currentRooms) {
                    for (const prevRoom of currentRooms) {
                        if (prevRoom.startsWith('doc:')) {
                            await leaveDocumentRoom(socket, prevRoom.replace('doc:', ''));
                        }
                    }
                }

                // Join the new room
                await socket.join(room);
                currentRooms?.add(room);

                // Get or create the document
                const doc = await documentManager.getOrCreateDoc(docId, socket.userId);

                // Ensure document exists in DB
                await DocumentModel.findByIdAndUpdate(
                    docId,
                    {
                        $setOnInsert: {
                            _id: docId,
                            title: 'Untitled Document',
                            createdBy: socket.userId,
                            snapshot: Buffer.from(Y.encodeStateAsUpdate(doc)),
                        },
                        $addToSet: { collaborators: socket.userId },
                    },
                    { upsert: true }
                );

                // Send initial sync state
                const syncEncoder = encoding.createEncoder();
                encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
                syncProtocol.writeSyncStep1(syncEncoder, doc);
                const syncMessage = encoding.toUint8Array(syncEncoder);

                // Get current awareness state
                const awareness = documentManager.getAwareness(docId);
                let awarenessMessage: any = new Uint8Array();
                if (awareness) {
                    // Add this user to awareness
                    awareness.setLocalStateField('user', {
                        id: socket.userId,
                        name: socket.userName,
                        color: socket.userColor,
                    });

                    awarenessMessage = awarenessProtocol.encodeAwarenessUpdate(
                        awareness,
                        Array.from(awareness.getStates().keys())
                    ) as unknown as Uint8Array;
                }

                // Notify other users
                socket.to(room).emit('user-joined', {
                    id: socket.userId,
                    name: socket.userName,
                    color: socket.userColor,
                });

                console.log(`📄 ${socket.userName} joined document ${docId}`);

                // Return initial state via callback
                if (typeof callback === 'function') {
                    callback({
                        sync: Array.from(syncMessage),
                        awareness: Array.from(awarenessMessage),
                    });
                }
            } catch (error) {
                console.error('Error joining document:', error);
                socket.emit('error', 'Failed to join document');
            }
        });

        /**
         * Handle sync messages (updates from client)
         */
        socket.on('sync-update', async (docId: string, message: number[]) => {
            try {
                const update = new Uint8Array(message);
                const decoder = decoding.createDecoder(update);
                const messageType = decoding.readVarUint(decoder);

                const doc = await documentManager.getOrCreateDoc(docId);
                const room = getDocRoom(docId);

                if (messageType === MESSAGE_SYNC) {
                    const syncMessageType = syncProtocol.readSyncMessage(
                        decoder,
                        encoding.createEncoder(),
                        doc,
                        socket.id
                    );

                    // If this was a sync step 1, send step 2
                    if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
                        const encoder = encoding.createEncoder();
                        encoding.writeVarUint(encoder, MESSAGE_SYNC);
                        syncProtocol.writeSyncStep2(encoder, doc, decoding.readVarUint8Array(decoder));
                        socket.emit('sync-update', Array.from(encoding.toUint8Array(encoder)));
                    }

                    // Broadcast update to other clients in the room
                    if (syncMessageType === syncProtocol.messageYjsUpdate) {
                        socket.to(room).emit('sync-update', message);
                    }
                }
            } catch (error) {
                console.error('Error processing sync update:', error);
            }
        });

        /**
         * Handle raw Yjs update (simpler alternative)
         */
        socket.on('yjs-update', async (docId: string, update: number[]) => {
            try {
                const updateArray = new Uint8Array(update);

                // Apply update to server document
                documentManager.applyUpdate(docId, updateArray);

                // Broadcast to other clients
                const room = getDocRoom(docId);
                socket.to(room).emit('yjs-update', update);
            } catch (error) {
                console.error('Error processing Yjs update:', error);
            }
        });

        /**
         * Handle awareness updates (cursor, selection)
         */
        socket.on('awareness-update', async (docId: string, message: number[]) => {
            try {
                const awareness = documentManager.getAwareness(docId);
                if (awareness) {
                    const update = new Uint8Array(message);
                    awarenessProtocol.applyAwarenessUpdate(awareness, update, socket.id);

                    // Broadcast to other clients
                    const room = getDocRoom(docId);
                    socket.to(room).emit('awareness-update', message);
                }
            } catch (error) {
                console.error('Error processing awareness update:', error);
            }
        });

        /**
         * Leave a document
         */
        socket.on('leave-document', async (docId: string) => {
            await leaveDocumentRoom(socket, docId);
        });

        /**
         * Handle disconnection
         */
        socket.on('disconnect', async (reason) => {
            console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);

            // Leave all document rooms
            const rooms = socketRooms.get(socket.id);
            if (rooms) {
                for (const room of rooms) {
                    if (room.startsWith('doc:')) {
                        await leaveDocumentRoom(socket, room.replace('doc:', ''));
                    }
                }
            }

            socketRooms.delete(socket.id);
        });
    });
}

/**
 * Leave a document room and cleanup
 */
async function leaveDocumentRoom(
    socket: AuthenticatedSocket,
    docId: string
): Promise<void> {
    const room = getDocRoom(docId);

    // Remove from awareness
    const awareness = documentManager.getAwareness(docId);
    if (awareness) {
        // Remove local awareness state
        awarenessProtocol.removeAwarenessStates(
            awareness,
            [awareness.clientID],
            'leave'
        );
    }

    // Notify other users
    socket.to(room).emit('user-left', socket.userId);

    // Leave the socket room
    await socket.leave(room);

    const rooms = socketRooms.get(socket.id);
    rooms?.delete(room);

    console.log(`👋 ${socket.userName} left document ${docId}`);
}

/**
 * Get connected client count for a document
 */
export async function getDocumentClientCount(
    io: SocketServer,
    docId: string
): Promise<number> {
    const room = getDocRoom(docId);
    const sockets = await io.in(room).fetchSockets();
    return sockets.length;
}
