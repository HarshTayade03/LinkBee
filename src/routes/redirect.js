const express = require('express');
const router = express.Router();
const urlService = require('../services/urlService');

/**
 * GET /:code
 * Looks up original URL and redirects with HTTP 302 Found.
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const record = await urlService.getUrlByCode(code);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'URL_NOT_FOUND',
          message: 'The requested short URL does not exist.',
        },
      });
    }

    // 302 Found: temporary redirect so repeat visits still hit server for analytics
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
