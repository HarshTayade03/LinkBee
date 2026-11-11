const { redis, isReady } = require('../config/redis');

const DEFAULT_TTL_SECONDS = 86400;

function getUrlCacheKey(shortCode) {
  if (!shortCode || typeof shortCode !== 'string') return null;
  return `url:${shortCode.trim()}`;
}

/**
 * Get cached URL by shortCode.
 * Returns { id, originalUrl, expiresAt } or null if not cached or Redis is down.
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
    return null;
  }
}

/**
 * Set URL in cache with id and calculated TTL.
 */
async function setCachedUrl(shortCode, { id, originalUrl, expiresAt = null }) {
  if (!isReady()) return false;

  try {
    const key = getUrlCacheKey(shortCode);
    if (!key) return false;

    let ttl = DEFAULT_TTL_SECONDS;

    if (expiresAt) {
      const remainingSeconds = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      if (remainingSeconds <= 0) return false;
      ttl = Math.min(ttl, remainingSeconds);
    }

    const payload = JSON.stringify({ id, originalUrl, expiresAt });
    await redis.set(key, payload, 'EX', ttl);
    return true;
  } catch (err) {
    console.warn(`Redis SET error for code '${shortCode}': ${err.message}`);
    return false;
  }
}

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
