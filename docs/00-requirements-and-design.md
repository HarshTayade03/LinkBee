# Phase 0: Requirements, Architecture Design & Threat Model

---

## 1. What We Built in This Phase
In this phase, we established the blueprint for our production-ready URL shortener before writing any code. We defined our functional and non-functional requirements, designed the REST API contracts, conducted capacity estimations (reads vs. writes), formulated the database schema, laid out a modular codebase structure, and developed an undergraduate-to-interview level threat model detailing potential vectors of abuse and our phase-by-phase defenses.

---

## 2. Why This Exists (The Problem It Solves)
Jumping straight into code without a concrete system design and threat model leads to costly refactors, unaddressed security vulnerabilities (such as open redirects or enumeration attacks), and poor latency profiles under load. URL shorteners look deceivingly simple, but at scale they require a read-heavy optimization strategy (typically a 10:1 or 100:1 read-to-write ratio), strict data validation, and abuse prevention. Establishing clear architectural bounds upfront ensures our software is robust, secure, and easily explainable in an engineering interview.

---

## 3. How It Works

### High-Level Architecture
```
                         +-----------------------------+
                         |      Client Browser /       |
                         |   Consumer (curl / App)     |
                         +--------------+--------------+
                                        |
                         HTTPS (Port 443 / 80)
                                        |
                                        v
                         +-----------------------------+
                         | Reverse Proxy / Edge Router |
                         | (Cloudflare / Host Ingress) |
                         +--------------+--------------+
                                        |
                         Forwards client IP (X-Forwarded-For)
                                        |
                                        v
                 +---------------------------------------------+
                 |       Node.js / Express Application         |
                 |                                             |
                 |  - Security Middleware (Helmet, CORS)       |
                 |  - Body Size Limiting & Rate Limiter        |
                 |  - Input Validation & Scheme Sanitization   |
                 +--------------+---------------+--------------+
                                |               |
                     Cache Read |               | Cache Miss /
                    (Short URL) |               | Write Operation
                                v               v
                 +-------------------+  +----------------------+
                 |   Redis Cache     |  | PostgreSQL Database  |
                 |  (Cache-Aside,    |  | (Primary persistent  |
                 |  TTL, Rate Limits)|  |  storage & indexes)  |
                 +-------------------+  +----------------------+
```

### Core Request Lifecycles

#### A. Creation Flow (`POST /api/v1/shorten`)
1. Client submits `{ "originalUrl": "https://example.com/long-page", "customAlias": "optional-code", "expiresAt": null }`.
2. App validates the payload: checks URL syntax, confirms protocol is strictly `http` or `https`, ensures URL does not point to internal IP ranges (SSRF) or our own domain (redirect loops), and checks body size limits.
3. Rate limiter checks whether the client's IP has exceeded the allowed creation quota in Redis.
4. App generates a short code (or verifies availability of the requested custom alias).
5. App generates a cryptographically secure random management token (`mgmt_...`).
6. App hashes the management token using SHA-256 and persists `{ short_code, original_url, mgmt_token_hash, created_at, expires_at }` to PostgreSQL.
7. App returns HTTP 201 Created with the shortened URL and the raw management token (shown once).

#### B. Redirection Flow (`GET /:code`)
1. Client browser visits `https://sho.rt/:code`.
2. Application checks Redis cache for key `url:{code}`.
3. **Cache Hit**:
   - Return HTTP 302 Found immediately with `Location: <originalUrl>`.
   - Asynchronously trigger click analytics recording.
4. **Cache Miss**:
   - Query PostgreSQL by `code`.
   - If not found or expired: return HTTP 404 Not Found or 410 Gone.
   - If found: write to Redis with a TTL (Time-To-Live).
   - Return HTTP 302 Found with `Location: <originalUrl>`.
   - Asynchronously trigger click analytics recording.

---

## 4. Key Requirements & API Specifications

### Functional Requirements
- **Create Short URL**: Given any valid HTTP/HTTPS URL, produce a compact URL.
- **Custom Alias**: Users may specify an optional custom short code (alphanumeric, 3–30 characters).
- **Expiration**: Users may specify an optional expiry timestamp; expired links return HTTP 410 Gone.
- **Redirection**: Visiting `/:code` redirects to the original destination with HTTP 302.
- **Click Analytics**: Track click count, timestamp, HTTP referer, and parsed user-agent per short code.
- **Management Protection**: Only holders of the secret management token returned at creation can view analytics or delete a short link.

### Non-Functional Requirements
- **High Read Throughput & Low Latency**: Redirections should resolve in under 15ms (p95) when cached in Redis.
- **High Availability for Redirects**: If Redis becomes unavailable, the system must degrade gracefully by falling back directly to PostgreSQL without crashing.
- **Data Integrity**: Zero URL collisions allowed, guaranteed by database unique constraints.
- **Privacy by Design**: Never store full raw client IP addresses. Truncate/hash IP addresses if needed for abuse detection, or store only aggregated counts.

### API Contract

| Method | Endpoint | Description | Expected Status Codes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/shorten` | Create a shortened URL | `201 Created`, `400 Bad Request`, `409 Conflict`, `429 Too Many Requests` |
| `GET` | `/:code` | Redirect to original URL | `302 Found`, `404 Not Found`, `410 Gone` |
| `GET` | `/api/v1/links/:code` | Get link metadata & analytics | `200 OK`, `401 Unauthorized`, `404 Not Found` |
| `DELETE` | `/api/v1/links/:code` | Delete a shortened link | `204 No Content`, `401 Unauthorized`, `404 Not Found` |
| `GET` | `/health` | Liveness & readiness probe | `200 OK`, `503 Service Unavailable` |

#### Payload Examples:

##### `POST /api/v1/shorten` Request
```json
{
  "originalUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP",
  "customAlias": "mdn-http",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

##### `POST /api/v1/shorten` Response (HTTP 201)
```json
{
  "success": true,
  "data": {
    "shortCode": "mdn-http",
    "shortUrl": "http://localhost:3000/mdn-http",
    "originalUrl": "https://developer.mozilla.org/en-US/docs/Web/HTTP",
    "createdAt": "2026-11-12T03:00:00.000Z",
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "managementToken": "mgmt_a8f9c2d1e4b70123456789abcdef"
  }
}
```

##### Error Response Standard
```json
{
  "success": false,
  "error": {
    "code": "INVALID_URL",
    "message": "The provided URL scheme must be either http or https.",
    "details": null
  }
}
```

---

## 5. Capacity Estimation (Interview Perspective)

Interviewers at companies like PayPal love seeing clean, order-of-magnitude estimations.

### Assumptions:
- **Write Volume**: 100 URL creations per second (new links).
- **Read-to-Write Ratio**: 100:1 (typical web read-heavy distribution).
- **Read Volume**: 10,000 redirections per second.
- **Retention Period**: Store links for an average of 5 years.

### Calculation:
1. **Total Writes over 5 Years**:
   $$\text{Writes/day} = 100 \times 86{,}400 \approx 8.64\text{ million/day}$$
   $$\text{Writes/year} = 8.64\text{M} \times 365 \approx 3.15\text{ billion/year}$$
   $$\text{Writes in 5 years} = 3.15\text{B} \times 5 \approx 15.75\text{ billion links}$$

2. **Storage Per Record**:
   - `id` (BIGSERIAL / 8 bytes)
   - `short_code` (VARCHAR(16) / ~16 bytes)
   - `original_url` (VARCHAR(2048) / ~200 bytes average)
   - `mgmt_token_hash` (CHAR(64) / 64 bytes)
   - `created_at` (TIMESTAMP / 8 bytes)
   - `expires_at` (TIMESTAMP / 8 bytes)
   - Database index overhead / padding: ~150 bytes
   - **Total per record**: ~450–500 bytes.

3. **Total Database Storage (5 Years)**:
   $$15.75\text{ billion} \times 500\text{ bytes} \approx 7.875\text{ Terabytes}$$
   *Takeaway*: 8 TB is very manageable on standard relational storage with partitioning or standard read-replica configurations.

4. **Cache Sizing (80/20 Pareto Rule)**:
   - 20% of the links generate 80% of daily redirect traffic.
   - Daily active links: ~10 million URLs accessed per day.
   - Cache size for 20% working set: $2{,}000{,}000 \times 500\text{ bytes} \approx 1\text{ GB}$.
   - *Takeaway*: A 2 GB to 4 GB Redis instance easily holds the entire hot working set in RAM!

---

## 6. Initial Data Model

We use standard PostgreSQL tables with strict constraints and foreign keys.

```sql
-- Table: urls
CREATE TABLE urls (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(32) NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    mgmt_token_hash CHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_urls_short_code ON urls(short_code);
CREATE INDEX idx_urls_expires_at ON urls(expires_at) WHERE expires_at IS NOT NULL;

-- Table: clicks
CREATE TABLE clicks (
    id BIGSERIAL PRIMARY KEY,
    url_id BIGINT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    referrer VARCHAR(512) NULL,
    user_agent VARCHAR(512) NULL
);

CREATE INDEX idx_clicks_url_id_clicked_at ON clicks(url_id, clicked_at DESC);
```

---

## 7. Folder Structure
The codebase uses a clear, layered, modular layout that is easy to read and maintain:

```
URL_short/
├── docker-compose.yml       # Local services (PostgreSQL, Redis)
├── Dockerfile               # Production multi-stage container
├── .env.example             # Documented template for environment variables
├── .gitignore               # Strict ignore list (node_modules, .env, coverage)
├── package.json             # Pinned dependencies and operational scripts
├── docs/                    # All documentation, ADRs, study guides & interviews
│   ├── 00-index.md
│   ├── 00-requirements-and-design.md
│   ├── decision-log.md
│   └── security-checklist.md
└── src/
    ├── app.js               # Express application initialization & middleware
    ├── server.js            # HTTP server startup & graceful shutdown
    ├── config/              # Centralized environment variables & db configs
    │   ├── db.js            # PostgreSQL connection pool
    │   ├── redis.js         # Redis client connection
    │   └── env.js           # Env validation & defaults
    ├── routes/              # HTTP Route endpoints
    │   ├── redirect.js      # GET /:code (Hot path)
    │   ├── api.js           # POST /api/v1/shorten, GET /api/v1/links/:code
    │   └── health.js        # GET /health
    ├── controllers/         # Request handling & orchestration
    ├── services/            # Core business logic (generation, caching, analytics)
    ├── middlewares/         # Validation, rate limiting, error handling, security
    └── utils/               # Code generators, validators, hashers
```

---

## 8. Threat Model & Abuse Analysis

A public URL shortener is an attractive target for malicious actors on the internet. Here is our threat analysis and our mitigation plan:

| Threat / Attack Vector | Real-World Scenario / Impact | Severity | Mitigation Strategy | Phase Addressed |
| :--- | :--- | :--- | :--- | :--- |
| **Phishing / Malware Distribution** | Malicious users disguise malware links or phishing pages behind legitimate-looking short URLs. | High | Input validation, domain blocklist, loopback/SSRF blocking. In production, integration with Google Safe Browsing API. | Phase 2, Phase 6 |
| **Open Redirect / SSRF Loopback** | Attacker creates links to `http://169.254.169.254` (cloud metadata) or `http://localhost:3000` to probe private networks or trigger redirect loops. | Critical | Strict scheme validation (reject `file:`, `javascript:`, `data:`), block internal IP addresses and self-domain redirects. | Phase 2, Phase 6 |
| **Spam Creation / Resource Exhaustion** | Botnet floods `POST /shorten` to fill up database disk space or exhaust short code namespaces. | High | IP-based Redis atomic rate limiting, body size limits, input length caps. | Phase 2, Phase 5 |
| **Enumeration / Harvesting Attacks** | Competitors or scrapers iterate sequentially through short codes (`/000001`, `/000002`) to discover private internal links. | High | Cryptographically random / pseudo-random high-entropy short codes rather than raw auto-increment sequential IDs. | Phase 1 |
| **Stats Scraping & Privacy Leaks** | Anyone viewing `GET /stats/:code` can observe when and how often sensitive links are clicked. | Medium | Ephemeral management token model; stats endpoint requires valid token header/query. | Phase 6 |
| **Denial of Service (DoS) on Redirects** | High-volume traffic spike crushes the relational database on hot links. | High | Redis cache-aside layer offloads 95%+ of read queries away from PostgreSQL. | Phase 3 |
| **SQL Injection** | Attacker inserts SQL fragments into the alias or search queries to read database contents. | Critical | 100% parameterized SQL queries via `pg`; zero dynamic string interpolation. | Phase 1–12 |
| **Cross-Site Scripting (XSS)** | Malicious URLs or referrers containing `<script>` executed in the dashboard UI. | High | Strict Content-Security-Policy (CSP), context-aware output encoding, rendering data via `textContent` rather than `innerHTML`. | Phase 6, Phase 7 |

---

## 9. Key Decisions & Alternatives
See **[decision-log.md](decision-log.md)** for full context on ADR-001 through ADR-005.

1. **Separation of Redirect Route from API Route**:
   - *Choice*: Keep hot path `/:code` distinct from `/api/v1/*`.
   - *Alternative*: Put everything under `/api/v1`.
   - *Reason*: Short URLs must be as brief as possible (`domain.com/abc` vs `domain.com/api/v1/abc`).

2. **Management Token vs Full User Authentication**:
   - *Choice*: Per-link secret management token returned once at creation.
   - *Alternative*: Full user account, email verification, passwords, and sessions.
   - *Reason*: Preserves full focus on backend systems, performance, caching, and fundamental web security without diluting learning into authentication boilerplate.

---

## 10. Interview Questions (Phase 0 Drill)

Here are 3 interview-style questions based on this phase:

1. **Why do we choose HTTP 302 (Found) instead of HTTP 301 (Moved Permanently) for URL shorteners? What happens if you pick 301?**
2. **If we expect 10,000 redirects per second, why can't a single standard relational database handle it directly, and how does the cache-aside pattern change the equation?**
3. **What is an Open Redirect vulnerability in the context of a URL shortener, and why would an attacker use our service to carry out phishing attacks?**
