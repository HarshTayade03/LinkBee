const { redis, isReady } = require('../config/redis');

// Default TTL: 24 hours (86,400 seconds) for active hot links
const DEFAULT_TTL_SECONDS = 86400;

/**
 * Sanitize short code before building key to prevent cache poisoning or namespace collision
 */
function getUrlCacheKey(shortCode) {
  if (!shortCode || typeof shortCode !== 'string') return null;
  // Strip any unexpected whitespace or delimiters
  const cleanCode = shortCode.trim();
  return `url:${cleanCode}`;
}

/**
 * Get cached URL by shortCode.
 * Returns { originalUrl, expiresAt } or null if not cached or Redis is down.
 */
async function getCachedUrl(shortCode) {
  if (!isReady()) return null;

  try {
    const key = getUrlCacheKey(shortCode);
    if (!key) return null;

    const data = await redis.get(key);
    if (!data) return null;

    return JSON.parse(data);
  } catch (err) {
    console.warn(`Redis GET error for code '${shortCode}': ${err.message}`);
    return null; // Graceful degradation to DB
  }
}

/**
 * Set URL in cache with calculated TTL based on link expiration.
 */
async function setCachedUrl(shortCode, originalUrl, expiresAt = null) {
  if (!isReady()) return false;

  try {
    const key = getUrlCacheKey(shortCode);
    if (!key) return false;

    let ttl = DEFAULT_TTL_SECONDS;

    // If the link has an expiration date, calculate remaining lifetime
    if (expiresAt) {
      const remainingSeconds = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      if (remainingSeconds <= 0) {
        // Already expired, do not cache
        return false;
      }
      ttl = Math.min(ttl, remainingSeconds);
    }

    const payload = JSON.stringify({ originalUrl, expiresAt });
    await redis.set(key, payload, 'EX', ttl);
    return true;
  } catch (err) {
    console.warn(`Redis SET error for code '${shortCode}': ${err.message}`);
    return false;
  }
}

/**
 * Delete key from cache (invalidation on deletion or expiration)
 */
async function deleteCachedUrl(shortCode) {
  if (!isReady()) return false;

  try {
    const key = getUrlCacheKey(shortCode);
    if (!key) return false;
    await redis.del(key);
    return true;
  } catch (err) {
    console.warn(`Redis DEL error for code '${shortCode}': ${err.message}`);
    return false;
  }
}

module.exports = {
  getCachedUrl,
  setCachedUrl,
  deleteCachedUrl,
  getUrlCacheKey,
  DEFAULT_TTL_SECONDS,
};
