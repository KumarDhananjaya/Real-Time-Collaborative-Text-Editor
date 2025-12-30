import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { config } from './config';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb';
import { connectRedis, disconnectRedis, redisPub, redisSub } from './config/redis';
import { setupSocketHandlers } from './socket/handlers';
import { authMiddleware } from './socket/middleware';
import { documentManager } from './crdt/DocumentManager';
import apiRouter from './api';

async function main() {
    console.log('🚀 Starting Real-Time Collaborative Editor Server...');
    console.log(`📍 Environment: ${config.nodeEnv}`);

    // Create Express app
    const app = express();

    // Middleware
    app.use(cors({
        origin: config.cors.origin,
        credentials: true,
    }));
    app.use(express.json());

    // API routes
    app.use('/api', apiRouter);

    // Health endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            uptime: process.uptime(),
            activeDocs: documentManager.getActiveDocCount(),
        });
    });

    // Create HTTP server
    const httpServer = createServer(app);

    // Connect to databases
    try {
        await connectRedis();
        await connectMongoDB();
    } catch (error) {
        console.error('Failed to connect to databases:', error);
        process.exit(1);
    }

    // Create Socket.io server with Redis adapter
    const io = new SocketServer(httpServer, {
        cors: {
            origin: config.cors.origin,
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // Use Redis adapter for multi-server support
    io.adapter(createAdapter(redisPub, redisSub));

    // Apply auth middleware
    io.use(authMiddleware);

    // Setup socket event handlers
    setupSocketHandlers(io);

    // Start server
    httpServer.listen(config.port, () => {
        console.log(`\n✅ Server running on http://localhost:${config.port}`);
        console.log(`📡 WebSocket ready for connections`);
        console.log(`📚 API available at http://localhost:${config.port}/api`);
        console.log('\n🔧 Features:');
        console.log('   - Real-time collaborative editing with CRDTs (Yjs)');
        console.log('   - Cross-server sync via Redis Pub/Sub');
        console.log('   - Document persistence in MongoDB');
        console.log('   - Awareness protocol for cursor/selection sync');
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
        console.log(`\n⚠️  ${signal} received, shutting down gracefully...`);

        // Stop accepting new connections
        httpServer.close();

        // Persist all active documents
        await documentManager.shutdown();

        // Close database connections
        await disconnectMongoDB();
        await disconnectRedis();

        console.log('👋 Server shutdown complete');
        process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
