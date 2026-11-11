const Redis = require('ioredis');
const config = require('./env');

let redisClient = null;
let isRedisReady = false;

try {
  redisClient = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // Exponential backoff up to 2 seconds
      const delay = Math.min(times * 100, 2000);
      return delay;
    },
    enableOfflineQueue: false, // Fail fast if Redis is disconnected rather than hanging requests
    lazyConnect: false,
  });

  redisClient.on('connect', () => {
    isRedisReady = true;
    console.log('Redis connected successfully.');
  });

  redisClient.on('ready', () => {
    isRedisReady = true;
  });

  redisClient.on('error', (err) => {
    isRedisReady = false;
    // Log error, but do not crash the app - fail-open strategy
    console.warn(`Redis connection error: ${err.message}. Operating in DB-only fallback mode.`);
  });

  redisClient.on('close', () => {
    isRedisReady = false;
  });
} catch (err) {
  console.warn('Failed to initialize Redis client. Falling back to DB-only mode.', err.message);
}

module.exports = {
  redis: redisClient,
  isReady: () => isRedisReady && redisClient && redisClient.status === 'ready',
};
