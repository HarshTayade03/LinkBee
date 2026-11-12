const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Optional Authentication:
 * Reads HTTP-only cookie 'auth_token' or Authorization Bearer header.
 * If valid, attaches req.user = { id, email, name, avatarUrl }.
 * If not logged in, req.user remains null without blocking the request.
 */
function optionalAuth(req, res, next) {
  const token = req.cookies?.auth_token || req.headers.authorization?.replace(/^Bearer\s+/, '');

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
  } catch (err) {
    req.user = null; // Invalid or expired token
  }

  next();
}

/**
 * Required Authentication:
 * Blocks unauthenticated users with HTTP 401 Unauthorized.
 */
function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'You must be signed in with Google to perform this action.',
        },
      });
    }
    next();
  });
}

module.exports = {
  optionalAuth,
  requireAuth,
};
