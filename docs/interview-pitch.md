# Interview Pitch: The 90-Second & 3-Minute Architectural Walkthrough

> **Audience**: Staff Software Engineers, Engineering Managers, and Technical Leads (e.g., PayPal, Stripe, Uber, Meta).  
> **Objective**: Present the project as an engineered distributed system solving real scalability, consistency, and security challenges—not just a student CRUD app.

---

## 1. The 90-Second Elevator Pitch

"I built a production-grade, distributed URL shortener designed for high-throughput read workloads with sub-millisecond cache latency, Google OAuth multi-tenancy, and privacy-preserving analytics.

The core challenge in a URL shortener is the extreme read-to-write asymmetry—often 100 to 1 in production. To handle this without saturating the relational database, I implemented a **Cache-Aside pattern using Redis** with a 24-hour TTL and randomized jitter. When a cache miss occurs, the system reads from **PostgreSQL**, where short codes are indexed via B-trees, and populates Redis. On our benchmark load test with Autocannon, the system sustained **1,920 requests per second** with a **median latency of 25ms** and a **p99 of 51ms** on standard consumer hardware.

For reliability, the system features **fail-open graceful degradation**: if Redis crashes, the application logs a warning and automatically falls back to PostgreSQL without dropping a single user redirection. For security, I implemented **atomic token-bucket rate limiting** in Redis using atomic Lua/pipelines to prevent race conditions, strict **SSRF and loopback address blocking** to prevent internal network scanning, and a tiered model where anonymous visitors can create one trial link while authenticated users manage links and inspect click analytics. The frontend is built with React and Vite, styled cleanly after modern dev tools like Dub.co and Notion, and served directly by the Express runtime to eliminate cross-origin complexity."

---

## 2. The 3-Minute In-Depth Architectural Walkthrough

### Part 1: Problem Statement & Scale Estimation
"When approaching this system, I started with capacity calculations. If we assume a system generating 10 million new links a month and a 100:1 read-to-write ratio, we're serving 1 billion redirects monthly. That translates to roughly 400 read requests per second on average and 2,000–5,000 req/sec at peak. Storing URLs for 5 years requires around 600 million records, which demands roughly 300 Gigabytes of storage. 

This informed two key architectural decisions:
1. **Short code generation strategy**: Why not auto-incrementing integers? Auto-incrementing IDs leak business velocity to competitors and are vulnerable to enumeration attacks. Generating 7-character Base62 hashes yields $62^7 \approx 3.52\text{ trillion}$ unique combinations. With 10 million links, the collision probability is statistically negligible ($< 10^{-5}$), making randomized Base62 with a PostgreSQL unique constraint both performant and tamper-proof.
2. **Read path optimization**: The read path must never bottleneck on disk I/O.

### Part 2: Caching, Consistency, and Degradation
To protect PostgreSQL from read exhaustion, every redirection checks Redis first. We use the **Cache-Aside pattern**. A critical consideration in high-throughput systems is the **Cache Stampede (Thundering Herd) problem**—if 1,000 concurrent requests hit an expired celebrity link simultaneously, all 1,000 could hammer PostgreSQL. We mitigated this by setting fixed TTLs plus randomized jitter, and in an enterprise setup we would wrap this with single-flight request coalescing.

If Redis drops connection, the app does not throw a 500 error. The `cacheService` catches the connection failure, flags the cache as unavailable, and seamlessly routes reads directly to PostgreSQL. Once Redis recovers, the connection listener re-enables caching automatically.

### Part 3: Click Analytics & Decoupling
Recording clicks naively inside the HTTP request loop adds significant latency to redirections. A user clicking a shortened link expects instantaneous 302 navigation. 

To achieve this, click tracking is **completely asynchronous**. The redirection response is dispatched immediately to the browser with `res.redirect(302, url)`. In the background, Node.js schedules the database write via `setImmediate`, passing the URL ID, referrer header, and sanitized User-Agent. Furthermore, for privacy and GDPR compliance, we deliberately avoid logging client IP addresses. On PostgreSQL, the `clicks` table is indexed via a composite B-tree on `(url_id, clicked_at DESC)`, enabling Index-Only Scans for the 30-day analytics dashboard.

### Part 4: Security & Multi-Tenancy
On the security front:
- **SSRF Prevention**: Malicious actors often try to use URL shorteners to probe internal microservices (`localhost`, `127.0.0.1`, `169.254.169.254` AWS metadata). Our input validator resolves the target domain's IP before inserting and strictly forbids private, loopback, and link-local ranges.
- **Rate Limiting**: We enforce a sliding window rate limit using atomic Redis pipelines (`INCR` and `EXPIRE`), preventing distributed denial of service while informing clients with RFC-compliant headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).
- **Authentication**: We use Google OAuth 2.0 with JWT HTTP-only cookies, providing frictionless sign-in while protecting against Cross-Site Scripting (XSS) and CSRF attacks."

