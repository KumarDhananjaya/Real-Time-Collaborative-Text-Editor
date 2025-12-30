import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { QuillBinding } from 'y-quill';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import 'quill/dist/quill.snow.css';
import { API_BASE_URL } from '../config';
import { useUser } from '../contexts/UserContext';
import styles from './Editor.module.css';

// Register cursors module
Quill.register('modules/cursors', QuillCursors);

interface Collaborator {
    id: string;
    name: string;
    color: string;
}

function Editor() {
    const { docId } = useParams<{ docId: string }>();
    const { user, token, isLoading: userLoading } = useUser();
    const navigate = useNavigate();

    const editorRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<Quill | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const bindingRef = useRef<QuillBinding | null>(null);
    const awarenessRef = useRef<awarenessProtocol.Awareness | null>(null);

    const [title, setTitle] = useState('Untitled Document');
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [connected, setConnected] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Redirect if not logged in
    useEffect(() => {
        if (!userLoading && !user) {
            navigate('/');
        }
    }, [user, userLoading, navigate]);

    // Initialize editor
    useEffect(() => {
        if (!docId || !user || !token || !editorRef.current) return;

        // Create Yjs document
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        // Create awareness
        const awareness = new awarenessProtocol.Awareness(ydoc);
        awarenessRef.current = awareness;

        // Set local user awareness
        awareness.setLocalStateField('user', {
            id: user.id,
            name: user.name,
            color: user.color,
        });

        // Initialize Quill
        const quill = new Quill(editorRef.current, {
            theme: 'snow',
            placeholder: 'Start typing...',
            modules: {
                cursors: true,
                toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ color: [] }, { background: [] }],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    [{ indent: '-1' }, { indent: '+1' }],
                    ['link', 'blockquote', 'code-block'],
                    ['clean'],
                ],
                history: {
                    userOnly: true,
                },
            },
        });
        quillRef.current = quill;

        // Get cursors module
        const cursors = quill.getModule('cursors') as QuillCursors;

        // Bind Yjs to Quill
        const ytext = ydoc.getText('content');
        const binding = new QuillBinding(ytext, quill, awareness);
        bindingRef.current = binding;

        // Connect to socket
        const socket = io(API_BASE_URL || '/', {
            auth: { token },
            transports: ['websocket'],
        });
        socketRef.current = socket;

        // Message types
        const MESSAGE_SYNC = 0;

        socket.on('connect', () => {
            console.log('Connected to server');
            setConnected(true);

            // Join document
            socket.emit('join-document', docId, (response: any) => {
                if (response.sync) {
                    // Handle initial sync step 1 from server
                    const encoder = encoding.createEncoder();
                    encoding.writeVarUint(encoder, MESSAGE_SYNC);
                    syncProtocol.readSyncMessage(
                        decoding.createDecoder(new Uint8Array(response.sync)),
                        encoder,
                        ydoc,
                        'server'
                    );

                    // If the reply contains data (Step 2), send it back
                    if (encoding.length(encoder) > 1) {
                        socket.emit('sync-update', docId, Array.from(encoding.toUint8Array(encoder)));
                    }
                }
                if (response.awareness) {
                    awarenessProtocol.applyAwarenessUpdate(
                        awareness,
                        new Uint8Array(response.awareness),
                        'server'
                    );
                }
            });
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setConnected(false);
        });

        // Handle incoming Yjs updates (raw updates)
        socket.on('yjs-update', (update: number[]) => {
            Y.applyUpdate(ydoc, new Uint8Array(update), 'server');
        });

        // Handle incoming sync updates (protocol messages)
        socket.on('sync-update', (message: number[]) => {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_SYNC);

            // Note: The server sends the message with the MESSAGE_SYNC prefix (0), 
            // but the decoder below expects just the payload if we stripped it, 
            // OR we handle the whole message if it's raw. 
            // Server code wraps it in MESSAGE_SYNC? 
            // Server handler: socket.to(room).emit('sync-update', message); 
            // where 'message' came from client and starts with MESSAGE_SYNC.

            const decoder = decoding.createDecoder(new Uint8Array(message));

            // Read message type (server sends [0, ...])
            const messageType = decoding.readVarUint(decoder);

            if (messageType === MESSAGE_SYNC) {
                syncProtocol.readSyncMessage(decoder, encoder, ydoc, 'server');

                // If this generated a reply (e.g. Step 1 -> Step 2), send it back
                if (encoding.length(encoder) > 1) {
                    socket.emit('sync-update', docId, Array.from(encoding.toUint8Array(encoder)));
                }
            }
        });

        // Handle awareness updates
        socket.on('awareness-update', (message: number[]) => {
            awarenessProtocol.applyAwarenessUpdate(
                awareness,
                new Uint8Array(message),
                'server'
            );
        });

        // User presence events
        socket.on('user-joined', (newUser: Collaborator) => {
            setCollaborators(prev => {
                if (prev.find(c => c.id === newUser.id)) return prev;
                return [...prev, newUser];
            });
        });

        socket.on('user-left', (userId: string) => {
            setCollaborators(prev => prev.filter(c => c.id !== userId));
            cursors.removeCursor(userId);
        });

        socket.on('error', (message: string) => {
            setError(message);
        });

        // Send local Yjs updates to server
        const updateHandler = (update: Uint8Array, origin: string) => {
            if (origin !== 'server' && socket.connected) {
                socket.emit('yjs-update', docId, Array.from(update));
            }
        };
        ydoc.on('update', updateHandler);

        // Send awareness updates to server
        const awarenessHandler = ({ added, updated, removed }: any) => {
            if (socket.connected) {
                const changedClients = [...added, ...updated, ...removed];
                const encoded = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
                socket.emit('awareness-update', docId, Array.from(encoded));
            }
        };
        awareness.on('update', awarenessHandler);

        // Handle remote cursors
        awareness.on('change', () => {
            const states = awareness.getStates();
            const newCollaborators: Collaborator[] = [];

            states.forEach((state, clientId) => {
                if (clientId === awareness.clientID) return;

                const userState = state.user as Collaborator | undefined;
                if (userState) {
                    newCollaborators.push(userState);

                    // Update cursor position
                    if (state.cursor) {
                        try {
                            cursors.createCursor(
                                userState.id,
                                userState.name,
                                userState.color
                            );
                            cursors.moveCursor(userState.id, state.cursor);
                        } catch (e) {
                            // Cursor might already exist
                        }
                    }
                }
            });

            setCollaborators(newCollaborators);
        });

        // Fetch document metadata
        fetchDocumentMeta();

        // Cleanup
        return () => {
            ydoc.off('update', updateHandler);
            awareness.off('update', awarenessHandler);

            if (socket.connected) {
                socket.emit('leave-document', docId);
                socket.disconnect();
            }

            binding.destroy();
            ydoc.destroy();
        };
    }, [docId, user, token]);

    const fetchDocumentMeta = async () => {
        try {
            const response = await fetch(`/api/documents/${docId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await response.json();

            if (data.success) {
                setTitle(data.data.title);
            }
        } catch (err) {
            console.error('Failed to fetch document metadata');
        }
    };

    const updateTitle = useCallback(async (newTitle: string) => {
        setTitle(newTitle);
        setSaving(true);

        try {
            await fetch(`/api/documents/${docId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ title: newTitle }),
            });
        } catch (err) {
            console.error('Failed to update title');
        } finally {
            setSaving(false);
        }
    }, [docId, token]);

    // Debounced title update
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);

        // Debounce the API call
        const timeoutId = setTimeout(() => updateTitle(newTitle), 500);
        return () => clearTimeout(timeoutId);
    };

    if (userLoading || !user) {
        return (
            <div className={styles.loading}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <Link to="/documents" className={styles.backBtn}>
                    ← Back
                </Link>

                <input
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    className={styles.titleInput}
                    placeholder="Document title"
                />

                <div className={styles.status}>
                    {saving && <span className={styles.saving}>Saving...</span>}
                    <span className={`${styles.connection} ${connected ? styles.online : styles.offline}`}>
                        {connected ? '● Connected' : '○ Disconnected'}
                    </span>
                </div>

                <div className={styles.collaborators}>
                    {collaborators.map(c => (
                        <div
                            key={c.id}
                            className={styles.collaboratorAvatar}
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                        >
                            {c.name.charAt(0).toUpperCase()}
                        </div>
                    ))}
                    {user && (
                        <div
                            className={`${styles.collaboratorAvatar} ${styles.self}`}
                            style={{ backgroundColor: user.color }}
                            title={`${user.name} (you)`}
                        >
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className={styles.error}>
                    {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {/* Editor */}
            <div className={styles.editorWrapper}>
                <div ref={editorRef} className={styles.editor} />
            </div>
        </div>
    );
}

export default Editor;
