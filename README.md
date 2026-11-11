# ⚡ sho.rt — High-Performance, Privacy-Preserving URL Shortener

[![CI Pipeline](https://github.com/your-username/URL_short/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/URL_short/actions)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)
![Redis](https://img.shields.io/badge/Redis-7-red.svg)
![React](https://img.shields.io/badge/React-19-cyan.svg)
![Vulnerabilities](https://img.shields.io/badge/vulnerabilities-0-brightgreen.svg)

> A production-grade URL Shortener and click analytics platform built with **Node.js, Express, PostgreSQL, Redis, and React**. Engineered with a cache-aside hot path, atomic fixed-window rate limiting, cryptographic link ownership, and zero IP address logging.

---

## 🚀 Key Highlights & Empirical Benchmarks

- **Sub-2ms Redirection Latency**: Redis Cache-Aside pattern serves hot links from memory in **1.62ms**, representing a **4x speedup** over direct PostgreSQL queries.
- **High Throughput**: Benchmarked at **1,920 requests/second** with **25ms median latency** and **p99 under 51ms** at 50 concurrent connections (`docs/benchmarks.md`).
- **Privacy by Design**: Stores **zero client IP addresses** in analytics to comply with GDPR/CCPA regulations.
- **Cryptographic Access Control**: Returns a 192-bit management token once upon link creation, stored as a one-way **SHA-256 hash** and verified with constant-time comparisons (`crypto.timingSafeEqual`) to protect analytics and link deletion.
- **SSRF & XSS Defenses**: Strict URL scheme whitelisting (`http:` and `https:` only), blocking dangerous protocols (`javascript:`, `data:`, `file:`) and cloud metadata IPs (`169.254.169.254`).
- **Fail-Open Resilience**: If Redis goes down, the application logs a warning and transparently degrades to PostgreSQL without dropping user traffic.

---

## 🏗️ Architecture

```
Client Browser / API Client
          |
    HTTPS Port 443 / 80
          |
    Reverse Proxy / Cloud Edge (Render / Cloudflare)
          |
    Node.js / Express Application
    ├── Helmet Security Headers & Strict CSP
    ├── Origin-Locked CORS
    ├── Redis Pipeline Rate Limiter (INCR + EXPIRE)
    ├── Input Sanitization & SSRF Blocker
    │
    ├── Hot Redirect (GET /:code)
    │     ├── 1. Check Redis RAM (Cache Hit -> 302 Found)
    │     ├── 2. Fallback to PostgreSQL on Cache Miss (TTL Populate)
    │     └── 3. Fire-and-forget Click Analytics (setImmediate)
    │
    └── Protected Management (GET /api/v1/links/:code, DELETE)
          └── Validated against SHA-256 management token hash
```

---

## 🛠️ Quickstart (Run Locally)

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/)
- [Node.js 20+](https://nodejs.org/)

### 1. Clone & Configure Environment
```bash
git clone https://github.com/your-username/URL_short.git
cd URL_short
cp .env.example .env
```

### 2. Start PostgreSQL and Redis
```bash
docker compose up -d
```
*Spins up PostgreSQL 16 on port 5433 and Redis 7 on port 6380.*

### 3. Build & Run Application
```bash
# Install dependencies
npm install

# Build modern React frontend
npm run build:frontend

# Run tests
npm test

# Start the production server
npm start
```
Visit `http://localhost:3000` in your browser.

---

## 📡 API Reference

### 1. Create Short URL
```bash
curl -X POST http://localhost:3000/api/v1/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "originalUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP",
    "customAlias": "mdn-http",
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }'
```

**Response (HTTP 201)**:
```json
{
  "success": true,
  "data": {
    "shortCode": "mdn-http",
    "shortUrl": "http://localhost:3000/mdn-http",
    "originalUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP",
    "managementToken": "mgmt_a8f9c2d1e4b70123456789abcdef",
    "createdAt": "2026-11-12T04:00:00.000Z",
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }
}
```

### 2. Redirect to Destination
```bash
curl -I http://localhost:3000/mdn-http
```
**Response (HTTP 302)**:
```http
HTTP/1.1 302 Found
Location: https://developer.mozilla.org/en-US/docs/Web/HTTP
X-Cache: HIT
```

### 3. View Protected Analytics
```bash
curl http://localhost:3000/api/v1/links/mdn-http \
  -H "X-Management-Token: mgmt_a8f9c2d1e4b70123456789abcdef"
```

### 4. Delete Short Link
```bash
curl -X DELETE http://localhost:3000/api/v1/links/mdn-http \
  -H "X-Management-Token: mgmt_a8f9c2d1e4b70123456789abcdef"
```
**Response**: `HTTP 204 No Content`.

---

## 📚 Engineering Documentation & Interview Guide

- **[docs/00-requirements-and-design.md](docs/00-requirements-and-design.md)**: System design, capacity estimations, and threat model.
- **[docs/decision-log.md](docs/decision-log.md)**: 22 Architectural Decision Records (ADRs).
- **[docs/security-checklist.md](docs/security-checklist.md)**: Production verification checklist.
- **[docs/student-interview-log.md](docs/student-interview-log.md)**: Progress log with model answers and follow-ups.
- **[docs/benchmarks.md](docs/benchmarks.md)**: Official empirical load test measurements.
