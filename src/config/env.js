require('dotenv').config();

// Validate critical environment variables early on startup
const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
};

if (!config.databaseUrl) {
  console.error('FATAL: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

module.exports = config;
