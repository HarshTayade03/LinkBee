# LinkBee — Intelligent Link Infrastructure

LinkBee is a production-grade URL shortener and click analytics platform. It pairs a high-throughput, cache-aside redirection engine with a clean, focused user interface designed for creators, teams, and organizers.

---

## Key Features

### Link Creation & Management
- **Guest Link Creation**: Visitors can shorten one trial link immediately without creating an account.
- **Google OAuth Authentication**: Sign in with Google to create unlimited links and manage them from a dedicated dashboard.
- **Custom Back-Halves**: Replace random codes with human-readable aliases (e.g., `linkbee.co/summer-sale`) with duplicate detection.
- **Scheduled Expiration**: Set an optional expiration timestamp. Once expired, the link returns `410 Gone` and purges from active caches.
- **Safe Link Deletion**: Owners can delete links at any time, instantly dropping database records and evicting Redis cache entries.

### Click Analytics (Privacy by Design)
- **Zero IP Address Storage**: Complies with GDPR and CCPA by never recording or storing client IP addresses.
- **Asynchronous Click Logging**: Clicks are captured in background event loops, allowing the HTTP `302 Found` redirect to resolve without waiting for database writes.
- **30-Day Click Distribution**: Aggregates daily click volume for the past month using an index-optimized scan.
- **Traffic Referrers**: Identifies top traffic sources (e.g., Direct, LinkedIn, X/Twitter, newsletters) to evaluate audience reach.

### Performance & Reliability
- **Redis Cache-Aside Architecture**: Active links are cached in Redis with randomized TTL jitter to mitigate cache stampedes.
- **Fail-Open Degradation**: If the Redis cache becomes unreachable, requests automatically fall back to PostgreSQL direct lookups without dropping user traffic.
- **Empirical Benchmarks**: Tested with Autocannon at 1,920 requests per second with a 25ms median latency and 51ms p99 at 50 concurrent connections.
- **Atomic Sliding-Window Rate Limiting**: Redis pipelines (`INCR` + `EXPIRE`) throttle abusive traffic while preserving atomic state across multiple server instances.

### Security
- **SSRF & Loopback Blocking**: Restricts input to `http:` and `https:`, validating target hostnames to block private IP spaces (RFC 1918), `localhost`, and cloud metadata endpoints (`169.254.169.254`).
- **HTTP Security Headers**: Configured with Helmet to enforce strict Content Security Policy (CSP), frame denial, and MIME type protections.
- **Safe Session Cookies**: JWT authentication uses `HttpOnly`, `SameSite=Lax`, and `Secure` cookie attributes to prevent script-based token exfiltration.

---

## Architecture Overview

```
Client Browser / API Consumer
               │
         HTTPS Port 443
               │
    Reverse Proxy / Edge CDN (Render, Cloudflare)
               │
    Node.js / Express Application
    ├── Helmet Security & Content Security Policy
    ├── Sliding-Window Rate Limiter (Redis Pipeline)
    ├── Input Sanitization & SSRF Defense
    │
    ├── Redirection Route (GET /:code)
    │     ├── 1. Check Redis Cache (Hit -> HTTP 302 Found)
    │     ├── 2. Fallback to PostgreSQL (Miss -> Populate Cache)
    │     └── 3. Background Click Logging (setImmediate)
    │
    ├── API Endpoints (/api/v1/shorten, /api/v1/user/links, /api/v1/links/:code)
    │     └── Protected by Google OAuth Session Verification
    │
    └── Static SPA Serving
          └── Serves compiled Vite React application from frontend/dist
```

---

## Tech Stack

- **Backend Runtime**: Node.js 20+, Express 5
- **Database**: PostgreSQL 16 (Relational schema, B-tree indexes, composite analytics indexing)
- **Cache & Rate Limiting**: Redis 7 (Cache-aside pattern, atomic pipelines)
- **Frontend**: React 19, Vite, Lucide Icons, clean Notion and Dub-inspired design tokens
- **Authentication**: Google OAuth 2.0 (`google-auth-library`), JSON Web Tokens (JWT)
- **Containerization & CI**: Docker, Docker Compose, GitHub Actions

---

## Quickstart (Local Development)

### Prerequisites
- Node.js 20 or higher
- Docker & Docker Compose

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
*Starts PostgreSQL on host port 5433 (internal 5432) and Redis on host port 6380 (internal 6379).*

### 3. Run Database Migrations
```bash
npm run db:migrate
```

### 4. Build Frontend & Start Server
```bash
# Install backend dependencies
npm install

# Build the React frontend
npm run build:frontend

# Run test suite
npm test

# Start the application
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## API Reference

### 1. Create a Short URL
```bash
POST /api/v1/shorten
Content-Type: application/json

{
  "originalUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP",
  "customAlias": "mdn-http",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

**Response (HTTP 201)**:
```json
{
  "success": true,
  "data": {
    "shortCode": "mdn-http",
    "shortUrl": "http://localhost:3000/mdn-http",
    "originalUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP",
    "createdAt": "2026-11-12T04:00:00.000Z",
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "isAnonymous": false
  }
}
```

### 2. Redirect to Destination
```bash
GET /mdn-http
```
**Response (HTTP 302 Found)**:
```http
HTTP/1.1 302 Found
Location: https://developer.mozilla.org/en-US/docs/Web/HTTP
X-Cache: HIT
```

### 3. List User Links (Authenticated)
```bash
GET /api/v1/user/links
Cookie: auth_token=<jwt_session>
```

### 4. View Link Analytics (Authenticated Owner)
```bash
GET /api/v1/links/mdn-http
Cookie: auth_token=<jwt_session>
```

**Response (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "shortCode": "mdn-http",
    "originalUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP",
    "createdAt": "2026-11-12T04:00:00.000Z",
    "stats": {
      "totalClicks": 142,
      "clicksByDay": [
        { "date": "2026-11-10", "clicks": 45 },
        { "date": "2026-11-11", "clicks": 97 }
      ],
      "topReferrers": [
        { "source": "Direct / None", "count": 89 },
        { "source": "https://linkedin.com", "count": 53 }
      ]
    }
  }
}
```

### 5. Delete Short Link (Authenticated Owner)
```bash
DELETE /api/v1/links/mdn-http
Cookie: auth_token=<jwt_session>
```
**Response**: `HTTP 204 No Content`.

---

## Documentation & Engineering Guides

Detailed architectural decision records, deployment runbooks, and interview preparation materials are available in the [`docs/`](docs/) directory:

- [Requirements & Threat Model](docs/00-requirements-and-design.md) — Capacity estimates, functional requirements, and threat model.
- [Architectural Decision Log](docs/decision-log.md) — 25 ADRs explaining design choices, trade-offs, and evaluated alternatives.
- [Design Brief](docs/design-brief.md) — Complete UI/UX design tokens, typography, component guidelines, and copy deck.
- [Free Tier Deployment Guide](docs/10-deployment.md) — Step-by-step zero-cost cloud deployment across Render, Neon PostgreSQL, and Upstash Redis.
- [Production Operations Runbook](docs/11-operations.md) — Health check specifications, UptimeRobot keepalive configuration, secret rotation, and link revocation.
- [Load Test Benchmarks](docs/benchmarks.md) — Autocannon performance metrics and latency distributions.
- [Interview Preparation Bank](docs/qa-bank.md) — 50+ senior backend questions covering concurrency, B-tree indexes, caching, and rate limiting.
- [Scaling Discussion](docs/scaling-discussion.md) — Scaling roadmaps from MVP to high-volume distributed environments.

---

## License

ISC License.
