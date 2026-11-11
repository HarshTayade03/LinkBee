const db = require('../config/db');

/**
 * Record a click event asynchronously (fire-and-forget).
 * Does not block the HTTP redirect response.
 * Privacy-preserving: Stores NO client IP address.
 */
function recordClickAsync({ urlId, referrer, userAgent }) {
  // Fire and forget using setImmediate so event loop frees redirect immediately
  setImmediate(async () => {
    try {
      // Truncate strings to prevent DB field overflow
      const cleanReferrer = referrer ? String(referrer).substring(0, 512) : null;
      const cleanUserAgent = userAgent ? String(userAgent).substring(0, 512) : null;

      const query = `
        INSERT INTO clicks (url_id, referrer, user_agent)
        VALUES ($1, $2, $3);
      `;
      await db.query(query, [urlId, cleanReferrer, cleanUserAgent]);
    } catch (err) {
      // Log failure internally; never crash the server or affect user redirect
      console.warn(`Click analytics recording failed for urlId ${urlId}: ${err.message}`);
    }
  });
}

/**
 * Get aggregate statistics for a given url_id:
 * - totalClicks: Total count of all visits
 * - clicksByDay: Daily counts for the last 30 days
 * - topReferrers: Top 5 traffic sources
 */
async function getUrlStats(urlId) {
  // 1. Total clicks
  const totalQuery = `
    SELECT COUNT(*)::int AS total_clicks
    FROM clicks
    WHERE url_id = $1;
  `;

  // 2. Clicks per day for the last 30 days
  const dailyQuery = `
    SELECT 
      DATE(clicked_at) AS date,
      COUNT(*)::int AS clicks
    FROM clicks
    WHERE url_id = $1
      AND clicked_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(clicked_at)
    ORDER BY date ASC;
  `;

  // 3. Top 5 referrers
  const referrerQuery = `
    SELECT 
      COALESCE(referrer, 'Direct / None') AS source,
      COUNT(*)::int AS count
    FROM clicks
    WHERE url_id = $1
    GROUP BY source
    ORDER BY count DESC
    LIMIT 5;
  `;

  const [totalRes, dailyRes, referrerRes] = await Promise.all([
    db.query(totalQuery, [urlId]),
    db.query(dailyQuery, [urlId]),
    db.query(referrerQuery, [urlId]),
  ]);

  return {
    totalClicks: totalRes.rows[0].total_clicks,
    clicksByDay: dailyRes.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      clicks: row.clicks,
    })),
    topReferrers: referrerRes.rows,
  };
}

module.exports = {
  recordClickAsync,
  getUrlStats,
};

