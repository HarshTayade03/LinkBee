const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const config = require('../config/env');
const userService = require('../services/userService');
const { optionalAuth } = require('../middlewares/auth');

const client = new OAuth2Client(config.googleClientId);

/**
 * POST /api/v1/auth/google
 * Body: { credential: "<Google_ID_Token>" } or { devMock: true } in dev
 */
router.post('/google', async (req, res) => {
  try {
    const { credential, devMock, mockEmail, mockName } = req.body;

    let googleProfile = null;

    // Handle dev mock login when developing locally without active Google OAuth Credentials
    if (config.nodeEnv === 'development' && devMock) {
      googleProfile = {
        sub: 'mock_google_id_' + (mockEmail || 'test@gmail.com').replace(/[^a-zA-Z0-9]/g, '_'),
        email: mockEmail || 'developer@example.com',
        name: mockName || 'Developer Tester',
        picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=sho.rt',
      };
    } else {
      if (!credential) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_CREDENTIAL', message: 'Google credential ID token is required.' },
        });
      }

      // Verify Google ID token cryptographically
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: config.googleClientId,
      });
      googleProfile = ticket.getPayload();
    }

    if (!googleProfile || !googleProfile.email) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Failed to verify Google identity.' },
      });
    }

    // Upsert into PostgreSQL
    const user = await userService.findOrCreateGoogleUser({
      googleId: googleProfile.sub,
      email: googleProfile.email,
      name: googleProfile.name || 'Anonymous User',
      avatarUrl: googleProfile.picture || null,
    });

    // Sign JWT (valid for 7 days)
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    // Set secure HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
        },
      },
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_FAILED', message: 'Authentication with Google failed.' },
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user profile and their link count
 */
router.get('/me', optionalAuth, async (req, res) => {
  if (!req.user) {
    return res.status(200).json({
      success: true,
      data: { user: null },
    });
  }

  const user = await userService.getUserById(req.user.id);
  return res.status(200).json({
    success: true,
    data: { user },
  });
});

/**
 * POST /api/v1/auth/logout
 * Clears the auth cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
  });
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;

