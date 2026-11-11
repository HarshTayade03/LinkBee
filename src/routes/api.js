const express = require('express');
const router = express.Router();
const urlService = require('../services/urlService');
const analyticsService = require('../services/analyticsService');
const config = require('../config/env');
const { validateShortenRequest } = require('../middlewares/validate');
const { createRateLimiter } = require('../middlewares/rateLimiter');

// Rate limit POST /shorten to 10 requests per 60 seconds per IP
const shortenRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 10,
  keyPrefix: 'rl:shorten',
});

/**
 * POST /api/v1/shorten
 */
router.post('/shorten', shortenRateLimiter, validateShortenRequest, async (req, res) => {
  try {
    const { originalUrl, customAlias, expiresAt } = req.body;

    const { record, managementToken } = await urlService.createShortUrl({
      originalUrl,
      customAlias,
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      data: {
        shortCode: record.short_code,
        shortUrl: `${config.baseUrl}/${record.short_code}`,
        originalUrl: record.original_url,
        managementToken, // Returned ONCE upon creation to the creator
        createdAt: record.created_at,
        expiresAt: record.expires_at,
      },
    });
  } catch (err) {
    if (err instanceof urlService.AliasConflictError) {
      return res.status(409).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    console.error('Error shortening URL:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
      },
    });
  }
});

/**
 * GET /api/v1/links/:code
 * Protected stats & metadata endpoint: requires valid X-Management-Token header or ?token= query
 */
router.get('/links/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const token = req.get('X-Management-Token') || req.query.token;

    const { record, isExpired } = await urlService.getUrlByCode(code);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'URL_NOT_FOUND',
          message: 'The requested short URL does not exist.',
        },
      });
    }

    // Authenticate using the per-link management token
    if (!token || !urlService.verifyManagementToken(record, token)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'A valid management token is required to view link analytics.',
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
    console.error('Error fetching link details:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  }
});

/**
 * DELETE /api/v1/links/:code
 * Delete short link: requires valid management token
 */
router.delete('/links/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const token = req.get('X-Management-Token') || req.query.token;

    const { record } = await urlService.getUrlByCode(code);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'URL_NOT_FOUND',
          message: 'The requested short URL does not exist.',
        },
      });
    }

    if (!token || !urlService.verifyManagementToken(record, token)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'A valid management token is required to delete this link.',
        },
      });
    }

    await urlService.deleteUrlByCode(code);
    // Invalidate Redis cache immediately
    const cacheService = require('../services/cacheService');
    await cacheService.deleteCachedUrl(code);

    return res.status(204).send();
  } catch (err) {
    console.error('Error deleting link:', err);
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
