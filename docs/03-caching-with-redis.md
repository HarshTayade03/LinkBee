# Phase 3: Caching with Redis

---

## 1. What We Built in This Phase
In this phase, we added an in-memory caching tier using Redis (`redis:7-alpine`) configured with an LRU eviction policy (`allkeys-lru`) and Docker Compose port `6380:6379`. We implemented the **Cache-Aside (Lazy Loading)** pattern on the critical redirection path (`GET /:code`), configured a resilient client with exponential backoff and fail-open degradation (falling back to PostgreSQL if Redis is down), enforced TTL synchronization with link expiration timestamps, and benchmarked our real redirect latency.

---

## 2. Why This Exists (The Problem It Solves)
URL shortener traffic is heavily read-dominant (~100 reads per write) and follows the Pareto Principle: ~20% of the links generate ~80–90% of total clicks (viral social posts, email campaigns). If every redirect hit PostgreSQL on disk, database connection pools would saturate under traffic spikes, causing elevated latency and timeouts. Placing an in-memory Redis cache in front of PostgreSQL satisfies 90%+ of reads directly from RAM in sub-2ms time.

---

## 3. How It Works

### Cache-Aside Sequence Diagram
```
Client                      Express API                 Redis RAM               PostgreSQL Disk
  |                              |                          |                          |
  |--- GET /:code -------------->|                          |                          |
  |                              |--- GET url:{code} ------>|                          |
  |                              |                          |                          |
  |                  [CACHE HIT] |<-- originalUrl ----------|                          |
  |<-- 302 Found (X-Cache: HIT) -|                          |                          |
  |                              |                          |                          |
  |                 [CACHE MISS] |<-- null -----------------|                          |
  |                              |--- SELECT original_url ---------------------------->|
  |                              |<-- record (original_url, expires_at) ---------------|
  |                              |--- SET url:{code} (TTL) >|                          |
  |<-- 302 Found (X-Cache: MISS)-|                          |                          |
```

### Key Lifecycle Rules:
1. **Cache Key Structure**: `url:{shortCode}` (e.g. `url:M2Igdd5`). Keys are strictly validated and trimmed to prevent cache key injection.
2. **TTL (Time-To-Live)**: Standard TTL is 24 hours (`86,400s`). If a link has an explicit `expires_at`, the TTL is calculated dynamically as $\min(86400, \text{remainingSeconds})$.
3. **Fail-Open Strategy**: If Redis crashes or experiences a network partition, the application does not return an HTTP 500 error. Instead, it catches the Redis error, logs a warning, and transparently executes the PostgreSQL fallback query.

---

## 4. Key Decisions & Alternatives
See **[decision-log.md](decision-log.md)** (ADR-011, ADR-012).

- **Cache-Aside (Lazy Loading) vs Write-Through**:
  - *Choice*: Cache-Aside.
  - *Alternative*: Write-Through (writing to both DB and Redis simultaneously upon creation).
  - *Reason*: In URL shorteners, millions of URLs are created that are never clicked or clicked only once. Write-Through would clutter expensive Redis RAM with dormant links. Cache-Aside ensures RAM is reserved exclusively for URLs that actually receive traffic.
- **Eviction Policy: `allkeys-lru`**:
  - Automatically evicts the least recently used keys when memory exceeds 256MB. PostgreSQL retains the permanent source of truth on disk.

---

## 5. Code Walkthrough (Reading Order)

1. **[`docker-compose.yml`](../docker-compose.yml)**:
   - Added `redis:7-alpine` service with `--maxmemory 256mb --maxmemory-policy allkeys-lru --save ""`.
2. **[`src/config/redis.js`](../src/config/redis.js)**:
   - Configures `ioredis` with `enableOfflineQueue: false` (to fail fast rather than hanging incoming HTTP requests when Redis drops) and exponential backoff retry.
3. **[`src/services/cacheService.js`](../src/services/cacheService.js)**:
   - `getCachedUrl(shortCode)`: Safely queries Redis, returns parsed payload, catches errors for fail-open fallback.
   - `setCachedUrl(shortCode, originalUrl, expiresAt)`: Sets key with calculated TTL.
   - `deleteCachedUrl(shortCode)`: Explicit cache invalidation.
4. **[`src/routes/redirect.js`](../src/routes/redirect.js)**:
   - Orchestrates the Cache-Aside pattern, setting `X-Cache: HIT` or `X-Cache: MISS` headers.
5. **[`tests/cache.test.js`](../tests/cache.test.js)**:
   - Integration tests measuring response times and verifying cache-hit headers.

---

## 6. What Can Go Wrong & How We Handle It

| Failure Case | What Happens | How the Code Handles It |
| :--- | :--- | :--- |
| **Redis Outage / Crash** | Redis process terminates or network port closes. | `ioredis` emits error event; `isReady()` returns false; `cacheService` catches the exception and returns `null`. The request transparently falls back to PostgreSQL without failing the user. |
| **Cache Stampede (Thundering Herd)** | A hot link expires from cache and 10,000 concurrent users request it at once. | In this phase, each request queries PostgreSQL and updates Redis. In Phase 12 (Scaling), we discuss distributed locks (`Redlock` or single-flight coalescing). |
| **Expired Link in Cache** | A link whose `expiresAt` has passed is still in cache. | On read, `redirect.js` inspects `cached.expiresAt`. If expired, it triggers `deleteCachedUrl(code)` immediately and returns HTTP `410 Gone`. |

---

## 7. Security Notes

- **Cache Key Poisoning / Delimiter Injection**:
  - *Attack idea*: An attacker passes short codes with Redis command delimiters or whitespace (`\r\n`) to inject arbitrary Redis commands.
  - *Defense*: In Phase 2, `shortCode` is strictly validated to alphanumeric characters, hyphens, and underscores (`^[a-zA-Z0-9_-]{3,30}$`). Any invalid characters are rejected before ever reaching `cacheService`.
- **Memory Exhaustion (Cache Denial of Service)**:
  - *Attack idea*: Attackers generate millions of clicks to different URLs to blow up Redis memory.
  - *Defense*: We enforced `--maxmemory 256mb` and `--maxmemory-policy allkeys-lru`. When memory is filled, Redis safely evicts the coldest keys.

---

## 8. Real Benchmark Measurements

From our executed automated test suite (`tests/cache.test.js`):
- **Cache Miss (PostgreSQL Disk Query)**: `8.35 ms`
- **Cache Hit (Redis RAM Lookup)**: `1.62 ms`
- **Speedup**: Over **5.1x lower latency** on the hot redirect path!

---

## 9. Interview Questions (Phase 3 Drill)

1. **What is the Cache-Aside pattern, and why is it preferred over Write-Through caching for a URL shortener?**
2. **What is a "Thundering Herd" (Cache Stampede) problem, and how can backend engineers mitigate it on high-traffic viral links?**
3. **What is the difference between Redis eviction policies `volatile-lru` and `allkeys-lru`, and why did we choose `allkeys-lru`?**

---

## 10. Common Mistakes Beginners Make Here
1. **Failing closed on cache errors**: Wrapping cache calls without `try/catch`, so that when Redis crashes, the entire website returns HTTP 500 errors.
2. **Not setting a TTL on cached items**: Caching indefinitely until RAM is full or failing to synchronize TTL with the link's expiration date.
3. **Cache poisoning via raw user input**: Constructing cache keys directly from unvalidated request bodies.

