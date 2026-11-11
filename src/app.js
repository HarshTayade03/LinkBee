const express = require('express');
const apiRoutes = require('./routes/api');
const redirectRoutes = require('./routes/redirect');

const app = express();

// Parse JSON request bodies (with 10kb limit to prevent payload bombing)
app.use(express.json({ limit: '10kb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Mount API routes under /api/v1
app.use('/api/v1', apiRoutes);

// Mount redirect routes directly on root (e.g., GET /:code)
app.use('/', redirectRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested route does not exist.',
    },
  });
});

module.exports = app;
