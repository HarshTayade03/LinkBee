const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const redirectRoutes = require('./routes/redirect');
const config = require('./config/env');

const app = express();

// 1. HTTP Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // Enforce NO inline scripts
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow styles for simple components
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Strict CORS Configuration (locked to exact allowed origin, no wildcards)
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || config.baseUrl,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Management-Token'],
    credentials: true,
  })
);

// 3. Trust proxy settings: trust first proxy hop if configured
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// 4. Request body size limiting (10kb maximum to block payload bomb DoS)
app.use(express.json({ limit: '10kb' }));

// 5. Serve static frontend assets from /public directory
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

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

