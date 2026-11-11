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

