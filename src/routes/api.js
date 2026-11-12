const express = require('express');
const router = express.Router();
const urlService = require('../services/urlService');
const analyticsService = require('../services/analyticsService');
const cacheService = require('../services/cacheService');
const config = require('../config/env');
const { validateShortenRequest } = require('../middlewares/validate');
const { createRateLimiter } = require('../middlewares/rateLimiter');
const { optionalAuth, requireAuth } = require('../middlewares/auth');
const { redis } = require('../config/redis');

// Rate limit POST /shorten to 10 requests per 60 seconds per IP
const shortenRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 10,
  keyPrefix: 'rl:shorten',
});

/**
 * POST /api/v1/shorten
 * Business Rule:
 * - If unauthenticated (req.user is null): user can create ONLY 1 link per IP (free trial).
 *   Attempting to create a second link returns HTTP 403 (Sign in with Google required).
 * - If authenticated (req.user is present): unlimited links, associated with user account.
 */
router.post('/shorten', optionalAuth, shortenRateLimiter, validateShortenRequest, async (req, res) => {
  try {
    const { originalUrl, customAlias, expiresAt } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    // Enforcement of 1 free anonymous link rule:
    if (!req.user) {
      const anonKey = `anon:created:${clientIp}`;
      if (redis) {
        const hasCreated = await redis.get(anonKey);
        if (hasCreated) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'AUTH_REQUIRED_LIMIT',
              message: 'You have used your 1 free anonymous link! Please sign in with Google to create and manage more links.',
            },
          });
        }
      }
    }

    const record = await urlService.createShortUrl({
      originalUrl,
      customAlias,
      expiresAt,
      userId: req.user ? req.user.id : null,
    });

    // Mark that this IP has claimed their 1 free anonymous link
    if (!req.user && redis) {
      await redis.set(`anon:created:${clientIp}`, '1', 'EX', 30 * 24 * 60 * 60); // 30 days
    }

    return res.status(201).json({
      success: true,
      data: {
        shortCode: record.short_code,
        shortUrl: `${config.baseUrl}/${record.short_code}`,
        originalUrl: record.original_url,
        createdAt: record.created_at,
        expiresAt: record.expires_at,
        isAnonymous: !req.user,
      },
    });
  } catch (err) {
    if (err instanceof urlService.AliasConflictError) {
      return res.status(409).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }

    console.error('Error shortening URL:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  }
});

/**
 * GET /api/v1/user/links
 * Fetch all links owned by the signed-in Google user
 */
router.get('/user/links', requireAuth, async (req, res) => {
  try {
    const links = await urlService.getUserLinks(req.user.id);
    return res.status(200).json({
      success: true,
      data: {
        links: links.map((l) => ({
          id: l.id,
          shortCode: l.short_code,
          shortUrl: `${config.baseUrl}/${l.short_code}`,
          originalUrl: l.original_url,
          createdAt: l.created_at,
          expiresAt: l.expires_at,
          totalClicks: l.total_clicks,
        })),
      },
    });
  } catch (err) {
    console.error('Error fetching user links:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Could not fetch your links.' },
    });
  }
});

/**
 * GET /api/v1/links/:code
 * View link analytics:
 * - Allowed ONLY if user is authenticated AND owns the link.
 * - Anonymous links do NOT have public analytics (as requested).
 */
router.get('/links/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;

    const { record, isExpired } = await urlService.getUrlByCode(code);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: { code: 'URL_NOT_FOUND', message: 'The requested short URL does not exist.' },
      });
    }

    // Verify ownership: link must belong to the logged-in user
    if (!record.user_id || String(record.user_id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view analytics for this link.',
        },
      });
    }

    const stats = await analyticsService.getUrlStats(record.id);

    return res.status(200).json({
      success: true,
      data: {
        shortCode: record.short_code,
        originalUrl: record.original_url,
        createdAt: record.created_at,
        expiresAt: record.expires_at,
        isExpired,
        stats,
      },
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  }
});

/**
 * DELETE /api/v1/links/:code
 * Delete short link: allowed only for the owning user
 */
router.delete('/links/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;

    const deleted = await urlService.deleteUserUrl(code, req.user.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'URL_NOT_FOUND', message: 'Link not found or you do not have permission to delete it.' },
      });
    }

    // Invalidate Redis cache immediately
    await cacheService.deleteCachedUrl(code);

    return res.status(204).send();
  } catch (err) {
    console.error('Error deleting link:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  }
});

module.exports = router;
