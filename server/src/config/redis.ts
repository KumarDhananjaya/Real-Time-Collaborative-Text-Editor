import Redis from 'ioredis';
import { config } from './index';

// Main Redis client for caching
export const redisClient = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
});

// Publisher client for Pub/Sub
export const redisPub = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
});

// Subscriber client for Pub/Sub  
export const redisSub = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
});

// Connection event handlers
redisClient.on('connect', () => {
    console.log('✅ Redis client connected');
});

redisClient.on('error', (err) => {
    console.error('❌ Redis client error:', err.message);
});

redisPub.on('connect', () => {
    console.log('✅ Redis publisher connected');
});

redisSub.on('connect', () => {
    console.log('✅ Redis subscriber connected');
});

/**
 * Initialize all Redis connections
 */
export async function connectRedis(): Promise<void> {
    await Promise.all([
        redisClient.connect(),
        redisPub.connect(),
        redisSub.connect(),
    ]);
}

/**
 * Gracefully close all Redis connections
 */
export async function disconnectRedis(): Promise<void> {
    await Promise.all([
        redisClient.quit(),
        redisPub.quit(),
        redisSub.quit(),
    ]);
}
