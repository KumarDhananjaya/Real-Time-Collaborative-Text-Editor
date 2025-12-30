import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { DocumentModel } from '../models/Document';
import { redisClient, redisPub, redisSub } from '../config/redis';
import { config } from '../config';

/** Message types for sync protocol */
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

/**
 * Manages Yjs documents with persistence and cross-server sync
 */
export class DocumentManager {
    /** In-memory hot state for active documents */
    private docs: Map<string, Y.Doc> = new Map();

    /** Awareness instances per document */
    private awareness: Map<string, awarenessProtocol.Awareness> = new Map();

    /** Pending persistence timers */
    private persistenceTimers: Map<string, NodeJS.Timeout> = new Map();

    /** Server instance ID for message dedup */
    private serverId: string;

    constructor() {
        this.serverId = `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.setupRedisSub();
    }

    /**
     * Setup Redis subscriber for cross-server sync
     */
    private setupRedisSub(): void {
        redisSub.on('messageBuffer', async (channel, message) => {
            const channelStr = channel.toString();
            if (channelStr.startsWith('doc:')) {
                const [, docId, type] = channelStr.split(':');
                await this.handleRedisMessage(docId, type, message);
            }
        });
    }

    /**
     * Handle incoming Redis Pub/Sub message
     */
    private async handleRedisMessage(
        docId: string,
        type: string,
        message: Buffer
    ): Promise<void> {
        // Parse message header
        const decoder = decoding.createDecoder(new Uint8Array(message));
        const senderId = decoding.readVarString(decoder);

        // Skip our own messages
        if (senderId === this.serverId) return;

        const doc = this.docs.get(docId);
        if (!doc) return;

        const data = decoding.readVarUint8Array(decoder);

        if (type === 'sync') {
            // Apply sync update from another server
            Y.applyUpdate(doc, data, 'redis');
        } else if (type === 'awareness') {
            // Apply awareness update
            const awareness = this.awareness.get(docId);
            if (awareness) {
                awarenessProtocol.applyAwarenessUpdate(awareness, data, 'redis');
            }
        }
    }

    /**
     * Get or create a Yjs document
     */
    async getOrCreateDoc(docId: string, userId?: string): Promise<Y.Doc> {
        let doc = this.docs.get(docId);

        if (!doc) {
            doc = new Y.Doc();
            this.docs.set(docId, doc);

            // Create awareness instance
            const awareness = new awarenessProtocol.Awareness(doc);
            this.awareness.set(docId, awareness);

            // Load from Redis cache first, then DB
            await this.loadDocument(docId, doc);

            // Subscribe to Redis channel for this document
            await redisSub.subscribe(`doc:${docId}:sync`, `doc:${docId}:awareness`);

            // Setup update listener for persistence and cross-server sync
            doc.on('update', (update: Uint8Array, origin: string) => {
                this.handleDocUpdate(docId, update, origin);
            });

            // Setup awareness listener
            awareness.on('update', ({ added, updated, removed }: any, origin: string) => {
                if (origin !== 'redis') {
                    const changedClients = [...added, ...updated, ...removed];
                    const encodedAwareness = awarenessProtocol.encodeAwarenessUpdate(
                        awareness,
                        changedClients
                    );
                    this.publishAwareness(docId, encodedAwareness);
                }
            });
        }

        return doc;
    }

    /**
     * Load document from Redis cache or MongoDB
     */
    private async loadDocument(docId: string, doc: Y.Doc): Promise<void> {
        // Try Redis cache first (hot state)
        const cachedState = await redisClient.getBuffer(`doc:${docId}:state`);

        if (cachedState) {
            Y.applyUpdate(doc, new Uint8Array(cachedState), 'cache');
            console.log(`📄 Loaded document ${docId} from Redis cache`);
            return;
        }

        // Fall back to MongoDB
        const dbDoc = await DocumentModel.findById(docId);

        if (dbDoc && dbDoc.snapshot) {
            Y.applyUpdate(doc, new Uint8Array(dbDoc.snapshot), 'db');

            // Warm up Redis cache
            await this.cacheDocument(docId, doc);
            console.log(`📄 Loaded document ${docId} from MongoDB`);
        } else {
            console.log(`📄 Created new document ${docId}`);
        }
    }

    /**
     * Handle document updates
     */
    private handleDocUpdate(
        docId: string,
        update: Uint8Array,
        origin: string
    ): void {
        // Don't re-publish updates from Redis
        if (origin === 'redis' || origin === 'cache' || origin === 'db') {
            return;
        }

        // Publish to other servers via Redis
        this.publishUpdate(docId, update);

        // Update Redis cache
        this.cacheDocument(docId, this.docs.get(docId)!);

        // Schedule persistence to MongoDB
        this.schedulePersistence(docId);
    }

    /**
     * Publish update to Redis for cross-server sync
     */
    private publishUpdate(docId: string, update: Uint8Array): void {
        const encoder = encoding.createEncoder();
        encoding.writeVarString(encoder, this.serverId);
        encoding.writeVarUint8Array(encoder, update);

        redisPub.publish(
            `doc:${docId}:sync`,
            Buffer.from(encoding.toUint8Array(encoder))
        );
    }

    /**
     * Publish awareness update to Redis
     */
    private publishAwareness(docId: string, awareness: Uint8Array): void {
        const encoder = encoding.createEncoder();
        encoding.writeVarString(encoder, this.serverId);
        encoding.writeVarUint8Array(encoder, awareness);

        redisPub.publish(
            `doc:${docId}:awareness`,
            Buffer.from(encoding.toUint8Array(encoder))
        );
    }

    /**
     * Cache document state in Redis
     */
    private async cacheDocument(docId: string, doc: Y.Doc): Promise<void> {
        const state = Y.encodeStateAsUpdate(doc);
        // Cache for 1 hour
        await redisClient.set(`doc:${docId}:state`, Buffer.from(state), 'EX', 3600);
    }

    /**
     * Schedule document persistence to MongoDB
     */
    private schedulePersistence(docId: string): void {
        // Clear existing timer
        const existingTimer = this.persistenceTimers.get(docId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Schedule new persistence
        const timer = setTimeout(
            () => this.persistDocument(docId),
            config.snapshotInterval
        );
        this.persistenceTimers.set(docId, timer);
    }

    /**
     * Persist document to MongoDB
     */
    async persistDocument(docId: string): Promise<void> {
        const doc = this.docs.get(docId);
        if (!doc) return;

        const state = Y.encodeStateAsUpdate(doc);
        const text = doc.getText('content').toString();

        await DocumentModel.findByIdAndUpdate(
            docId,
            {
                snapshot: Buffer.from(state),
                content: text,
                $inc: { version: 1 },
            },
            { upsert: true }
        );

        console.log(`💾 Persisted document ${docId} to MongoDB`);
    }

    /**
     * Get awareness instance for a document
     */
    getAwareness(docId: string): awarenessProtocol.Awareness | undefined {
        return this.awareness.get(docId);
    }

    /**
     * Apply a sync update from a client
     */
    applyUpdate(docId: string, update: Uint8Array): void {
        const doc = this.docs.get(docId);
        if (doc) {
            Y.applyUpdate(doc, update, 'client');
        }
    }

    /**
     * Get full state vector for initial sync
     */
    encodeState(docId: string): Uint8Array {
        const doc = this.docs.get(docId);
        if (!doc) return new Uint8Array();
        return Y.encodeStateAsUpdate(doc);
    }

    /**
     * Encode sync step 1 message
     */
    encodeSyncStep1(docId: string): Uint8Array {
        const doc = this.docs.get(docId);
        if (!doc) return new Uint8Array();

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeSyncStep1(encoder, doc);
        return encoding.toUint8Array(encoder);
    }

    /**
     * Handle sync step 1 from client and return step 2
     */
    handleSyncStep1(docId: string, stateVector: Uint8Array): Uint8Array {
        const doc = this.docs.get(docId);
        if (!doc) return new Uint8Array();

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeSyncStep2(encoder, doc, stateVector);
        return encoding.toUint8Array(encoder);
    }

    /**
     * Get active document count
     */
    getActiveDocCount(): number {
        return this.docs.size;
    }

    /**
     * Cleanup document resources
     */
    async unloadDocument(docId: string): Promise<void> {
        // Persist before unloading
        await this.persistDocument(docId);

        // Clear persistence timer
        const timer = this.persistenceTimers.get(docId);
        if (timer) {
            clearTimeout(timer);
            this.persistenceTimers.delete(docId);
        }

        // Unsubscribe from Redis
        await redisSub.unsubscribe(`doc:${docId}:sync`, `doc:${docId}:awareness`);

        // Destroy Yjs doc
        const doc = this.docs.get(docId);
        if (doc) {
            doc.destroy();
            this.docs.delete(docId);
        }

        // Cleanup awareness
        this.awareness.delete(docId);

        console.log(`🗑️ Unloaded document ${docId}`);
    }

    /**
     * Cleanup all documents on shutdown
     */
    async shutdown(): Promise<void> {
        for (const docId of this.docs.keys()) {
            await this.unloadDocument(docId);
        }
    }
}

// Singleton instance
export const documentManager = new DocumentManager();
