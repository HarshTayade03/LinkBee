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

## Phase 1: Core — Shorten and Redirect

### Question 1: Auto-Increment Base62 and Information Disclosure
- **Question**: Why is using an auto-incrementing database ID converted to Base62 (`id=1 -> '1'`, `id=2 -> '2'`) considered an information disclosure vulnerability in a URL shortener?
- **Model Answer**:
  > Sequential auto-increment IDs expose two major security and business vulnerabilities:
  > 1. **Predictable Enumeration / Harvesting**: Anyone can write a simple script to iterate through consecutive IDs (`0000001`, `0000002`...) and discover every single URL stored in our database, including unlisted, private, or internal links that users shared expecting obscurity.
  > 2. **Business Intelligence Leakage**: Competitors can shorten a link at 9:00 AM and another at 5:00 PM, subtract the IDs, and calculate our exact daily link generation volume and business growth rate.
  >
  > **Solution**: Using cryptographically secure random Base62 codes (e.g. 7 characters = $62^7 \approx 3.52\text{ trillion}$ combinations) makes sequential guessing mathematically infeasible.

---

## Phase 2: Correctness and Robustness

### Question 1: Scheme Whitelisting vs Blacklisting
- **Question**: Why is scheme whitelisting (`['http:', 'https:']`) fundamentally safer than blacklisting known malicious schemes like `javascript:`?
- **Model Answer**:
  > Blacklisting relies on enumerating every dangerous input, which is fundamentally fragile because the list of dangerous or novel URI schemes is vast and platform-dependent (e.g. `javascript:`, `vbscript:`, `data:`, `file:`, `blob:`, `about:`, `chrome:`). Attackers constantly discover bypasses or edge-case encodings that slip past blacklist filters.
  >
  > **Whitelisting** (positive security model) defines the exact, small set of permitted behaviors (`['http:', 'https:']`) and rejects everything else by default. If a new malicious URI scheme or obscure browser quirk emerges tomorrow, our server automatically rejects it without needing code changes.

---

## Phase 3: Caching with Redis

### Question 1: Cache-Aside vs Write-Through Caching
- **Question**: What is the Cache-Aside pattern, and why is it preferred over Write-Through caching for a URL shortener?
- **Model Answer**:
  > In **Cache-Aside (Lazy Loading)**, the application first checks the cache. On a hit, it returns immediately; on a miss, it queries the database, writes the result to the cache with a TTL, and returns. In **Write-Through**, every new link creation writes synchronously to both the database and the cache simultaneously.
  >
  > For a URL shortener, **Cache-Aside is vastly superior** because URL access distributions are heavily skewed (the 80/20 Pareto rule). Millions of shortened URLs are created that are clicked once or never clicked at all. Write-Through would saturate expensive Redis RAM with dormant links that consume memory without ever serving traffic. Cache-Aside ensures RAM is reserved exclusively for "hot" URLs that users actually visit.

---

## Phase 4: Click Analytics

### Question 1: Asynchronous Analytics & Data Loss Trade-off
- **Question**: Why should click analytics recording be decoupled from the HTTP redirect response, and what is the trade-off of using an asynchronous fire-and-forget pattern?
- **Model Answer**:
  > Decoupling analytics via an asynchronous fire-and-forget approach ensures that the end-user's redirect latency remains minimal (sub-2ms from cache). If we forced the redirect to wait for a database write (`await db.query(...)`), redirect response times would increase tenfold to 20ms+ and could bottleneck under write locks.
  >
  > **The Trade-off**: In the rare event of an unexpected server process crash, SIGKILL, or power loss between the redirect dispatch and the execution of the asynchronous task in the event loop, that individual click event is lost. In real-world web analytics, a 99.9% counting accuracy guarantee without latency penalties is considered an optimal engineering trade-off.

---

## Phase 5: Rate Limiting

### Question 1: Fixed Window vs Sliding Window vs Token Bucket
- **Question**: Compare Fixed Window vs Sliding Window vs Token Bucket rate limiting. Why is Fixed Window sufficient for our URL shortener?
- **Model Answer**:
  > - **Fixed Window**: Tracks request count inside fixed time blocks (e.g. 0-60s) using a single Redis integer with TTL. Extremely memory-efficient and fast, but allows a burst of $2 \times \text{limit}$ across window boundaries.
  > - **Sliding Window Log**: Stores timestamps in a sorted set (`ZADD`). Completely smooths boundaries, but consumes significant memory by storing every request timestamp.
  > - **Token Bucket**: Accumulates tokens at a constant refill rate. Ideal for handling natural traffic bursts with sustained rate limits, but requires stateful floating-point math.
  >
  > For link creation abuse prevention, a fixed window with a 60-second boundary is more than sufficient, uses virtually zero RAM, and executes in sub-millisecond time.

---

## Phase 6: Security Hardening

### Question 1: SHA-256 vs Slow Password Hashing (bcrypt/Argon2id)
- **Question**: Why is SHA-256 appropriate for hashing high-entropy management tokens, whereas passwords must use slow adaptive algorithms like bcrypt or Argon2id?
- **Model Answer**:
  > Humans choose predictable, low-entropy passwords with small search spaces. Without slow adaptive hashing (like bcrypt, PBKDF2, or Argon2id with work factors calibrated to ~100ms), attackers using GPU cracking rigs can calculate billions of SHA-256 hashes per second to guess user passwords in minutes.
  >
  > In contrast, our management tokens are generated with 192 bits of cryptographic randomness (`crypto.randomBytes(24)`). There are $2^{192} \approx 6.27 \times 10^{57}$ possible combinations. It is mathematically impossible to brute-force a 192-bit random string through dictionary or offline attacks. Because entropy is already massive, a fast cryptographic hash like SHA-256 provides 100% security while saving valuable server CPU time.

---

## Phase 7: Frontend Application

### Question 1: DOM-Based XSS & Safe Rendering
- **Question**: Why is using `innerHTML` with data received from a backend API considered a security risk, and how does `textContent` or `document.createElement` eliminate that risk?
- **Model Answer**:
  > `element.innerHTML` causes the browser's HTML parser to parse the assigned string as executable markup. If any data returned from the backend (such as a destination URL, custom alias, or HTTP referrer string) contains malicious HTML tags like `<img src=x onerror=alert(document.cookie)>` or `<script>`, the browser will execute the injected script within the user's session (Cross-Site Scripting).
  >
  > Using `element.textContent` or creating elements via `document.createElement()` bypasses the HTML parser entirely. The browser treats the data strictly as raw, uninterpreted text glyphs, making script injection impossible regardless of the characters contained in the payload.

---

## Phase 8: Load Testing & Benchmarks

### Question 1: Tail Latency (p95 / p99) vs Average Latency
- **Question**: What is tail latency (p95 / p99), and why is it more important for system reliability than average (mean) latency?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > Average latency hides severe latency spikes behind large volumes of fast requests. If 99 requests take 2ms and 1 request takes 2,000ms, the average is ~22ms, which looks completely healthy on paper. However, the user who waited 2,000ms suffered a terrible experience.
  >
  > **p95 and p99 (tail percentiles)** reveal the worst-case experience of the top 5% and 1% of requests. In large-scale architectures (like PayPal or microservice meshes where a single user page calls 30 backend services in parallel), if each service has a 1% failure or high-latency rate, the overall probability that the user experiences a slow page is:
  > $$1 - (0.99)^{30} \approx 26\%$$
  > More than 1 in 4 users will experience the worst tail latency! Managing tail latency is essential to enterprise reliability.

---

### Question 2: Concurrency & Little's Law
- **Question**: How does connection concurrency affect server latency according to Little's Law?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > **Little's Law** is a fundamental queuing theory theorem defined as:
  > $$L = \lambda \times W$$
  > Where:
  > - $L$ is the average number of concurrent requests in the system.
  > - $\lambda$ is the throughput (arrival rate in requests per second).
  > - $W$ is the average response time (latency).
  >
  > If connection concurrency ($L$) increases while backend service capacity ($\lambda$) has reached saturation (e.g. database connection pools or CPU limits), latency ($W = L / \lambda$) must increase proportionally. Requests spend more time waiting in operating system TCP queues and database connection pool queues before being processed.

---

## Phase 9: Packaging and Continuous Integration (CI)

### Question 1: Multi-Stage Docker Builds
- **Question**: Why do production Docker images use multi-stage builds instead of installing build tools directly in the final container?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > Multi-stage builds separate the **build environment** from the **runtime environment**:
  > 1. **Image Size**: The build environment requires compilers, SDKs, devDependencies (like Vite, TypeScript, webpack), which often weigh 500MB to 1GB+. The final runtime image needs only the compiled static output and production Node modules, reducing container image size to <150MB.
  > 2. **Attack Surface**: Build tools (like compilers, git, or dev test runners) can contain vulnerabilities or be abused by an attacker who gains a remote shell. A minimal Alpine runner container contains only the minimal set of files required to execute `node src/server.js`.

---

### Question 2: Unprivileged Non-Root Docker Execution (`USER node`)
- **Question**: Why is running a container as a non-root user (`USER node`) a critical security best practice?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > By default, processes inside a Docker container run as UID 0 (`root`), which corresponds to the root user namespace on the Linux host kernel unless user namespace remapping is explicitly enabled.
  >
  > If an application suffers a remote code execution (RCE) or directory traversal flaw, an attacker running as root inside the container can attempt container breakout exploits (e.g. abusing Linux capabilities, modifying mounted host volumes, or compromising Docker socket mounts). Running as an unprivileged user (`USER node`) severely restricts file system permissions and prevents system-level escalation.

---

### Question 3: `npm install` vs `npm ci` in CI/CD Pipelines
- **Question**: What is the difference between `npm install` and `npm ci` in continuous integration pipelines?
- **Status**: Self-study review (Recorded model answer).
- **Model Answer**:
  > - `npm install` can modify or regenerate `package-lock.json` if dependency ranges in `package.json` allow newer minor/patch versions. It is non-deterministic and can introduce unexpected breaking changes during builds.
  > - `npm ci` (Clean Install) strictly installs the exact versions pinned in `package-lock.json`. It will throw an immediate fatal error if `package.json` and `package-lock.json` are out of sync. Furthermore, it deletes existing `node_modules/` before installing and skips write-back, making it significantly faster and 100% reproducible across CI runners.
