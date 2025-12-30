// Shared TypeScript types for the collaborative editor

/** User information for presence/awareness */
export interface User {
    id: string;
    name: string;
    color: string;
    avatar?: string;
}

/** Awareness state for a connected client */
export interface AwarenessState {
    user: User;
    cursor?: CursorPosition;
    selection?: SelectionRange;
}

/** Cursor position in the document */
export interface CursorPosition {
    index: number;
    length: number;
}

/** Selection range in the document */
export interface SelectionRange {
    anchor: number;
    head: number;
}

/** Document metadata */
export interface DocumentMeta {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    collaborators: string[];
}

/** Socket.io events from client to server */
export interface ClientToServerEvents {
    'join-document': (docId: string, callback: (state: Uint8Array) => void) => void;
    'leave-document': (docId: string) => void;
    'sync-update': (docId: string, update: Uint8Array) => void;
    'awareness-update': (docId: string, state: Uint8Array) => void;
}

/** Socket.io events from server to client */
export interface ServerToClientEvents {
    'sync-update': (update: Uint8Array) => void;
    'awareness-update': (state: Uint8Array) => void;
    'user-joined': (user: User) => void;
    'user-left': (userId: string) => void;
    'error': (message: string) => void;
}

/** Socket.io inter-server events (for Redis adapter) */
export interface InterServerEvents {
    ping: () => void;
}

/** Socket data attached to each connection */
export interface SocketData {
    userId: string;
    userName: string;
    currentDocId?: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/** Document list item for API */
export interface DocumentListItem {
    id: string;
    title: string;
    updatedAt: Date;
    collaboratorCount: number;
}

/** Message types for Redis Pub/Sub */
export interface PubSubMessage {
    type: 'update' | 'awareness' | 'presence';
    docId: string;
    senderId: string;
    data: string; // Base64 encoded Uint8Array
}

/** Random color generator for user cursors */
export function generateUserColor(): string {
    const colors = [
        '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
        '#2196F3', '#00BCD4', '#009688', '#4CAF50',
        '#FF9800', '#FF5722', '#795548', '#607D8B'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

/** Generate a unique client ID */
export function generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
