const { redis, isReady } = require('../config/redis');

/**
 * Atomic fixed-window rate limiter using Redis INCR + EXPIRE.
 * 
 * @param {Object} options
 * @param {number} options.windowSeconds - Window duration in seconds (e.g. 60)
 * @param {number} options.maxRequests - Max requests allowed per window (e.g. 10)
 * @param {string} options.keyPrefix - Prefix for Redis keys
 */
function createRateLimiter({ windowSeconds = 60, maxRequests = 10, keyPrefix = 'rl:shorten' } = {}) {
  return async function rateLimiterMiddleware(req, res, next) {
    // If Redis is down, fail open to avoid taking down the whole service
    if (!isReady()) {
      return next();
    }

    try {
      // Extract client IP safely (express req.ip respects 'trust proxy')
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const key = `${keyPrefix}:${clientIp}`;

      // Redis pipeline executes INCR and initial EXPIRE atomically
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.ttl(key);

      const results = await pipeline.exec();
      // results = [[null, currentCount], [null, currentTtl]]
      const currentCount = results[0][1];
      let currentTtl = results[1][1];

      // If key is newly created (ttl === -1 means no expiry set), set the expiration
      if (currentTtl === -1) {
        await redis.expire(key, windowSeconds);
        currentTtl = windowSeconds;
      }

      // Set standard RFC rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));
      res.setHeader('X-RateLimit-Reset', Math.max(0, currentTtl));

      if (currentCount > maxRequests) {
        res.setHeader('Retry-After', Math.max(1, currentTtl));
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. You have exceeded the limit of ${maxRequests} links per ${windowSeconds} seconds.`,
            retryAfter: currentTtl,
          },
        });
      }

      next();
    } catch (err) {
      console.warn(`Rate limiter Redis error: ${err.message}. Failing open.`);
      next(); // Fail-open: do not block users if rate limiting fails
    }
  };
}

module.exports = {
  createRateLimiter,
};

