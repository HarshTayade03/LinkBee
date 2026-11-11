const crypto = require('crypto');

// Base62 character set: [0-9, a-z, A-Z] -> exactly 62 URL-safe characters
const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate a cryptographically secure random Base62 string.
 * Length 7 provides 62^7 = ~3.52 trillion unique combinations.
 * Unlike sequential auto-increment IDs, this does not reveal creation order
 * or business volume to competitors.
 */
function generateShortCode(length = 7) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    // Map random byte (0-255) to 0-61 using modulo
    code += BASE62_CHARS[bytes[i] % 62];
  }
  return code;
}

module.exports = {
  generateShortCode,
  BASE62_CHARS,
};

