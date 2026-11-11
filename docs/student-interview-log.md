# Student Interview Log & Progress Tracker

This document records the interview questions asked at the end of each phase, your actual answers during our mentorship sessions, the evaluation feedback, and the model answers for your review before technical interviews.

---

## Phase 0: Requirements, Architecture & Threat Model

### Question 1: HTTP 301 vs HTTP 302 for URL Shorteners
- **Question**: Why do we choose HTTP `302 Found` instead of HTTP `301 Moved Permanently` for a URL shortener? What happens to analytics if you choose `301`?
- **Your Answer**:
  > *"The 301 message shows permanent movement of url which is not possible in case of shorturl, as they may be temproray not available or be different which is handled by 302."*
- **Mentor Feedback**:
  > Good intuition on the difference between permanent and temporary relocations, but missed the critical engineering consequence: **Browser Caching & Analytics**.
- **Model Answer**:
  > Browsers aggressively cache `301 Moved Permanently` responses locally on the client machine indefinitely. On subsequent clicks, the user's browser redirects locally without contacting our server at all, which completely breaks real-time click tracking and analytics.
  >
  > A `302 Found` (temporary redirect) instructs the browser to redirect immediately this time, but forces it to check back with our server on every single future visit. This guarantees every click hits our backend, allowing us to record accurate analytics.
- **Follow-up Question**: When *would* you choose `301`?
  - **Answer**: When server load reduction and minimal redirect latency are prioritized over tracking repeat clicks or having the flexibility to change the destination URL.

---

### Question 2: Handling 10,000 Redirects/Sec & Cache-Aside
- **Question**: If we expect 10,000 redirects per second, why is it impractical for a single standard relational database to handle that traffic directly, and how does the cache-aside pattern change the equation?
- **Your Answer**:
  > *"donot know."*
- **Mentor Feedback**:
  > This is a classic system design question. The key is understanding database disk I/O bottlenecks vs in-memory caching.
- **Model Answer**:
  > Relational databases like PostgreSQL are built for ACID compliance and write data to disk (and Write-Ahead Logs). A single standard PostgreSQL instance will typically saturate its connection pool and disk I/O around 1,000 to 2,000 queries per second, causing latency spikes and timeouts under 10k QPS.
  >
  > Because URL shortener traffic follows the Pareto Principle (the 80/20 rule, where ~20% of links account for ~80-90% of traffic), we use the **Cache-Aside pattern** with Redis (an in-memory store):
  > 1. Check Redis for `url:{code}`.
  > 2. On Cache Hit (sub-millisecond), redirect directly from RAM without touching the database.
  > 3. On Cache Miss, fetch from PostgreSQL, write to Redis with a TTL, and redirect.
  > This absorbs 90%+ of the read volume in memory, reducing PostgreSQL load down to an easily manageable ~1,000 QPS.

---

### Question 3: Open Redirect Vulnerability & Phishing Abuse
- **Question**: What is an Open Redirect vulnerability in the context of a URL shortener, and why do attackers target URL shorteners to carry out phishing campaigns?
- **Your Answer**:
  > *"donot know."*
- **Mentor Feedback**:
  > Critical security concept for any backend engineer working with URLs or redirects.
- **Model Answer**:
  > An open redirect occurs when an application accepts untrusted user input and redirects the user to that arbitrary destination without validation. In a URL shortener, redirecting is the primary feature, which makes it a prime target for abuse.
  >
  > Attackers use shorteners to bypass email spam filters and security scanners. If an attacker emails a direct link to `fake-paypal-login.com`, automated filters block it immediately based on domain reputation. If the attacker instead sends `our-trusted-service.com/xyz123`, the filter trusts our domain and delivers the email to the victim. The user trusts the link, clicks it, and our server redirects them to the malicious page.
  >
  > **Mitigation**: Strict URL scheme whitelisting (`http`/`https` only; reject `javascript:`, `data:`, `file:`), blocking loopback/internal IPs (SSRF), blocking self-domain redirect loops, and maintaining a domain blocklist.

---

## Phase 1: Core — Shorten and Redirect

### Question 1: Auto-Increment Base62 and Information Disclosure
- **Question**: Why is using an auto-incrementing database ID converted to Base62 (`id=1 -> '1'`, `id=2 -> '2'`) considered an information disclosure vulnerability in a URL shortener?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > Sequential auto-increment IDs expose two major security and business vulnerabilities:
  > 1. **Predictable Enumeration / Harvesting**: Anyone can write a simple script to iterate through consecutive IDs (`0000001`, `0000002`...) and discover every single URL stored in our database, including unlisted, private, or internal links that users shared expecting obscurity.
  > 2. **Business Intelligence Leakage**: Competitors can shorten a link at 9:00 AM and another at 5:00 PM, subtract the IDs, and calculate our exact daily link generation volume and business growth rate.
  >
  > **Solution**: Using cryptographically secure random Base62 codes (e.g. 7 characters = $62^7 \approx 3.52\text{ trillion}$ combinations) makes sequential guessing mathematically infeasible.

---

### Question 2: PostgreSQL Connection Pooling (`pg.Pool`)
- **Question**: What is a PostgreSQL Connection Pool (`pg.Pool`), and why is creating a new database connection for every incoming HTTP request considered a bad practice in Node.js?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > Establishing a new TCP connection to PostgreSQL requires a three-way TCP handshake, TLS negotiation (if encrypted), process forking or authentication in PostgreSQL, and backend memory allocation (typically several megabytes per backend process). Under high web traffic (e.g., 2,000 requests/sec), creating and tearing down connections per request causes massive latency overhead and exhausts PostgreSQL's connection limits (`FATAL: too many connections`).
  >
  > A **Connection Pool** maintains a warm set of active, reusable database connections (e.g., `max: 20`). Incoming HTTP requests borrow an idle connection from the pool, execute their query in milliseconds, and release it back to the pool immediately.

---

### Question 3: Concurrency & Hash Collisions
- **Question**: If two concurrent requests generate the exact same random short-code at the exact same millisecond, what happens in the database, and how does our application handle it without failing the user's request?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > In the database, the `short_code` column has a `UNIQUE` constraint backed by a unique B-Tree index. PostgreSQL guarantees ACID transaction isolation. Whichever request commits first succeeds; the second concurrent insert violates the unique constraint and is rolled back, returning PostgreSQL error code `23505` (`unique_violation`).
  >
  > In our application layer (`urlService.js`), we wrap the insert in an automated retry loop. When error `23505` is caught, the app does not crash or return a 500 to the client; instead, it generates a fresh random 7-character Base62 code and retries the insert (up to 3 attempts), ensuring the user's request succeeds seamlessly.

---

## Phase 2: Correctness and Robustness

### Question 1: Scheme Whitelisting vs Blacklisting
- **Question**: Why is scheme whitelisting (`['http:', 'https:']`) fundamentally safer than blacklisting known malicious schemes like `javascript:`?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > Blacklisting relies on enumerating every dangerous input, which is fundamentally fragile because the list of dangerous or novel URI schemes is vast and platform-dependent (e.g. `javascript:`, `vbscript:`, `data:`, `file:`, `blob:`, `about:`, `chrome:`). Attackers constantly discover bypasses or edge-case encodings that slip past blacklist filters.
  >
  > **Whitelisting** (positive security model) defines the exact, small set of permitted behaviors (`['http:', 'https:']`) and rejects everything else by default. If a new malicious URI scheme or obscure browser quirk emerges tomorrow, our server automatically rejects it without needing code changes.

---

### Question 2: HTTP 404 (Not Found) vs HTTP 410 (Gone)
- **Question**: What is the semantic difference between HTTP `404 Not Found` and HTTP `410 Gone`, and why does using `410` matter for web crawlers and API consumers?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > `404 Not Found` means the server has not found anything matching the Request-URI, with no indication of whether the condition is temporary or permanent. Clients, web search engine crawlers (Googlebot), and proxies assume the resource might appear later, so they will continue to re-request and re-index the URL periodically.
  >
  > `410 Gone` explicitly signals that the target resource was intentionally removed or expired, and the condition is **permanent**. Search engines immediately de-index 410 URLs from search results, web crawlers stop wasting crawl budget hitting the server, and API clients know not to retry the request.

---

### Question 3: Server-Side Request Forgery (SSRF) and Cloud Metadata
- **Question**: What is Server-Side Request Forgery (SSRF), and why is blocking IP `169.254.169.254` critical when deploying applications to AWS, GCP, or Azure?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > SSRF is an attack where an attacker induces a backend server to make HTTP requests to an unintended, internal destination that is not accessible from the public internet.
  >
  > In public cloud providers (AWS EC2, Google Cloud Engine, Azure VMs), the IP address `169.254.169.254` is the link-local **Instance Metadata Service (IMDS)**. When an internal application requests `http://169.254.169.254/latest/meta-data/iam/security-credentials/`, the cloud hypervisor returns the virtual machine's temporary IAM security credentials, private keys, and environment variables. If a URL shortener (or a link preview generator) fetches or redirects to this address without filtering, an attacker can steal the cloud role credentials and take over the entire cloud infrastructure.

---

## Phase 3: Caching with Redis

### Question 1: Cache-Aside vs Write-Through Caching
- **Question**: What is the Cache-Aside pattern, and why is it preferred over Write-Through caching for a URL shortener?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > In **Cache-Aside (Lazy Loading)**, the application first checks the cache. On a hit, it returns immediately; on a miss, it queries the database, writes the result to the cache with a TTL, and returns. In **Write-Through**, every new link creation writes synchronously to both the database and the cache simultaneously.
  >
  > For a URL shortener, **Cache-Aside is vastly superior** because URL access distributions are heavily skewed (the 80/20 Pareto rule). Millions of shortened URLs are created that are clicked once or never clicked at all. Write-Through would saturate expensive Redis RAM with dormant links that consume memory without ever serving traffic. Cache-Aside ensures RAM is reserved exclusively for "hot" URLs that users actually visit.

---

### Question 2: Thundering Herd (Cache Stampede)
- **Question**: What is a "Thundering Herd" (Cache Stampede) problem, and how can backend engineers mitigate it on high-traffic viral links?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > A Cache Stampede occurs when a high-traffic cached key (e.g. a link with 10,000 clicks/sec) expires or is evicted. When the key vanishes, thousands of concurrent requests simultaneously experience a Cache Miss and all hammer the database at the exact same millisecond to rebuild the cache, saturating DB connections and causing CPU spikes or crashes.
  >
  > **Mitigations**:
  > 1. **Distributed Mutex / Lock (`SET NX EX`)**: The first request to encounter the miss acquires a short lock in Redis to recompute the value; other requests wait briefly or retry.
  > 2. **Probabilistic Early Expiration (XFetch algorithm)**: Background workers re-cache the value probabilistically *before* the TTL actually expires based on read frequency and computation time.
  > 3. **Singleflight Pattern (Request Coalescing)**: In-process duplicate requests share the exact same promise/future, executing only one DB read for all waiting requests.

---

### Question 3: Redis Eviction Policies (`volatile-lru` vs `allkeys-lru`)
- **Question**: What is the difference between Redis eviction policies `volatile-lru` and `allkeys-lru`, and why did we choose `allkeys-lru`?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > `volatile-lru` only evicts keys that have an explicit expiration (TTL) set when memory reaches the cap. If memory fills up with keys that lack a TTL, Redis stops accepting writes and throws `OOM command not allowed when used memory > 'maxmemory'`.
  >
  > `allkeys-lru` evicts the least recently used key across the **entire** key space, regardless of whether a TTL was set. We chose `allkeys-lru` because in our URL shortener, PostgreSQL is the permanent, durable system of record. Redis is treated strictly as an ephemeral accelerator. If memory is full, evicting any cold short-link is safe because it can always be re-fetched from PostgreSQL on demand.

---

## Phase 4: Click Analytics

### Question 1: Asynchronous Analytics & Data Loss Trade-off
- **Question**: Why should click analytics recording be decoupled from the HTTP redirect response, and what is the trade-off of using an asynchronous fire-and-forget pattern?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > Decoupling analytics via an asynchronous fire-and-forget approach ensures that the end-user's redirect latency remains minimal (sub-2ms from cache). If we forced the redirect to wait for a database write (`await db.query(...)`), redirect response times would increase tenfold to 20ms+ and could bottleneck under write locks.
  >
  > **The Trade-off**: In the rare event of an unexpected server process crash, SIGKILL, or power loss between the redirect dispatch and the execution of the asynchronous task in the event loop, that individual click event is lost. In real-world web analytics, a 99.9% counting accuracy guarantee without latency penalties is considered an optimal engineering trade-off.

---

### Question 2: Composite Indexing & Index-Only Scan
- **Question**: Explain why a composite index on `(url_id, clicked_at DESC)` was chosen instead of two separate indexes on `url_id` and `clicked_at`. What is an Index-Only Scan?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > When querying analytics for a specific link (`WHERE url_id = $1 AND clicked_at >= NOW() - INTERVAL '30 days' ORDER BY date`), PostgreSQL can use a composite index `(url_id, clicked_at DESC)` to jump directly to the target URL's entries and scan them in pre-sorted chronological order in a single operation.
  >
  > An **Index-Only Scan** occurs when all columns required by the query (`url_id` and `clicked_at`) are present directly inside the index tree itself. PostgreSQL retrieves the data without ever reading the main table heap (`Heap Fetches: 0`), resulting in sub-millisecond execution times.

---

### Question 3: Privacy by Design & IP Elimination
- **Question**: From a data privacy and systems engineering perspective, why should a URL shortener avoid storing full client IP addresses in its database?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > Under global data protection regulations (GDPR in Europe, CCPA in California), an IP address is legally recognized as Personally Identifiable Information (PII). Storing full IP addresses incurs heavy regulatory compliance burdens: companies must support "Right to be Forgotten" (data deletion) requests, maintain detailed audit logs, and risk severe fines in the event of a database leak.
  >
  > From a product and systems engineering perspective:
  > 1. Link owners only need aggregate geographic and referral insights, not individual users' private IPs.
  > 2. Eliminating IP storage reduces row size in the `clicks` table by 16–45 bytes per row, saving gigabytes of disk space and memory at scale.

---

## Phase 5: Rate Limiting

### Question 1: Fixed Window vs Sliding Window vs Token Bucket
- **Question**: Compare Fixed Window vs Sliding Window vs Token Bucket rate limiting. Why is Fixed Window sufficient for our URL shortener?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > - **Fixed Window**: Tracks request count inside fixed time blocks (e.g. 0-60s, 60-120s) using a single Redis integer with TTL. Extremely memory-efficient and fast, but allows a burst of $2 \times \text{limit}$ across window boundaries (e.g. at second 59 and 61).
  > - **Sliding Window Log**: Stores timestamps in a sorted set (`ZADD`). Completely smooths boundaries, but consumes significant memory by storing every request timestamp.
  > - **Token Bucket**: Accumulates tokens at a constant refill rate. Ideal for handling natural traffic bursts with sustained rate limits, but requires stateful floating-point math.
  >
  > For link creation abuse prevention, our objective is stopping malicious automated scripts and spammers from generating millions of links. A fixed window with a 60-second boundary is more than sufficient, uses virtually zero RAM, and executes in sub-millisecond time.

---

### Question 2: Atomicity in Redis Rate Limiting (`INCR` + `EXPIRE`)
- **Question**: What race condition can occur when implementing a rate limiter in Redis with `INCR` and `EXPIRE`, and how does pipelining or Lua scripting prevent it?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > If an application calls `INCR key` and then subsequently calls `EXPIRE key 60` in two separate operations, a crash, network partition, or deployment restart between the two commands leaves the key in Redis without an expiration time (`TTL = -1`). That IP address will remain permanently throttled forever, unable to make requests even after the window has passed.
  >
  > We solve this using a **Redis pipeline** or an atomic Lua script:
  > 1. We issue both `INCR` and `TTL` together in a single pipeline.
  > 2. If `TTL` returns `-1` (indicating a brand-new key), we immediately set the expiry.
  > 3. Alternatively, Redis 7+ allows `INCRBY` or `SET NX EX` to be combined into single atomic operations, ensuring keys are never orphaned without a TTL.

---

### Question 3: The `X-Forwarded-For` Header and `trust proxy`
- **Question**: What is the `X-Forwarded-For` header, and why can misconfiguring Express's `trust proxy` setting allow attackers to bypass rate limits?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > When an application runs behind a reverse proxy (e.g. AWS ALB, Cloudflare, NGINX), the incoming TCP connection to Node.js originates from the reverse proxy's internal private IP. The proxy records the original client's IP in the `X-Forwarded-For` header:
  > `X-Forwarded-For: <client_ip>, <proxy_1_ip>, <proxy_2_ip>`.
  >
  > If an engineer blindly enables `app.set('trust proxy', true)` without restriction, Express blindly trusts whatever client IP is passed in the header. An attacker can write a script that sends a fake header:
  > `X-Forwarded-For: 198.51.100.1`, then `198.51.100.2`, etc.
  > Express uses the spoofed IP for `req.ip`, giving the attacker a brand-new rate-limit bucket on every single request and completely bypassing the rate limiter!
  >
  > **Mitigation**: Configure `trust proxy` to trust only the exact number of verified proxy hops (e.g., `app.set('trust proxy', 1)` for a single cloud edge proxy) or specify the proxy subnet CIDR.

---

## Phase 6: Security Hardening

### Question 1: SHA-256 vs Slow Password Hashing (bcrypt/Argon2id)
- **Question**: Why is SHA-256 appropriate for hashing high-entropy management tokens, whereas passwords must use slow adaptive algorithms like bcrypt or Argon2id?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > Humans choose predictable, low-entropy passwords with small search spaces (e.g. 6–12 characters, often dictionary words). Without slow adaptive hashing (like bcrypt, PBKDF2, or Argon2id with work factors calibrated to ~100ms), an attacker with modern GPU cracking rigs can calculate billions of SHA-256 hashes per second to guess user passwords in minutes.
  >
  > In contrast, our management tokens are generated with 192 bits of cryptographic randomness (`crypto.randomBytes(24)`). There are $2^{192} \approx 6.27 \times 10^{57}$ possible combinations. It is mathematically impossible to brute-force a 192-bit random string through dictionary or offline attacks. Because entropy is already massive, a fast cryptographic hash like SHA-256 provides 100% security while saving valuable server CPU time.
- **Follow-up 1**: Why hash the token at all if it's already an unguessable 192-bit string?
  - **Answer**: Defense in depth. If our PostgreSQL database is breached, backed up insecurely, or dumped by a rogue insider, storing raw tokens would allow the attacker to manipulate, delete, or inspect analytics for all user links. Storing only one-way cryptographic hashes means the database leak contains zero usable tokens.

---

### Question 2: Side-Channel Timing Attacks
- **Question**: What is a side-channel timing attack, and how does `crypto.timingSafeEqual` protect token comparisons from it?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > Standard string equality operators (`strA === strB`) implement early exit: they iterate character by character and stop at the very first mismatched byte. An attacker measuring the response time over thousands of requests can notice that a request matching the first byte takes 15 nanoseconds longer than a request with a wrong first byte. By repeating this process byte-by-byte, an attacker can reconstruct the entire secret hash.
  >
  > `crypto.timingSafeEqual` performs an XOR comparison across all bytes in constant time regardless of where mismatches occur, preventing attackers from deriving any timing clues from server response times.

---

### Question 3: Content-Security-Policy (CSP) & Inline Scripts
- **Question**: What is a Content-Security-Policy (CSP), and why is blocking `'unsafe-inline'` scripts critical for preventing Cross-Site Scripting (XSS)?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > CSP is an HTTP response header that defines which dynamic resources and origins are authorized to execute in the user's browser.
  >
  > The `'unsafe-inline'` directive allows JavaScript written inside `<script>...</script>` tags or inline HTML event handlers (`onload=...`, `onerror=...`) to execute. If an application allows inline scripts, any Cross-Site Scripting (XSS) vulnerability where user input is reflected into the HTML will immediately execute malicious JavaScript. Blocking `'unsafe-inline'` and restricting scripts strictly to `script-src 'self'` guarantees that even if an attacker manages to inject `<script>` into the DOM, modern browsers will refuse to execute it.
