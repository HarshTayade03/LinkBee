const db = require('../config/db');
const { generateShortCode } = require('../utils/base62');

/**
 * Shorten a URL and persist it in PostgreSQL.
 * Retries up to 3 times in the rare event of a random code collision.
 */
async function createShortUrl(originalUrl) {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const shortCode = generateShortCode(7);

    try {
      // Parameterized query ensures complete protection against SQL injection
      const query = `
        INSERT INTO urls (short_code, original_url)
        VALUES ($1, $2)
        RETURNING id, short_code, original_url, created_at;
      `;
      const result = await db.query(query, [shortCode, originalUrl]);
      return result.rows[0];
    } catch (err) {
      // Error code 23505 is PostgreSQL's unique_violation code
      if (err.code === '23505' && attempt < maxRetries - 1) {
        // Collided with an existing code; try again with a new random code
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
    SELECT id, short_code, original_url, created_at
    FROM urls
    WHERE short_code = $1;
  `;
  const result = await db.query(query, [shortCode]);
  return result.rows[0] || null;
}

module.exports = {
  createShortUrl,
  getUrlByCode,
};
