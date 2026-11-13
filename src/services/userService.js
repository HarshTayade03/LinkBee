const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Create a new user with email, username, and hashed password.
 * Generates an initial verification token.
 */
async function registerUser({ username, email, password }) {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(username)}`;

  const query = `
    INSERT INTO users (username, email, password_hash, is_verified, verification_token, verification_expires_at, avatar_url)
    VALUES ($1, $2, $3, FALSE, $4, $5, $6)
    RETURNING id, username, email, is_verified, avatar_url, created_at;
  `;
  const result = await db.query(query, [
    username.toLowerCase().trim(),
    email.toLowerCase().trim(),
    passwordHash,
    verificationToken,
    verificationExpiresAt,
    avatarUrl,
  ]);

  return {
    user: result.rows[0],
    verificationToken,
  };
}

/**
 * Find user by email or username
 */
async function findUserByLogin(identifier) {
  const clean = identifier.toLowerCase().trim();
  const query = `
    SELECT id, username, email, password_hash, is_verified, avatar_url, created_at
    FROM users
    WHERE email = $1 OR username = $1;
  `;
  const result = await db.query(query, [clean]);
  return result.rows[0] || null;
}

/**
 * Verify user password
 */
async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Verify user email via token
 */
async function verifyEmailToken(token) {
  const query = `
    SELECT id, username, email, is_verified, verification_expires_at
    FROM users
    WHERE verification_token = $1;
  `;
  const result = await db.query(query, [token]);
  const user = result.rows[0];

  if (!user) {
    return { success: false, code: 'INVALID_TOKEN', message: 'Verification link is invalid.' };
  }

  if (user.is_verified) {
    return { success: true, alreadyVerified: true, user };
  }

  if (user.verification_expires_at && new Date() > new Date(user.verification_expires_at)) {
    return { success: false, code: 'TOKEN_EXPIRED', message: 'Verification link has expired. Please request a new one.' };
  }

  // Update user as verified
  const updateQuery = `
    UPDATE users
    SET is_verified = TRUE,
        verification_token = NULL,
        verification_expires_at = NULL
    WHERE id = $1
    RETURNING id, username, email, is_verified, avatar_url, created_at;
  `;
  const updateResult = await db.query(updateQuery, [user.id]);
  return { success: true, user: updateResult.rows[0] };
}

/**
 * Create a fresh verification token for resending
 */
async function createNewVerificationToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const query = `
    UPDATE users
    SET verification_token = $1,
        verification_expires_at = $2
    WHERE id = $3 AND is_verified = FALSE
    RETURNING id, username, email;
  `;
  const result = await db.query(query, [token, expiresAt, userId]);
  if (result.rows.length === 0) return null;
  return { ...result.rows[0], verificationToken: token };
}

/**
 * Get user by ID
 */
async function getUserById(id) {
  const query = `
    SELECT id, username, email, is_verified, avatar_url, created_at
    FROM users
    WHERE id = $1;
  `;
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Count total links created by a user
 */
async function getUserLinkCount(userId) {
  const query = `
    SELECT COUNT(*)::int AS count
    FROM urls
    WHERE user_id = $1;
  `;
  const result = await db.query(query, [userId]);
  return result.rows[0]?.count || 0;
}

module.exports = {
  registerUser,
  findUserByLogin,
  verifyPassword,
  verifyEmailToken,
  createNewVerificationToken,
  getUserById,
  getUserLinkCount,
};
