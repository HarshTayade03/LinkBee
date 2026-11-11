const db = require('../config/db');
const { generateShortCode } = require('../utils/base62');

/**
 * Custom error class for alias collision (HTTP 409 Conflict)
 */
class AliasConflictError extends Error {
  constructor(alias) {
    super(`The custom alias '${alias}' is already in use.`);
    this.name = 'AliasConflictError';
    this.code = 'ALIAS_IN_USE';
  }
}

/**
 * Shorten a URL with optional custom alias and expiration date.
 * If customAlias is provided, collision returns AliasConflictError (HTTP 409).
 * If random code is generated, collision retries up to 3 times before failing.
 */
async function createShortUrl({ originalUrl, customAlias = null, expiresAt = null }) {
  // If user requested a custom alias, perform a single insert
  if (customAlias) {
    try {
      const query = `
        INSERT INTO urls (short_code, original_url, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, short_code, original_url, created_at, expires_at;
      `;
      const result = await db.query(query, [customAlias, originalUrl, expiresAt]);
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        // Unique violation on custom alias -> HTTP 409 Conflict
        throw new AliasConflictError(customAlias);
      }
      throw err;
    }
  }

  // Otherwise, generate random code with automatic retry on collision
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const shortCode = generateShortCode(7);

    try {
      const query = `
        INSERT INTO urls (short_code, original_url, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, short_code, original_url, created_at, expires_at;
      `;
      const result = await db.query(query, [shortCode, originalUrl, expiresAt]);
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
 * Returns record and an isExpired boolean flag.
 */
async function getUrlByCode(shortCode) {
  const query = `
    SELECT id, short_code, original_url, created_at, expires_at
    FROM urls
    WHERE short_code = $1;
  `;
  const result = await db.query(query, [shortCode]);

  if (result.rows.length === 0) {
    return { record: null, isExpired: false };
  }

  const record = result.rows[0];

  // Check if link has passed its expiration timestamp
  if (record.expires_at) {
    const now = new Date();
    const expiry = new Date(record.expires_at);
    if (now > expiry) {
      return { record, isExpired: true };
    }
  }

  return { record, isExpired: false };
}

module.exports = {
  createShortUrl,
  getUrlByCode,
  AliasConflictError,
};
