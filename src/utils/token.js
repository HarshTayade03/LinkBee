const crypto = require('crypto');

/**
 * Generate a cryptographically secure random management token.
 * Example format: "mgmt_9f8c12a7d4e56b..."
 */
function generateManagementToken() {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `mgmt_${randomBytes}`;
}

/**
 * Hash management token using SHA-256 for persistent database storage.
 * Cryptographic hashing ensures that if the database is leaked or dumped,
 * attackers cannot use the hashes to manage, inspect, or delete user links.
 */
function hashManagementToken(token) {
  if (!token || typeof token !== 'string') return null;
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Constant-time string comparison to prevent side-channel timing attacks.
 */
function constantTimeCompare(strA, strB) {
  if (!strA || !strB || typeof strA !== 'string' || typeof strB !== 'string') {
    return false;
  }
  const bufA = Buffer.from(strA);
  const bufB = Buffer.from(strB);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  generateManagementToken,
  hashManagementToken,
  constantTimeCompare,
};

