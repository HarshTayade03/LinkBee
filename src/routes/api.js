const express = require('express');
const router = express.Router();
const urlService = require('../services/urlService');
const config = require('../config/env');
const { validateShortenRequest } = require('../middlewares/validate');

/**
 * POST /api/v1/shorten
 * Body: { originalUrl: string, customAlias?: string, expiresAt?: string }
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

module.exports = router;
