# 50+ Senior Backend & PayPal Interview Q&A Bank

This question-and-answer bank covers the most frequent system design, concurrency, database, caching, and security questions asked by top engineering companies (PayPal, Stripe, Uber, Amazon).

---

## Category 1: System Design & Architecture (Questions 1–12)

### Q1: Why did you choose a 7-character Base62 encoding for short codes?
**Answer**:
Base62 uses alphanumeric characters `[0-9a-zA-Z]`, eliminating URL-unsafe characters (like `+`, `/`, `=`, or `?`). 
A 7-character string provides $62^7 = 3,521,614,606,208$ (over 3.52 trillion) unique combinations. At a creation rate of 1,000 links per second, it would take over 111 years to exhaust the namespace. It is compact enough for SMS and social media while providing virtually limitless headroom.

### Q2: What is the collision probability in randomized Base62 generation?
**Answer**:
Using the Birthday Problem approximation:
$$P \approx 1 - e^{-\frac{n^2}{2N}}$$
Where $N = 62^7 \approx 3.52 \times 10^{12}$. For $n = 1,000,000$ links:
$$P \approx 1 - e^{-\frac{10^{12}}{7.04 \times 10^{12}}} \approx 1 - e^{-0.142} \approx 13\%$$
However, with a database unique index and an immediate retry loop (up to 3 attempts), the probability of two consecutive collisions on generation is negligible ($< 0.01\%$). If the database returns error code `23505` (unique violation), the service generates a fresh token and retries.

### Q3: Why not use auto-incrementing database IDs encoded into Base62?
**Answer**:
1. **Security / Enumeration attacks**: Sequential IDs allow scrapers to iterate from `1` to `N` and download the entire link database.
2. **Business leakage**: Competitors can shorten two links at the start and end of a week, subtract the IDs, and know exactly how many transactions your platform processed.
3. **Single Point of Bottleneck**: Sequential IDs require a centralized counter or auto-incrementing primary key, which creates database write contention in distributed multi-master setups.

### Q4: Why use 302 Found instead of 301 Moved Permanently for redirection?
**Answer**:
A `301 Moved Permanently` response instructs the browser to cache the redirection target indefinitely in its local HTTP cache. Subsequent clicks from that user bypass our server entirely.
- In a URL shortener, we want every click to reach our server so we can record **click analytics** and enforce **link expiration**.
- `302 Found` (or `307 Temporary Redirect`) ensures the browser re-queries our server on every click, allowing accurate tracking and immediate revocation.

### Q5: How would you handle a thundering herd (cache stampede) on an expired viral link?
**Answer**:
When a viral shortlink expires from Redis, hundreds or thousands of concurrent requests could miss the cache simultaneously and query PostgreSQL in parallel.
Solutions:
1. **Probabilistic Early Expiration (XFetch algorithm)**: Recompute and refresh the cache key before it expires based on read frequency and compute time.
2. **Distributed Mutex / Lock**: Use `SET lock:key <token> NX PX 5000` in Redis. Only the request that acquires the lock queries the DB; the other requests wait briefly and re-read Redis.
3. **Randomized TTL Jitter**: In our implementation, we add randomized jitter ($\pm 10\%$) to the 24-hour TTL so adjacent keys do not expire at the exact same second.

### Q6: How do you design for a 100:1 Read-to-Write ratio?
**Answer**:
1. **Cache aggressively**: Use Redis to intercept $>90\%$ of read traffic.
2. **Database Read Replicas**: Direct all read-miss queries to read-only replicas using a connection pool, keeping the primary PostgreSQL node dedicated to inserts and user updates.
3. **Asynchronous analytics**: Do not block redirection responses on write queries.

### Q7: Why did you bundle the React frontend with the Express backend instead of deploying separately?
**Answer**:
For our application size, a unified deployment offers three advantages:
1. **Zero CORS overhead**: API requests are same-origin (`/api/...`), eliminating preflight `OPTIONS` latency and CORS misconfigurations.
2. **Simplified cookie handling**: `SameSite=Lax` or `SameSite=Strict` cookies work seamlessly without cross-domain third-party cookie restrictions.
3. **Single deployment artifact**: Render or Docker deploys a single container running both static assets and API endpoints, eliminating synchronization drift between frontend and backend versions.

### Q8: When would you split frontend and backend into separate services?
**Answer**:
In an enterprise organization with separate teams:
1. **Independent deployment velocity**: Frontend teams deploy UI changes multiple times an hour via Edge CDNs (e.g., Cloudflare Pages, Vercel) without restarting backend microservices.
2. **Edge caching**: Static assets are distributed globally across hundreds of edge locations, minimizing latency to under 10ms worldwide.
3. **Resource scaling**: Backend containers scale on CPU/memory based on API traffic without paying for static file delivery.

### Q9: How would you implement custom branded domains (e.g., `paypal.me/pay`)?
**Answer**:
1. The customer configures a CNAME record pointing their domain (e.g., `link.acme.com`) to our edge server.
2. Use an edge reverse proxy (such as Cloudflare for SaaS or Envoy) with automated SSL provisioning via Let's Encrypt.
3. In PostgreSQL, maintain a `domains` table mapping `link.acme.com` to `tenant_id`.
4. During redirection, parse `req.hostname`, resolve the domain, and scope the short code lookup to that tenant.

### Q10: How would you implement geo-targeted redirects (routing US users to `.com` and UK users to `.co.uk`)?
**Answer**:
1. Leverage Cloudflare / CloudFront edge headers (e.g., `cf-ipcountry`).
2. Store routing rules as a JSON object inside the URL record: `{"US": "https://site.com", "GB": "https://site.co.uk", "default": "https://site.com"}`.
3. During redirection, check `req.headers['cf-ipcountry']`, match against the rule map, and redirect accordingly.

### Q11: What happens if a user submits a circular redirect (shortening a shortened link)?
**Answer**:
A user could shorten `https://our-shortener.com/abc` into `https://our-shortener.com/xyz`. If chained, this creates an infinite loop or denial of service.
**Defense**: In [`src/middlewares/validate.js`](file:///D:/URL_short/src/middlewares/validate.js), we check if the hostname of the target URL matches our own domain (`config.baseUrl`). If it matches, we reject the request with `400 Bad Request: Circular shortening is not permitted`.

### Q12: How do you handle deep links (mobile app URLs like `spotify://` or `slack://`)?
**Answer**:
By default, we whitelist only `http:` and `https:` to protect against dangerous URI schemes like `javascript:`, `file:`, or `data:`. If mobile deep linking is required, we create an explicit whitelist (`spotify:`, `slack:`, `tel:`) and implement fallback web landing pages with Apple Universal Links and Android App Links.

---

## Category 2: Databases & PostgreSQL (Questions 13–24)

### Q13: What index did you put on the `urls` table and why?
**Answer**:
A unique B-tree index on `urls(short_code)`:
```sql
CREATE INDEX idx_urls_short_code ON urls(short_code);
```
B-tree indexes provide $O(\log N)$ lookup time. Because `short_code` is unique and high cardinality, PostgreSQL traverses the index in 2–3 disk page reads (typically cached in memory in the Postgres shared buffer pool), executing queries in sub-millisecond time.

### Q14: Explain the composite index on the `clicks` table.
**Answer**:
We created:
```sql
CREATE INDEX idx_clicks_url_id_clicked_at ON clicks(url_id, clicked_at DESC);
```
- **Column order matters**: In B-tree indexes, equality conditions must come first, followed by range/sort conditions (the Left-to-Right rule).
- When a user views analytics for a specific URL for the last 30 days:
  ```sql
  SELECT clicked_at, referrer, user_agent 
  FROM clicks 
  WHERE url_id = $1 AND clicked_at >= $2 
  ORDER BY clicked_at DESC;
  ```
- PostgreSQL performs an **Index Scan** directly on the composite index: it jumps to `url_id = $1`, reads the already-sorted `clicked_at` dates in reverse chronological order, and stops. It requires zero in-memory sorting (`Sort Method: none`).

### Q15: What is an Index-Only Scan and how do you achieve it?
**Answer**:
An Index-Only Scan occurs when PostgreSQL can satisfy an entire SQL query directly from the B-tree index pages without fetching rows from the heap (the table storage).
For example, to count clicks for a link:
```sql
SELECT count(*) FROM clicks WHERE url_id = $1;
```
If the index contains `(url_id)`, Postgres only scans the index tree, reducing I/O by $80\text{--}90\%$.

### Q16: How do you handle table bloat on the `clicks` table in production?
**Answer**:
A high-traffic shortener can accumulate hundreds of millions of click rows:
1. **Partitioning**: Partition the `clicks` table by range on `clicked_at` (e.g., monthly partitions). Dropping old data becomes an $O(1)$ DDL operation (`DROP TABLE clicks_2025_01`) rather than an expensive `DELETE` with vacuuming overhead.
2. **Autovacuum tuning**: Increase `autovacuum_vacuum_scale_factor` and `autovacuum_cost_limit` so worker threads clean dead tuples promptly.
3. **Data rollups**: Run a nightly cron job to aggregate hourly/daily click counts into an OLAP table and purge granular raw events older than 90 days.

### Q17: Why use `BIGSERIAL` instead of `UUID` for internal primary keys?
**Answer**:
1. **Storage footprint**: `BIGSERIAL` is 8 bytes; `UUID` is 16 bytes. Across primary keys and foreign keys in millions of rows, UUID doubles index storage.
2. **B-tree fragmentation**: Random v4 UUIDs insert out-of-order, causing frequent B-tree page splits, cache thrashing, and degraded write throughput.
3. **Read performance**: Monotonically increasing 64-bit integers insert sequentially at the end of the leaf page, keeping index pages compact.

### Q18: What is connection pooling and why is it necessary with PostgreSQL?
**Answer**:
PostgreSQL uses a process-based concurrency model (one OS process per connection). Establishing a connection requires a TLS handshake, authentication, process fork, and backend initialization, costing 20–50ms.
- Without pooling, 500 concurrent HTTP requests would spawn 500 Postgres processes, exhausting server memory and causing connection refusal.
- A connection pool (like `pg.Pool` or `PgBouncer`) maintains a warm set of reusable connections (e.g., 20 connections). Requests borrow a connection for the duration of a query and return it immediately, handling thousands of queries with minimal OS overhead.

### Q19: What is the risk of database deadlocks and how did you prevent them?
**Answer**:
Deadlocks occur when two transactions each hold a lock the other requires. In our shortener, URLs and users are read heavily but updated infrequently. Inserts to `urls` and `clicks` are single-statement inserts that acquire short-lived row-exclusive locks. Because we do not run multi-table transactions with cross-dependent lock ordering, deadlocks are structurally prevented.

### Q20: How do you handle migrations without zero-downtime failures?
**Answer**:
1. Never use `ALTER TABLE ... ADD COLUMN ... DEFAULT <non-null-expensive-expr>` on high-traffic tables without Postgres 11+ metadata defaults.
2. Always add indexes with `CONCURRENTLY`:
   ```sql
   CREATE INDEX CONCURRENTLY idx_urls_created_at ON urls(created_at);
   ```
   This prevents acquiring an exclusive table lock that would stall reads and writes.

---

## Category 3: Caching & Redis (Questions 21–32)

### Q21: What is the Cache-Aside (Lazy Loading) pattern?
**Answer**:
In Cache-Aside:
1. The application checks the cache (Redis) first.
2. If found (Cache Hit), it returns the data immediately.
3. If not found (Cache Miss), the application queries the database (PostgreSQL), writes the result to Redis with a TTL, and returns the response.
- **Advantage**: The cache contains only data that is actually requested. Node failure does not cause data loss since the database remains the source of truth.

### Q22: Why did you set `enableOfflineQueue: false` in ioredis?
**Answer**:
By default, `ioredis` buffers commands in memory when the connection is lost and replays them when reconnected. 
- In a high-traffic HTTP server, if Redis goes down for 30 seconds, buffering thousands of requests causes memory bloat and hangs client connections until timeouts fire.
- Setting `enableOfflineQueue: false` causes Redis calls to fail immediately, triggering our fail-open fallback to PostgreSQL in under 1ms instead of hanging the client.

### Q23: How do you ensure cache consistency when a link is deleted or edited?
**Answer**:
We use **Cache Eviction on Write (Write-Invalidate)**:
When a user deletes a shortlink via `DELETE /api/links/:code`:
1. Delete the record from PostgreSQL: `DELETE FROM urls WHERE short_code = $1`.
2. Immediately execute `redis.del('url:' + code)` to purge the cached record.
3. If the cache delete fails, the TTL acts as a backstop, expiring the record within 24 hours.

### Q24: What Redis data structure did you choose and why?
**Answer**:
For link redirection, we use simple Redis **Strings** (`SET url:abc1234 "https://example.com" EX 86400`).
- **Why**: String key-value lookups (`GET`) have $O(1)$ time complexity and minimal memory overhead.
- For rate limiting, we use Redis Strings with `INCR` and `EXPIRE`.

### Q25: How does Redis eviction work when memory is full?
**Answer**:
Redis supports several eviction policies configured via `maxmemory-policy`:
1. `volatile-lru` or `allkeys-lru`: Evicts least-recently-used keys first.
2. `volatile-ttl`: Evicts keys with the shortest remaining TTL.
3. `noeviction`: Returns errors on write operations when memory is full.
For a URL shortener cache, **`allkeys-lru`** is optimal because it automatically drops cold, forgotten links while keeping viral, actively-clicked links in memory.

---

## Category 4: Concurrency, Rate Limiting & Scaling (Questions 33–42)

### Q26: Explain how your Redis sliding-window rate limiter prevents race conditions.
**Answer**:
In a distributed environment with multiple Node.js instances, two requests arriving at the exact same millisecond could both read `count = 9`, both believe they are under a 10-request limit, and both allow the action (a classic check-then-act race condition).
- We prevent this using an **atomic Redis multi/pipeline**:
  ```javascript
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, windowSeconds);
  const results = await pipeline.exec();
  ```
- Because Redis is single-threaded in its execution engine, `INCR` is guaranteed to be atomic. The returned count is monotonically incremented, completely eliminating race conditions.

### Q27: How does your asynchronous click tracking work without affecting redirect latency?
**Answer**:
In [`src/routes/redirect.js`](file:///D:/URL_short/src/routes/redirect.js):
```javascript
// 1. Immediately send 302 redirect to client
res.redirect(302, originalUrl);

// 2. Schedule DB insert in the next tick of the event loop
setImmediate(async () => {
  try {
    await analyticsService.recordClick(urlId, referrer, userAgent);
  } catch (err) {
    console.error('Click tracking error:', err.message);
  }
});
```
The client browser receives the HTTP response headers and navigates immediately. The Node.js event loop schedules the `recordClick` database write during the next event loop iteration.

### Q28: What is the risk of using `setImmediate` for analytics at massive scale?
**Answer**:
If the server is receiving 10,000 requests per second and PostgreSQL can only process 2,000 writes per second:
1. Unprocessed `setImmediate` closures accumulate in Node.js memory.
2. Memory consumption climbs continuously, eventually triggering an Out-Of-Memory (OOM) crash.
3. **Enterprise Solution**: Instead of direct database writes in-process, push click events to an external message broker like **Apache Kafka**, **AWS SQS**, or a **Redis Stream**. A dedicated consumer service pulls events in batches and bulk-inserts them into an analytics database like ClickHouse or Snowflake.

### Q29: How would you scale this system from 2,000 to 100,000 requests per second?
**Answer**:
1. **Edge Redirection**: Move the redirection logic to Cloudflare Workers or AWS Lambda@Edge using Cloudflare KV or Upstash Redis at the edge. Over $95\%$ of redirections would be resolved at the nearest CDN Point of Presence (PoP) in $<10\text{ms}$.
2. **Database Sharding**: Shard the PostgreSQL database by `hash(short_code) % N` across multiple database instances.
3. **Kafka Event Streaming**: Decouple click tracking completely through Kafka partitions to process millions of clicks asynchronously.
4. **Read Replicas**: Deploy regional read replicas in US-East, US-West, and Europe.

---

## Category 5: Security, Auth & Networking (Questions 43–52)

### Q30: What is Server-Side Request Forgery (SSRF) and how did you prevent it?
**Answer**:
SSRF occurs when an attacker inputs a URL pointing to internal private infrastructure (e.g., `http://169.254.169.254/latest/meta-data/` on AWS or `http://localhost:5432`). If a server visits or previews that URL, the attacker extracts internal credentials or maps the private network.
- **Our Defense**:
  1. We parse the hostname using Node's `URL` class.
  2. We reject `localhost`, `127.0.0.1`, and explicit IP literals.
  3. We resolve DNS and reject private IP subnets (RFC 1918 ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and cloud metadata addresses (`169.254.169.254`).

### Q31: Why use HTTP-only, SameSite cookies instead of localStorage for JWT tokens?
**Answer**:
- **localStorage** is accessible by any JavaScript code running on the domain. If the application has any Cross-Site Scripting (XSS) vulnerability, an attacker can execute `localStorage.getItem('token')` and steal the user's session permanently.
- **`HttpOnly` cookies** cannot be read by client-side JavaScript, rendering session tokens immune to XSS theft.
- **`SameSite=Lax`** guarantees that cookies are not sent on cross-site sub-resource requests (e.g., cross-origin `fetch` or image requests), preventing Cross-Site Request Forgery (CSRF).

### Q32: What is the purpose of `trust proxy: 1` in Express?
**Answer**:
When Express sits behind a reverse proxy (such as Render, Nginx, or AWS ALB), the direct TCP connection comes from the proxy's IP (e.g., `10.0.0.5`), not the client's public IP.
- `app.set('trust proxy', 1)` instructs Express to read the client's real IP from the `X-Forwarded-For` header, trusting only 1 upstream proxy hop.
- Without this, every user shares the proxy's internal IP, causing rate limiters to block all global users as if they were a single person.

### Q33: How does your system protect user privacy regarding GDPR and IP addresses?
**Answer**:
Under GDPR and CCPA, IP addresses are classified as Personal Identifiable Information (PII).
- Storing raw IP addresses in the `clicks` table requires user consent banners, data deletion mechanisms, and privacy audits.
- We deliberately **do not store IP addresses** in the `clicks` table. We only record timestamp, referrer hostname, and sanitized browser User-Agent family, providing actionable creator analytics while preserving user privacy by design.

### Q34: What HTTP security headers did you implement with Helmet and why?
**Answer**:
1. **Content-Security-Policy (CSP)**: Restricts script, style, and iframe sources, preventing inline script injection.
2. **X-Content-Type-Options: nosniff**: Prevents MIME-type sniffing attacks.
3. **Strict-Transport-Security (HSTS)**: Forces browsers to communicate exclusively over HTTPS.
4. **X-Frame-Options: DENY**: Prevents clickjacking by forbidding embedding the application in iframes.

