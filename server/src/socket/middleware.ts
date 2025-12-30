import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';

/** Random color generator for user cursors */
function generateUserColor(): string {
    const colors = [
        '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
        '#2196F3', '#00BCD4', '#009688', '#4CAF50',
        '#FF9800', '#FF5722', '#795548', '#607D8B'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

export interface AuthenticatedSocket extends Socket {
    userId: string;
    userName: string;
    userColor: string;
}

/**
 * Socket.io authentication middleware
 * Supports JWT token or guest access
 */
export function authMiddleware(
    socket: Socket,
    next: (err?: Error) => void
): void {
    const token = socket.handshake.auth.token;
    const guestName = socket.handshake.auth.guestName;

    // Allow guest access with generated ID
    if (!token && guestName) {
        const authSocket = socket as AuthenticatedSocket;
        authSocket.userId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        authSocket.userName = guestName || 'Anonymous';
        authSocket.userColor = generateUserColor();
        console.log(`👤 Guest connected: ${authSocket.userName} (${authSocket.userId})`);
        return next();
    }

    // Verify JWT token
    if (token) {
        try {
            const decoded = jwt.verify(token, config.jwt.secret) as {
                userId: string;
                name: string;
                color: string;
            };

            const authSocket = socket as AuthenticatedSocket;
            authSocket.userId = decoded.userId;
            authSocket.userName = decoded.name;
            authSocket.userColor = decoded.color || generateUserColor();

            console.log(`👤 User connected: ${authSocket.userName} (${authSocket.userId})`);
            return next();
        } catch (err) {
            return next(new Error('Invalid token'));
        }
    }

    // No auth provided - create anonymous user
    const authSocket = socket as AuthenticatedSocket;
    authSocket.userId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    authSocket.userName = 'Anonymous';
    authSocket.userColor = generateUserColor();
    next();
}
