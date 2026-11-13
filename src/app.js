const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const redirectRoutes = require('./routes/redirect');
const config = require('./config/env');

const app = express();

// 1. HTTP Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://api.dicebear.com"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
  })
);

// 2. Strict CORS Configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || config.baseUrl,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// 3. Trust proxy settings: trust first proxy hop if configured
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// 4. Request body size limiting & cookie parsing
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// 5. Serve static frontend assets from /frontend/dist (or fallback to /public)
const path = require('path');
const fs = require('fs');

const reactDistPath = path.join(__dirname, '../frontend/dist');
const publicPath = path.join(__dirname, '../public');

if (fs.existsSync(reactDistPath)) {
  app.use(express.static(reactDistPath));
} else {
  app.use(express.static(publicPath));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', apiRoutes);

// SPA fallback for frontend client routing (/verify-email, etc.)
if (fs.existsSync(reactDistPath)) {
  app.get('/verify-email', (req, res) => {
    res.sendFile(path.join(reactDistPath, 'index.html'));
  });
}

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

