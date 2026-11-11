const express = require('express');
const router = express.Router();
const urlService = require('../services/urlService');
const cacheService = require('../services/cacheService');
const analyticsService = require('../services/analyticsService');

/**
 * GET /:code
 * Hot redirection path:
 * 1. Checks Redis cache.
 * 2. On Miss: checks PostgreSQL and caches result.
 * 3. Records click event asynchronously (fire-and-forget) without delaying the HTTP 302 response.
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const referrer = req.get('referrer') || req.get('referer') || null;
    const userAgent = req.get('user-agent') || null;

    // 1. Check Redis cache first
    const cached = await cacheService.getCachedUrl(code);
    if (cached) {
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

      // Asynchronous non-blocking analytics logging
      analyticsService.recordClickAsync({
        urlId: cached.id,
        referrer,
        userAgent,
      });

      res.setHeader('X-Cache', 'HIT');
      return res.redirect(302, cached.originalUrl);
    }

    // 2. Cache Miss -> Query PostgreSQL
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

    // 3. Populate cache with id for subsequent clicks
    await cacheService.setCachedUrl(record.short_code, {
      id: record.id,
      originalUrl: record.original_url,
      expiresAt: record.expires_at,
    });

    // Asynchronous non-blocking analytics logging
    analyticsService.recordClickAsync({
      urlId: record.id,
      referrer,
      userAgent,
    });

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
