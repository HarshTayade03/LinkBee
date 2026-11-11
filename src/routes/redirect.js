const express = require('express');
const router = express.Router();
const urlService = require('../services/urlService');
const cacheService = require('../services/cacheService');

/**
 * GET /:code
 * Hot redirection path implemented via Cache-Aside pattern.
 * 1. Check Redis cache. On Cache Hit -> redirect immediately with HTTP 302.
 * 2. On Cache Miss -> Query PostgreSQL.
 *    - If expired: return HTTP 410 Gone (evict from cache).
 *    - If not found: return HTTP 404 Not Found.
 *    - If found: write to Redis with TTL and redirect with HTTP 302.
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // Step 1: Check Redis cache first
    const cached = await cacheService.getCachedUrl(code);
    if (cached) {
      // Check if cached entry has passed expiration
      if (cached.expiresAt && new Date() > new Date(cached.expiresAt)) {
        await cacheService.deleteCachedUrl(code);
        return res.status(410).json({
          success: false,
          error: {
            code: 'URL_EXPIRED',
            message: 'This short link has expired and is no longer available.',
          },
        });
      }

      // Cache Hit: redirect immediately
      res.setHeader('X-Cache', 'HIT');
      return res.redirect(302, cached.originalUrl);
    }

    // Step 2: Cache Miss -> Fallback to PostgreSQL
    const { record, isExpired } = await urlService.getUrlByCode(code);

    if (!record) {
      res.setHeader('X-Cache', 'MISS');
      return res.status(404).json({
        success: false,
        error: {
          code: 'URL_NOT_FOUND',
          message: 'The requested short URL does not exist.',
        },
      });
    }

    if (isExpired) {
      res.setHeader('X-Cache', 'MISS');
      return res.status(410).json({
        success: false,
        error: {
          code: 'URL_EXPIRED',
          message: 'This short link has expired and is no longer available.',
        },
      });
    }

    // Step 3: Populate cache asynchronously with TTL for future requests
    await cacheService.setCachedUrl(record.short_code, record.original_url, record.expires_at);

    res.setHeader('X-Cache', 'MISS');
    return res.redirect(302, record.original_url);
  } catch (err) {
    console.error('Error redirecting code:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  }
});

module.exports = router;
