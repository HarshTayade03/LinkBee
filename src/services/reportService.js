const db = require('../config/db');

async function createReport({ reportedUrl, reason, details, reporterUserId }) {
  const result = await db.query(
    `INSERT INTO link_reports (reported_url, reason, details, reporter_user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [reportedUrl, reason, details, reporterUserId || null]
  );
  return result.rows[0];
}

module.exports = { createReport };
