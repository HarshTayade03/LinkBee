# Production Security Checklist

Track our applied defenses across every phase. Verify each item prior to staging or production deployment.

## 1. Network & Transport Security
- [ ] HTTPS enforced on all incoming connections (HSTS header enabled via Helmet).
- [ ] Proper `trust proxy` configuration in Express to prevent IP spoofing via manipulated `X-Forwarded-For` headers.
- [ ] CORS locked down to authorized frontend origins only (no wildcard `*` allowed with credentials or sensitive endpoints).
- [ ] Database (PostgreSQL) and Cache (Redis) isolated from public internet exposure (bound to private Docker networks / private subnets).

## 2. Input Validation & Injection Defense
- [ ] All database queries parameterized; zero dynamic SQL string concatenation.
- [ ] Strict URL scheme whitelisting: only `http://` and `https://` permitted.
- [ ] Dangerous pseudo-schemes blocked: `javascript:`, `data:`, `file:`, `vbscript:`.
- [ ] Loopback / SSRF prevention: short URLs cannot point to internal hostnames (`localhost`, `127.0.0.1`, `169.254.169.254`) or the app's own domain.
- [ ] Custom alias character whitelist: alphanumeric and select safe delimiters only (`[a-zA-Z0-9_-]`), capped at a maximum length.
- [ ] Request body size limit enforced at the middleware layer (rejecting oversized payloads before JSON parsing).

## 3. Authentication & Authorization
- [ ] Per-link management token generated with a cryptographically secure pseudo-random number generator (`crypto.randomBytes`).
- [ ] Raw management tokens returned exactly once at creation; never stored in plaintext in the database.
- [ ] Token verification uses constant-time comparisons or cryptographic hashes (SHA-256) to resist timing attacks.

## 4. Rate Limiting & Resource Protection
- [ ] Fixed-window rate limiter active on `/api/v1/shorten` using atomic Redis operations (`INCR` + `EXPIRE`).
- [ ] Global rate limiting on public endpoints to deter automated brute-force enumeration of short codes.
- [ ] Cache keys validated and sanitized to prevent cache poisoning or memory exhaustion attacks.

## 5. Output Encoding & Information Disclosure
- [ ] Error responses return generic, machine-readable client error messages; zero stack traces, SQL syntax snippets, or internal paths leaked in responses.
- [ ] Sensitive headers stripped (`X-Powered-By`) and defense headers set (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`).
- [ ] Frontend strictly avoids `innerHTML`; all user and server content rendered via `textContent` or safe DOM APIs.
- [ ] Application logs scrubbed: no secret tokens, passwords, or full URLs with sensitive query parameters printed to stdout/stderr.

## 6. Infrastructure & Supply Chain
- [ ] Docker container runs as a non-privileged user (non-root UID).
- [ ] Database user granted least-privilege permissions (no `DROP TABLE` or schema-altering privileges in runtime application role).
- [ ] Automated dependency security audit (`npm audit`) passing in CI with zero high/critical vulnerabilities.
- [ ] All packages pinned with an immutable lockfile (`package-lock.json`).

