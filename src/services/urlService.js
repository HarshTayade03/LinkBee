const db = require('../config/db');
const { generateShortCode } = require('../utils/base62');

class AliasConflictError extends Error {
  constructor(alias) {
    super(`The custom alias '${alias}' is already in use.`);
    this.name = 'AliasConflictError';
    this.code = 'ALIAS_IN_USE';
  }
}

/**
 * Shorten a URL.
 * If userId is provided, associate the URL with the authenticated user account.
 * If userId is null, link is created anonymously (anonymous free trial).
 */
async function createShortUrl({ originalUrl, customAlias = null, expiresAt = null, userId = null }) {
  if (customAlias) {
    try {
      const query = `
        INSERT INTO urls (short_code, original_url, expires_at, user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, short_code, original_url, created_at, expires_at, user_id;
      `;
      const result = await db.query(query, [customAlias, originalUrl, expiresAt, userId]);
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throw new AliasConflictError(customAlias);
      }
      throw err;
    }
  }

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const shortCode = generateShortCode(7);

    try {
      const query = `
        INSERT INTO urls (short_code, original_url, expires_at, user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, short_code, original_url, created_at, expires_at, user_id;
      `;
      const result = await db.query(query, [shortCode, originalUrl, expiresAt, userId]);
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505' && attempt < maxRetries - 1) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to generate unique short code. Please try again.');
}

/**
 * Find the original destination URL by short code.
 */
async function getUrlByCode(shortCode) {
  const query = `
    SELECT id, short_code, original_url, created_at, expires_at, user_id
    FROM urls
    WHERE short_code = $1;
  `;
  const result = await db.query(query, [shortCode]);

  if (result.rows.length === 0) {
    return { record: null, isExpired: false };
  }

  const record = result.rows[0];

  if (record.expires_at) {
    const now = new Date();
    const expiry = new Date(record.expires_at);
    if (now > expiry) {
      return { record, isExpired: true };
    }
  }

  return { record, isExpired: false };
}

/**
 * Fetch all links owned by a specific authenticated user.
 */
async function getUserLinks(userId) {
  const query = `
    SELECT u.id, u.short_code, u.original_url, u.created_at, u.expires_at,
           COUNT(c.id)::int AS total_clicks
    FROM urls u
    LEFT JOIN clicks c ON c.url_id = u.id
    WHERE u.user_id = $1
    GROUP BY u.id
    ORDER BY u.created_at DESC;
  `;
  const result = await db.query(query, [userId]);
  return result.rows;
}

/**
 * Delete a short link only if owned by the requesting user.
 */
async function deleteUserUrl(shortCode, userId) {
  const query = `
    DELETE FROM urls
    WHERE short_code = $1 AND user_id = $2
    RETURNING id, short_code;
  `;
  const result = await db.query(query, [shortCode, userId]);
  return result.rows.length > 0;
}

module.exports = {
  createShortUrl,
  getUrlByCode,
  getUserLinks,
  deleteUserUrl,
  AliasConflictError,
};
