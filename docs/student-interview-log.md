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
- **Follow-up 1**: Does Base62 encryption exist, or is Base62 merely an encoding?
  - **Answer**: Base62 is strictly a reversible positional encoding (like Base64 or Hex), not encryption. It provides zero confidentiality by itself; security comes from the high entropy/randomness of the generated bits before encoding.
- **Follow-up 2**: If an interviewer asks: *"What if we use Feistel ciphers or format-preserving encryption on the sequential ID to avoid collisions while preventing enumeration?"*
  - **Answer**: That is a valid alternative! A pseudo-random permutation (like a small-domain Feistel cipher or Skip32) maps sequential IDs to pseudo-random numbers with zero collisions. However, it adds cryptographic complexity and key management overhead, whereas random generation + DB unique retry is simpler to reason about and operates with negligible collision rates.

---

### Question 2: PostgreSQL Connection Pooling (`pg.Pool`)
- **Question**: What is a PostgreSQL Connection Pool (`pg.Pool`), and why is creating a new database connection for every incoming HTTP request considered a bad practice in Node.js?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > Establishing a new TCP connection to PostgreSQL requires a three-way TCP handshake, TLS negotiation (if encrypted), process forking or authentication in PostgreSQL, and backend memory allocation (typically several megabytes per backend process). Under high web traffic (e.g., 2,000 requests/sec), creating and tearing down connections per request causes massive latency overhead and exhausts PostgreSQL's connection limits (`FATAL: too many connections`).
  >
  > A **Connection Pool** maintains a warm set of active, reusable database connections (e.g., `max: 20`). Incoming HTTP requests borrow an idle connection from the pool, execute their query in milliseconds, and release it back to the pool immediately.
- **Follow-up 1**: Why not set `max: 500` in the pool so every request has a dedicated connection?
  - **Answer**: PostgreSQL uses a process-per-connection architecture. Excessive connections create CPU context-switching thrashing and RAM exhaustion. Keeping pool sizes small (e.g., 20–50 connections) actually yields higher aggregate throughput and lower p99 latency than hundreds of competing connections.
- **Follow-up 2**: How do we handle connection pooling when scaling horizontally to 50 Node.js server instances?
  - **Answer**: When many app instances multiply the total pool count ($50 \text{ instances} \times 20 = 1{,}000 \text{ connections}$), we introduce an external connection pooler like **PgBouncer** or Supabase Supavisor in front of PostgreSQL to multiplex thousands of client connections onto a small set of database backends.

---

### Question 3: Concurrency & Hash Collisions
- **Question**: If two concurrent requests generate the exact same random short-code at the exact same millisecond, what happens in the database, and how does our application handle it without failing the user's request?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > In the database, the `short_code` column has a `UNIQUE` constraint backed by a unique B-Tree index. PostgreSQL guarantees ACID transaction isolation. Whichever request commits first succeeds; the second concurrent insert violates the unique constraint and is rolled back, returning PostgreSQL error code `23505` (`unique_violation`).
  >
  > In our application layer (`urlService.js`), we wrap the insert in an automated retry loop. When error `23505` is caught, the app does not crash or return a 500 to the client; instead, it generates a fresh random 7-character Base62 code and retries the insert (up to 3 attempts), ensuring the user's request succeeds seamlessly.
- **Follow-up 1**: What is the probability of a collision with 7 Base62 characters?
  - **Answer**: $62^7 \approx 3.52 \times 10^{12}$ combinations. By the Birthday Paradox, we would need to generate over 2 million URLs before the probability of even a single collision reaches $0.1\%$.
- **Follow-up 2**: Why not do a `SELECT WHERE short_code = $1` before the `INSERT` instead of relying on the database error?
  - **Answer**: Checking before inserting introduces a **Time-of-Check to Time-of-Use (TOCTOU)** race condition. If two requests check at the exact same millisecond, both will see that the code is free and both will attempt to insert it. The database `UNIQUE` constraint is the only authoritative source of truth in a concurrent system.
