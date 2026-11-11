# Phase 1: Core — Shorten and Redirect

---

## 1. What We Built in This Phase
In this phase, we implemented the core functionality of our URL shortener. We containerized a PostgreSQL instance using Docker Compose with an automated initialization schema, built a cryptographic Base62 random short-code generator, configured a robust database connection pool using `pg`, and implemented `POST /api/v1/shorten` to persist and return short links along with `GET /:code` to issue an HTTP `302 Found` redirect.

---

## 2. Why This Exists (The Problem It Solves)
At its most fundamental level, a URL shortener maps a compact identifier (e.g. `M2Igdd5`) to an arbitrary target URL (e.g. `https://paypal.com/engineering`). If this mapping is slow, insecure, or predictable, the system fails. This phase establishes the persistent relational backbone, prevents SQL injection via parameterized queries, ensures short codes cannot be enumerated by scrapers, and ensures repeat visits can be tracked for analytics via HTTP 302.

---

## 3. How It Works

### Flow Diagram
```
Client                      Node.js / Express                     PostgreSQL
  |                                |                                   |
  |--- POST /api/v1/shorten ------>|                                   |
  |    { originalUrl: "..." }      |--- Generate 7-char random Base62 -|
  |                                |--- INSERT INTO urls ($1, $2) ---->|
  |                                |<-- RETURNING short_code ----------|
  |<-- 201 Created (shortUrl) -----|                                   |
  |                                |                                   |
  |--- GET /:code ---------------->|                                   |
  |                                |--- SELECT original_url WHERE $1 ->|
  |                                |<-- original_url ------------------|
  |<-- 302 Found ------------------|                                   |
  |    (Location: originalUrl)     |                                   |
```

### Generation Strategy Comparison

| Strategy | How it works | Pros | Cons / Security Angle |
| :--- | :--- | :--- | :--- |
| **Auto-Increment ID + Base62** | Take the sequential DB ID (`1, 2, 3...`) and convert it to Base62 (`1, 2... a, b`). | Zero collisions; compact; fast. | **Critical Security Flaw**: Enumeration attack. Anyone can scrape `/:code` sequentially (`0000001`, `0000002`) to harvest private user links and see exactly how many links the business creates per day. |
| **UUID (v4)** | Generate 128-bit random hex string (`a9f...`). | Globally unique; impossible to guess. | Far too long (`36` characters); ruins the purpose of a *short* URL. |
| **Cryptographic Random Base62 (Chosen)** | Draw 7 random bytes using `crypto.randomBytes`, map each byte modulo 62 into `[0-9, a-z, A-Z]`. | Compact (7 chars = $62^7 \approx 3.52\text{ trillion}$ links); non-sequential; impossible to guess or harvest. | Rare chance of collision. Handled cleanly with unique database constraints and retry logic. |

---

## 4. Key Decisions & Trade-offs
See **[decision-log.md](decision-log.md)** (ADR-005, ADR-006, ADR-007).

- **High-Entropy Random Base62 vs Auto-Increment**:
  - We picked 7-character random Base62.
  - *Trade-off*: An auto-increment ID guarantees zero collisions in math, whereas random generation has a theoretical collision probability. However, with $62^7 \approx 3.52 \times 10^{12}$ possibilities, the collision rate at hundreds of millions of URLs is negligible ($< 0.001\%$), and PostgreSQL's unique constraint + retry loop catches it effortlessly without compromising security.
- **Docker Compose Host Port 5433**:
  - We mapped `5433:5432` because host machines often run existing PostgreSQL services on default port 5432. This isolates our container cleanly.

---

## 5. Code Walkthrough (Reading Order)

1. **[`docker-compose.yml`](../docker-compose.yml)** & **[`src/models/schema.sql`](../src/models/schema.sql)**:
   - Configures the `postgres:16-alpine` service and mounts `schema.sql` into `/docker-entrypoint-initdb.d/` so the `urls` table and B-Tree index on `short_code` are automatically created on container startup.
2. **[`src/config/env.js`](../src/config/env.js)**:
   - Loads environment variables using `dotenv` and performs early startup validation, exiting immediately with code 1 if `DATABASE_URL` is omitted.
3. **[`src/config/db.js`](../src/config/db.js)**:
   - Sets up a `pg.Pool` connection pool with limits (`max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 2000`). Pools reuse open TCP/TLS connections instead of incurring the overhead of a new handshake on every query.
4. **[`src/utils/base62.js`](../src/utils/base62.js)**:
   - Uses `crypto.randomBytes(7)` to sample cryptographically secure random bytes and maps them to the 62-character alphabet (`0-9`, `a-z`, `A-Z`).
5. **[`src/services/urlService.js`](../src/services/urlService.js)**:
   - Contains `createShortUrl` and `getUrlByCode`. Uses parameterized SQL (`$1, $2`). Implements retry logic: if PostgreSQL returns error code `23505` (`unique_violation`), it automatically draws a new code and retries up to 3 times.
6. **[`src/routes/api.js`](../src/routes/api.js)** & **[`src/routes/redirect.js`](../src/routes/redirect.js)**:
   - `api.js` exposes `POST /api/v1/shorten`, validating that `originalUrl` is provided and returning `201 Created`.
   - `redirect.js` handles `GET /:code`, querying PostgreSQL and returning `res.redirect(302, record.original_url)`.
7. **[`src/app.js`](../src/app.js)** & **[`src/server.js`](../src/server.js)**:
   - Mounts routes, sets a JSON body limit (`10kb`), and configures graceful shutdown (`SIGTERM`/`SIGINT`) to drain database pool connections before exiting.

---

## 6. What Can Go Wrong & How We Handle It

| Failure Case | What Happens | How the Code Handles It |
| :--- | :--- | :--- |
| **Short-code Collision** | Two concurrent requests happen to generate the exact same 7-character string. | PostgreSQL enforces `UNIQUE (short_code)` and throws error code `23505`. The `urlService` catches this specific code and loops to draw a new random code. |
| **Non-existent Short Code** | A user visits a short link that doesn't exist (`/nonexistent123`). | `getUrlByCode` returns `null`. `redirect.js` returns HTTP `404 Not Found` with a standardized JSON error object. |
| **Database Unavailable** | PostgreSQL goes down or connection is rejected. | `pg.Pool` rejects the query. The controller catches the error, logs the stack trace internally on the server, and returns a clean, sanitized HTTP `500 Internal Server Error` without leaking database paths or passwords. |
| **Sudden Server Kill / Restart** | Deployments or container restarts send `SIGTERM`. | `server.js` listens to `SIGTERM` and `SIGINT`, closes the HTTP listener to finish in-flight requests, and drains the connection pool via `pool.end()`. |

---

## 7. Security Notes

- **SQL Injection Prevention**:
  - *Attack idea*: An attacker sends `"originalUrl": "https://example.com'); DROP TABLE urls; --"`.
  - *Defense*: We use parameterized queries exclusively:
    ```javascript
    db.query('INSERT INTO urls (short_code, original_url) VALUES ($1, $2)', [shortCode, originalUrl])
    ```
    PostgreSQL treats `$1` and `$2` strictly as literal string values at the protocol level. The SQL parser never interprets input as SQL instructions.
- **Short-Code Guessing & Scraping (Enumeration)**:
  - *Attack idea*: If IDs were sequential (`1, 2, 3`), a scraper can easily write a loop to download every private link created on the platform.
  - *Defense*: A 7-character Base62 string has $62^7 \approx 3.52 \text{ trillion}$ combinations. Guessing an active code by brute force has an astronomically low success rate.

---

## 8. How We Tested It

We verified the live endpoints against our local PostgreSQL container.

### Step 1: Health Check
```bash
curl http://localhost:3000/health
```
**Output**:
```json
{"status":"ok","uptime":0.26}
```
*Proves*: Express server is alive and responding.

### Step 2: Shorten a URL
```bash
curl -X POST http://localhost:3000/api/v1/shorten \
  -H "Content-Type: application/json" \
  -d '{"originalUrl": "https://paypal.com/engineering"}'
```
**Output**:
```json
{
  "success": true,
  "data": {
    "shortCode": "M2Igdd5",
    "shortUrl": "http://localhost:3000/M2Igdd5",
    "originalUrl": "https://paypal.com/engineering",
    "createdAt": "2026-11-11T22:08:31.391Z"
  }
}
```
*Proves*: PostgreSQL accepted the parameterized insert, generated `shortCode: "M2Igdd5"`, and returned HTTP 201.

### Step 3: Test Redirection
```bash
curl -I http://localhost:3000/M2Igdd5
```
**Output**:
```http
HTTP/1.1 302 Found
Location: https://paypal.com/engineering
```
*Proves*: Server looks up `M2Igdd5`, returns HTTP 302, and sets `Location` header to the destination URL.

### Step 4: Test Non-existent Code
```bash
curl http://localhost:3000/nonexistent123
```
**Output**:
```json
{
  "success": false,
  "error": {
    "code": "URL_NOT_FOUND",
    "message": "The requested short URL does not exist."
  }
}
```
*Proves*: Non-existent codes return HTTP 404 without crashing.

---

## 9. Interview Questions (Phase 1 Drill)

Practice answering these 3 questions:

1. **Why is using an auto-incrementing database ID converted to Base62 considered an information disclosure vulnerability in a URL shortener?**
2. **What is a PostgreSQL Connection Pool (`pg.Pool`), and why is creating a new database connection for every incoming HTTP request considered a bad practice in Node.js?**
3. **If two concurrent requests generate the exact same random short-code at the exact same millisecond, what happens in the database, and how does our application handle it without failing the user's request?**

---

## 10. Common Mistakes Beginners Make Here
1. **Concatenating SQL strings**: Writing `` `INSERT INTO urls VALUES ('${shortCode}', '${url}')` ``, which creates a critical SQL Injection vulnerability.
2. **Using `Math.random()` instead of `crypto.randomBytes`**: `Math.random()` is not cryptographically secure and uses pseudo-random algorithms that can be predicted by observing preceding outputs.
3. **Not setting connection limits on the database pool**: Opening unbounded connections will quickly crash PostgreSQL with `FATAL: remaining connection slots are reserved for non-replication superuser connections`.
4. **Hardcoding database credentials**: Putting passwords directly in source code instead of `.env`.

---

## 11. Go Deeper (Optional)
- **Database Index Types**: We used a standard B-Tree index on `short_code`. Why B-Tree instead of Hash index in PostgreSQL? While Hash indexes can be slightly faster for exact match equality (`=`), B-Tree indexes in modern PostgreSQL are crash-safe, support sorting/range queries, and benefit from advanced deduplication optimizations.

