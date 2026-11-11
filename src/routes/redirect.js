const express = require('express');
const router = express.Router();
const urlService = require('../services/urlService');

/**
 * GET /:code
 * Looks up original URL and redirects with HTTP 302 Found.
 * Handles 404 (Not Found) and 410 (Gone / Expired).
 */
router.get('/:code', async (req, res) => {
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

    if (isExpired) {
      return res.status(410).json({
        success: false,
        error: {
          code: 'URL_EXPIRED',
          message: 'This short link has expired and is no longer available.',
        },
      });
    }

    // 302 Found: temporary redirect so repeat visits still hit backend
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
