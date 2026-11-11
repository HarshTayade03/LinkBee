const config = require('../config/env');

// Reserved path names that users cannot claim as short codes or custom aliases
const RESERVED_ALIASES = new Set([
  'api',
  'health',
  'docs',
  'stats',
  'admin',
  'static',
  'favicon.ico',
  'robots.txt',
  'index.html',
]);

// Internal and loopback hostnames / IPs to prevent SSRF and internal port scanning
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS/GCP instance metadata endpoint
  'metadata.google.internal',
]);

/**
 * Validate input for POST /api/v1/shorten
 */
function validateShortenRequest(req, res, next) {
  const { originalUrl, customAlias, expiresAt } = req.body;

  // 1. Check originalUrl presence & type
  if (!originalUrl || typeof originalUrl !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_URL',
        message: 'originalUrl is required and must be a string.',
      },
    });
  }

  // 2. Max length check (2048 chars is industry standard RFC-safe limit)
  if (originalUrl.length > 2048) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'URL_TOO_LONG',
        message: 'originalUrl must not exceed 2048 characters.',
      },
    });
  }

  // 3. Parse and validate URL structure
  let parsedUrl;
  try {
    parsedUrl = new URL(originalUrl);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_URL_FORMAT',
        message: 'originalUrl must be a valid, well-formed URL.',
      },
    });
  }

  // 4. Strict scheme whitelisting: only http: and https: allowed
  // Rejects javascript:, data:, file:, vbscript:
  const allowedProtocols = ['http:', 'https:'];
  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'UNSUPPORTED_SCHEME',
        message: `URL protocol '${parsedUrl.protocol}' is not allowed. Only 'http:' and 'https:' are permitted.`,
      },
    });
  }

  // 5. SSRF and Loopback prevention: block internal hostnames
  const hostname = parsedUrl.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BLOCKED_HOST',
        message: 'Shortening URLs pointing to localhost or private cloud metadata is forbidden.',
      },
    });
  }

  // 6. Prevent self-redirect loops (pointing back to our own domain)
  try {
    const appHost = new URL(config.baseUrl).hostname.toLowerCase();
    if (hostname === appHost) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SELF_REDIRECT_LOOP',
          message: 'Shortening URLs that point back to this URL shortener domain is forbidden.',
        },
      });
    }
  } catch (e) {
    // Ignore baseUrl parse error if improperly formatted in test
  }

  // 7. Validate customAlias if provided
  if (customAlias !== undefined && customAlias !== null) {
    if (typeof customAlias !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ALIAS',
          message: 'customAlias must be a string.',
        },
      });
    }

    const trimmedAlias = customAlias.trim();

    // Enforce 3 to 30 characters, alphanumeric with hyphens and underscores only
    const aliasRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!aliasRegex.test(trimmedAlias)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ALIAS_FORMAT',
          message: 'customAlias must be 3-30 characters long and contain only letters, numbers, hyphens, and underscores.',
        },
      });
    }

    // Check reserved words
    if (RESERVED_ALIASES.has(trimmedAlias.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'RESERVED_ALIAS',
          message: `'${trimmedAlias}' is a reserved system keyword and cannot be used as an alias.`,
        },
      });
    }

    req.body.customAlias = trimmedAlias;
  }

  // 8. Validate optional expiresAt timestamp
  if (expiresAt !== undefined && expiresAt !== null) {
    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EXPIRY_DATE',
          message: 'expiresAt must be a valid ISO-8601 date string.',
        },
      });
    }

    const now = new Date();
    if (expiryDate <= now) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EXPIRY_IN_PAST',
          message: 'expiresAt must be a future timestamp.',
        },
      });
    }

    // Cap maximum expiry at 5 years
    const maxExpiry = new Date();
    maxExpiry.setFullYear(maxExpiry.getFullYear() + 5);
    if (expiryDate > maxExpiry) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EXPIRY_TOO_FAR',
          message: 'expiresAt cannot be set further than 5 years into the future.',
        },
      });
    }

    req.body.expiresAt = expiryDate.toISOString();
  }

  next();
}

module.exports = {
  validateShortenRequest,
  RESERVED_ALIASES,
  BLOCKED_HOSTNAMES,
};

