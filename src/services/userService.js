const db = require('../config/db');

/**
 * Upsert user from verified Google profile.
 * If user exists by google_id or email, update profile and return record.
 * Otherwise, insert new user record.
 */
async function findOrCreateGoogleUser({ googleId, email, name, avatarUrl }) {
  const query = `
    INSERT INTO users (google_id, email, name, avatar_url)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (google_id) DO UPDATE
    SET name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url
    RETURNING id, google_id, email, name, avatar_url, created_at;
  `;
  const result = await db.query(query, [googleId, email, name, avatarUrl]);
  return result.rows[0];
}

async function getUserById(id) {
  const query = `
    SELECT id, google_id, email, name, avatar_url, created_at
    FROM users
    WHERE id = $1;
  `;
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
}

module.exports = {
  findOrCreateGoogleUser,
  getUserById,
};
