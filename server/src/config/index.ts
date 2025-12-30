import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/collab_editor',
    },

    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret',
        expiresIn: 604800, // 7 days in seconds
    },

    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    },

    // Persistence settings
    snapshotInterval: parseInt(process.env.SNAPSHOT_INTERVAL || '30000', 10),
};

// Validate required config in production
if (config.nodeEnv === 'production') {
    const required = ['JWT_SECRET', 'MONGODB_URI', 'REDIS_URL'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
