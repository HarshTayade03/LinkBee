const express = require('express');
const router = express.Router();
const urlService = require('../services/urlService');
const analyticsService = require('../services/analyticsService');
const config = require('../config/env');
const { validateShortenRequest } = require('../middlewares/validate');

/**
 * POST /api/v1/shorten
 */
router.post('/shorten', validateShortenRequest, async (req, res) => {
  try {
    const { originalUrl, customAlias, expiresAt } = req.body;

    const record = await urlService.createShortUrl({
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
 * GET /api/v1/stats/:code
 * Public stats endpoint for click analytics.
 * (In Phase 6, we will require the secret management token here)
 */
router.get('/stats/:code', async (req, res) => {
  try {
    const { code } = req.params;

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
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while fetching analytics.',
      },
    });
  }
});

module.exports = router;
