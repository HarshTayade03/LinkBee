const { Pool } = require('pg');
const config = require('./env');

// Create a connection pool to manage reusable database connections
const pool = new Pool({
  connectionString: config.databaseUrl,
  // Limit max connections to avoid exhausting PostgreSQL connection slots
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  // Unexpected error on idle client, log but don't crash process
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

module.exports = {
  // Helper for running parameterized queries
  query: (text, params) => pool.query(text, params),
  pool,
};

