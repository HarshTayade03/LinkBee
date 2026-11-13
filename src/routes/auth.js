const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userService = require('../services/userService');
const emailService = require('../config/email');
const { optionalAuth, requireAuth } = require('../middlewares/auth');

function issueToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      isVerified: user.is_verified,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * POST /api/v1/auth/signup
 * Body: { username, email, password }
 */
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Username, email, and password are required.' },
      });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_USERNAME', message: 'Username must be between 3 and 30 characters.' },
      });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_USERNAME', message: 'Username can only contain letters, numbers, hyphens, and underscores.' },
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Please provide a valid email address.' },
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters long.' },
      });
    }

    // Check if username or email already registered
    const existing = await userService.findUserByLogin(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_IN_USE', message: 'An account with this email already exists.' },
      });
    }

    const existingUser = await userService.findUserByLogin(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { code: 'USERNAME_IN_USE', message: 'This username is already taken. Please choose another.' },
      });
    }

    // Register user
    const { user, verificationToken } = await userService.registerUser({ username, email, password });

    // Send verification email
    try {
      await emailService.sendVerificationEmail({
        to: user.email,
        username: user.username,
        verificationToken,
      });
    } catch (emailErr) {
      console.warn('Failed to send verification email:', emailErr.message);
    }

    const token = issueToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isVerified: user.is_verified,
          avatarUrl: user.avatar_url,
        },
      },
      message: 'Account created! Check your email to verify your account and unlock unlimited links.',
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create account. Please try again.' },
    });
  }
});

/**
 * POST /api/v1/auth/login
 * Body: { login (email or username), password }
 */
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Please provide both username/email and password.' },
      });
    }

    const user = await userService.findUserByLogin(login);
    if (!user || !user.password_hash) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password.' },
      });
    }

    const isMatch = await userService.verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password.' },
      });
    }

    const token = issueToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isVerified: user.is_verified,
          avatarUrl: user.avatar_url,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Login failed. Please try again.' },
    });
  }
});

/**
 * GET /api/v1/auth/verify-email?token=...
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Verification token is required.' },
      });
    }

    const result = await userService.verifyEmailToken(token);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: result.code, message: result.message },
      });
    }

    // Issue refreshed token with isVerified = true
    const authToken = issueToken(result.user);
    setAuthCookie(res, authToken);

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        alreadyVerified: !!result.alreadyVerified,
      },
      message: 'Email verified successfully! You now have unlimited links.',
    });
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Verification failed.' },
    });
  }
});

/**
 * POST /api/v1/auth/resend-verification
 */
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const user = await userService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found.' } });
    }

    if (user.is_verified) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_VERIFIED', message: 'Your email address is already verified.' },
      });
    }

    const updated = await userService.createNewVerificationToken(user.id);
    if (updated) {
      await emailService.sendVerificationEmail({
        to: updated.email,
        username: updated.username,
        verificationToken: updated.verificationToken,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'A new verification email has been sent to your inbox.',
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to send verification email.' },
    });
  }
});

/**
 * GET /api/v1/auth/me
 */
router.get('/me', optionalAuth, async (req, res) => {
  if (!req.user) {
    return res.status(200).json({
      success: true,
      data: { user: null },
    });
  }

  const user = await userService.getUserById(req.user.id);
  const linkCount = await userService.getUserLinkCount(req.user.id);

  return res.status(200).json({
    success: true,
    data: {
      user: user
        ? {
            id: user.id,
            username: user.username,
            email: user.email,
            isVerified: user.is_verified,
            avatarUrl: user.avatar_url,
            createdAt: user.created_at,
            linkCount,
          }
        : null,
    },
  });
});

/**
 * POST /api/v1/auth/logout
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
