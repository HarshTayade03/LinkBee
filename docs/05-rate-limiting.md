# Phase 5: Rate Limiting

---

## 1. What We Built in This Phase
In this phase, we implemented a robust, distributed rate limiter on the creation endpoint (`POST /api/v1/shorten`) using Redis atomic primitives (`INCR` and `EXPIRE` via a pipeline). We capped URL creation to 10 requests per 60 seconds per IP address, added standard RFC rate limiting headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`), implemented HTTP `429 Too Many Requests` responses, and configured Express's `trust proxy` setting safely to prevent IP spoofing attacks.

---

## 2. Why This Exists (The Problem It Solves)
Without rate limiting, an automated bot, malicious script, or misbehaving client can flood `POST /api/v1/shorten` with millions of requests per hour. This causes:
1. **Database Disk Exhaustion**: Filling PostgreSQL storage with spam URLs.
2. **Short-Code Space Depletion**: Exhausting the 7-character namespace unnecessarily.
3. **Denial of Service (DoS)**: CPU and connection starvation affecting legitimate users.
Rate limiting enforces a quota per client IP, protecting both backend availability and infrastructure costs.

---

## 3. How It Works

### Rate Limiter Strategies Comparison

| Algorithm | How It Works | Memory Usage | Pros | Cons |
| :--- | :--- | :--- | :--- | :--- |
| **Fixed Window (Chosen)** | Divides time into fixed buckets (e.g., 60s). Counts requests per bucket with an expiry. | Extremely low (single integer in Redis). | Ultra-fast; sub-millisecond atomic `INCR`; simple to reason about. | Window-boundary burst: A client can make 10 requests at second 59 and 10 at second 61 (20 requests in 2 seconds). Acceptable for link creation abuse prevention. |
| **Sliding Window Log** | Stores a timestamped sorted set (`ZADD`) of every request. Removes timestamps older than the window. | High (stores every request timestamp). | Perfectly accurate smoothing. | Memory heavy; complex Redis sorted set operations. |
| **Token Bucket** | Tokens refill at a constant rate up to a capacity. Each request consumes one token. | Moderate. | Handles natural bursts well. | Requires tracking last refill timestamp and calculating floats. |

### The Atomic INCR + EXPIRE Race Condition
If implemented naively:
```javascript
// NAIVE FLAWED CODE:
const count = await redis.incr(key);
if (count === 1) {
  // CRITICAL RACE CONDITION:
  // If the server crashes or restarts right here, EXPIRE is NEVER set!
  // The key becomes permanent and the user is locked out forever!
  await redis.expire(key, 60);
}
```

**Our Robust Pipeline Implementation**:
```javascript
const pipeline = redis.pipeline();
pipeline.incr(key);
pipeline.ttl(key);
const results = await pipeline.exec();
const currentCount = results[0][1];
let currentTtl = results[1][1];

if (currentTtl === -1) {
  // Key was newly created with no expiry; set expiration
  await redis.expire(key, windowSeconds);
}
```
Using a Redis pipeline bundles the increment and TTL inspection into a single atomic network roundtrip, preventing orphan permanent keys.

---

## 4. Reverse Proxies & `trust proxy` Security
When our Node.js app runs in production behind a cloud load balancer or reverse proxy (e.g. Render, AWS ALB, Cloudflare):
1. The incoming TCP connection to Node.js comes from the **reverse proxy's internal IP** (e.g. `10.0.0.1`), NOT the end user's device!
2. The proxy attaches the real client's IP in the `X-Forwarded-For` HTTP header: `X-Forwarded-For: <client_ip>, <proxy_ip>`.
3. If Express has `trust proxy` disabled (`false`), `req.ip` returns the proxy's IP. All users worldwide share the exact same IP in the eyes of the rate limiter, and one user hitting the limit **blocks all users globally**!
4. **The Security Trap**: If you blindly set `app.set('trust proxy', true)` (trust all), an attacker can inject a fake header:
   ```http
   X-Forwarded-For: 1.2.3.4
   ```
   Express would trust the attacker's fake IP, allowing the attacker to cycle through random fake IPs and completely bypass the rate limiter!
5. **Our Solution**: Controlled via `TRUST_PROXY=true` environment variable, telling Express to trust strictly the immediate edge proxy hop when deployed in cloud environments.

---

## 5. Code Walkthrough (Reading Order)

1. **[`src/middlewares/rateLimiter.js`](../src/middlewares/rateLimiter.js)**:
   - Exports `createRateLimiter({ windowSeconds, maxRequests, keyPrefix })`.
   - Uses `redis.pipeline()` to atomically increment request counts and inspect TTL.
   - Sets standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.
   - Returns HTTP `429 Too Many Requests` when quota is exceeded.
   - Implements fail-open: if Redis is disconnected, it logs a warning and permits the request through.
2. **[`src/routes/api.js`](../src/routes/api.js)**:
   - Applies `shortenRateLimiter` (`10 req / 60s`) directly to `POST /api/v1/shorten`.
3. **[`src/app.js`](../src/app.js)**:
   - Conditionally enables `app.set('trust proxy', 1)` when `process.env.TRUST_PROXY === 'true'`.
4. **[`tests/rateLimit.test.js`](../tests/rateLimit.test.js)**:
   - Sends 10 sequential valid requests verifying HTTP 201, then sends the 11th request and verifies HTTP 429 and rate limit headers.

---

## 6. Real Test Verification

Running `npm test` executes the complete rate limiting test suite:
```
✔ Permits requests up to the limit (10) and then returns 429 Too Many Requests (122.95ms)
ℹ tests 18 | pass 18 | fail 0
```
*Proves*: 10 requests allowed, 11th strictly blocked with 429, headers verified.

---

## 7. Interview Questions (Phase 5 Drill)

1. **Compare Fixed Window vs Sliding Window vs Token Bucket rate limiting. Why is Fixed Window sufficient for our URL shortener?**
2. **What race condition can occur when implementing a rate limiter in Redis with `INCR` and `EXPIRE`, and how does pipelining or Lua scripting prevent it?**
3. **What is the `X-Forwarded-For` header, and why can misconfiguring Express's `trust proxy` setting allow attackers to bypass rate limits?**

