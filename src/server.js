const app = require('./app');
const config = require('./config/env');
const { pool } = require('./config/db');

const server = app.listen(config.port, () => {
  console.log(`URL Shortener server running on port ${config.port} [${config.nodeEnv}]`);
  console.log(`Base URL: ${config.baseUrl}`);
});

// Graceful shutdown on SIGTERM / SIGINT
const handleShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await pool.end();
      console.log('PostgreSQL pool drained.');
      process.exit(0);
    } catch (err) {
      console.error('Error draining database pool:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
