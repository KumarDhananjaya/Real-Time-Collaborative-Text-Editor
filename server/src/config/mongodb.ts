import mongoose from 'mongoose';
import { config } from './index';

/**
 * Connect to MongoDB with retry logic
 */
export async function connectMongoDB(): Promise<void> {
    try {
        await mongoose.connect(config.mongodb.uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

/**
 * Gracefully close MongoDB connection
 */
export async function disconnectMongoDB(): Promise<void> {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
}

// Connection event handlers
mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});
