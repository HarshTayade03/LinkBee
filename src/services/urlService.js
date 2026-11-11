const db = require('../config/db');
const { generateShortCode } = require('../utils/base62');
const { generateManagementToken, hashManagementToken, constantTimeCompare } = require('../utils/token');

class AliasConflictError extends Error {
  constructor(alias) {
    super(`The custom alias '${alias}' is already in use.`);
    this.name = 'AliasConflictError';
    this.code = 'ALIAS_IN_USE';
  }
}

/**
 * Shorten a URL with optional custom alias, expiration, and secret management token.
 * Returns record and the raw management token (shown only once).
 */
async function createShortUrl({ originalUrl, customAlias = null, expiresAt = null }) {
  const rawToken = generateManagementToken();
  const tokenHash = hashManagementToken(rawToken);

  if (customAlias) {
    try {
      const query = `
        INSERT INTO urls (short_code, original_url, expires_at, mgmt_token_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, short_code, original_url, created_at, expires_at;
      `;
      const result = await db.query(query, [customAlias, originalUrl, expiresAt, tokenHash]);
      return {
        record: result.rows[0],
        managementToken: rawToken,
      };
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
        INSERT INTO urls (short_code, original_url, expires_at, mgmt_token_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, short_code, original_url, created_at, expires_at;
      `;
      const result = await db.query(query, [shortCode, originalUrl, expiresAt, tokenHash]);
      return {
        record: result.rows[0],
        managementToken: rawToken,
      };
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
    SELECT id, short_code, original_url, created_at, expires_at, mgmt_token_hash
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
 * Verify management token against the stored SHA-256 hash using constant-time comparison.
 */
function verifyManagementToken(record, providedToken) {
  if (!record || !record.mgmt_token_hash || !providedToken) {
    return false;
  }
  const providedHash = hashManagementToken(providedToken);
  return constantTimeCompare(record.mgmt_token_hash, providedHash);
}

/**
 * Delete short link and associated clicks (requires valid management token)
 */
async function deleteUrlByCode(shortCode) {
  const query = `
    DELETE FROM urls
    WHERE short_code = $1
    RETURNING id, short_code;
  `;
  const result = await db.query(query, [shortCode]);
  return result.rows.length > 0;
}

module.exports = {
  createShortUrl,
  getUrlByCode,
  verifyManagementToken,
  deleteUrlByCode,
  AliasConflictError,
};
