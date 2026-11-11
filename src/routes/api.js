const express = require('express');
const router = express.Router();
const urlService = require('../services/urlService');
const config = require('../config/env');

/**
 * POST /api/v1/shorten
 * Body: { originalUrl: string }
 */
router.post('/shorten', async (req, res) => {
  try {
    const { originalUrl } = req.body;

    if (!originalUrl || typeof originalUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'originalUrl is required and must be a string.',
        },
      });
    }

    const record = await urlService.createShortUrl(originalUrl);

    return res.status(201).json({
      success: true,
      data: {
        shortCode: record.short_code,
        shortUrl: `${config.baseUrl}/${record.short_code}`,
        originalUrl: record.original_url,
        createdAt: record.created_at,
      },
    });
  } catch (err) {
    console.error('Error shortening URL:', err);
    // Generic error response avoids leaking database internals or stack traces
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
