# Production Security Checklist

Track our applied defenses across every phase. Verify each item prior to staging or production deployment.

## 1. Network & Transport Security
- [x] HTTPS enforced on all incoming connections (HSTS header enabled via Helmet).
- [x] Proper `trust proxy` configuration in Express (`TRUST_PROXY=true`) to prevent IP spoofing via manipulated `X-Forwarded-For` headers.
- [x] CORS locked down to authorized frontend origins only (no wildcard `*` allowed with credentials or sensitive endpoints).
- [x] Database (PostgreSQL) and Cache (Redis) isolated from public internet exposure (bound to private Docker networks / private subnets).

## 2. Input Validation & Injection Defense
- [x] All database queries parameterized; zero dynamic SQL string concatenation.
- [x] Strict URL scheme whitelisting: only `http://` and `https://` permitted.
- [x] Dangerous pseudo-schemes blocked: `javascript:`, `data:`, `file:`, `vbscript:`.
- [x] Loopback / SSRF prevention: short URLs cannot point to internal hostnames (`localhost`, `127.0.0.1`, `169.254.169.254`) or the app's own domain.
- [x] Domain blocklist active for known abusive domains (`grabify.link`, `iplogger.org`).
- [x] Custom alias character whitelist: alphanumeric and select safe delimiters only (`[a-zA-Z0-9_-]{3,30}`), with reserved keyword blocking (`api`, `health`, `docs`, etc.).
- [x] Request body size limit enforced at middleware layer (10kb maximum, rejecting oversized JSON payloads before parsing).

## 3. Authentication & Authorization
- [x] Per-link management token generated with a cryptographically secure pseudo-random number generator (`crypto.randomBytes(24)`).
- [x] Raw management tokens returned exactly once at creation; never stored in plaintext in the database.
- [x] Stored as a one-way cryptographic hash (SHA-256) in PostgreSQL (`mgmt_token_hash`).
- [x] Token verification uses constant-time comparison (`crypto.timingSafeEqual`) to resist side-channel timing attacks.
- [x] Protected endpoints (`GET /api/v1/links/:code` and `DELETE /api/v1/links/:code`) strictly require valid management token.

## 4. Rate Limiting & Resource Protection
- [x] Fixed-window rate limiter active on `/api/v1/shorten` using atomic Redis operations (`INCR` + `EXPIRE` via pipeline).
- [x] Standard rate-limiting headers exposed (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`).
- [x] HTTP `429 Too Many Requests` returned when rate quota is exceeded.
- [x] Cache keys validated and sanitized to prevent cache poisoning or memory exhaustion attacks.
- [x] Redis LRU memory eviction policy configured (`maxmemory 256mb`, `maxmemory-policy allkeys-lru`).

## 5. Output Encoding & Information Disclosure
- [x] Error responses return generic, machine-readable client error messages; zero stack traces, SQL syntax snippets, or internal paths leaked in responses.
- [x] Sensitive headers stripped (`X-Powered-By`) and defense headers set (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`).
- [x] Strict Content-Security-Policy (CSP) disallowing inline scripts (`default-src 'self'`).
- [x] Application logs scrubbed: no secret tokens, passwords, or full URLs with sensitive query parameters printed to stdout/stderr.
- [x] Privacy by Design: zero client IP addresses stored in click analytics table.

## 6. Infrastructure & Supply Chain
- [x] Automated dependency security audit (`npm audit`) passing with **0 vulnerabilities**.
- [x] All packages pinned with an immutable lockfile (`package-lock.json`).
