# Engineering Glossary: Distributed Systems & Backend Terms

Mastering precise engineering terminology is critical for senior-level technical interviews. Use these exact definitions when discussing architectural concepts.

---

### A
- **ACID**: Atomicity, Consistency, Isolation, Durability. The four guarantees of a relational database management system (RDBMS) like PostgreSQL ensuring reliable database transactions.
- **Asymmetric Read/Write Ratio**: A traffic pattern where reads vastly outnumber writes (e.g., URL shorteners at 100:1, Twitter feeds at 1,000:1). Drives caching and read replica architecture.
- **Autocannon**: A modern, high-performance HTTP/1.1 benchmarking tool written in Node.js, capable of generating tens of thousands of requests per second.

### B
- **Base62**: An encoding scheme using alphanumeric characters `[0-9a-zA-Z]` (62 possible characters). Ideal for compact URLs without escape character issues.
- **B-tree (Balanced Tree)**: The default self-balancing tree index structure in PostgreSQL providing $O(\log N)$ search, insertion, and deletion time.

### C
- **Cache-Aside (Lazy Loading)**: A caching pattern where the application reads from cache first; on a miss, reads from the database, writes the result to cache, and returns it.
- **Cache Invalidation**: The process of removing or updating stale cached data when underlying source data changes ("There are only two hard things in Computer Science: cache invalidation and naming things" — Phil Karlton).
- **Cache Stampede (Thundering Herd)**: When an expired high-traffic cache key causes massive concurrent requests to hit the database simultaneously.
- **Composite Index**: A single database index spanning two or more columns (e.g., `(url_id, clicked_at DESC)`).
- **Connection Pool**: A cache of pre-initialized database connections kept open and reused across multiple client requests, avoiding the overhead of frequent TCP/TLS handshakes.
- **Content-Security-Policy (CSP)**: An HTTP response header allowing site operators to restrict the resources (JavaScript, CSS, Images) the browser is allowed to load.

### E
- **Event Loop**: The single-threaded runtime mechanism in Node.js that executes JavaScript code, collects and processes events, and executes queued sub-tasks.

### F
- **Fail-Open**: A fault-tolerance design principle where a component failure (e.g., Redis outage) allows requests to continue through fallback mechanisms (PostgreSQL direct read) rather than rejecting requests with errors.

### H
- **HTTP 301 vs 302**: 
  - `301 Moved Permanently`: Browser caches redirection target indefinitely in client cache.
  - `302 Found`: Browser redirects but re-queries server on every subsequent click, enabling analytics tracking.
- **HttpOnly Cookie**: A cookie flag preventing client-side scripts from accessing `document.cookie`, mitigating XSS credential theft.

### I
- **Index-Only Scan**: A database query optimization where all requested columns can be satisfied directly from the index tree without fetching heap data pages from disk.

### J
- **Jitter**: The addition of intentional random variance (e.g., $\pm 10\%$) to a fixed TTL or backoff interval to prevent synchronized thundering herds.

### L
- **Lua Script**: A lightweight scripting language executed atomically inside the Redis engine, ensuring multiple commands execute without interleaving.

### O
- **OLAP vs OLTP**:
  - `OLTP (Online Transaction Processing)`: High volume of quick, atomic row lookups/writes (e.g., PostgreSQL for URLs and users).
  - `OLAP (Online Analytical Processing)`: Heavy aggregate queries scanning millions of rows (e.g., ClickHouse, Snowflake for click analytics).

### P
- **p99 Latency (99th Percentile)**: The latency threshold below which $99\%$ of requests are completed. Represents the worst-case experience of the top $1\%$ slowest requests.

### R
- **Rate Limiting**: Technique to control the rate of incoming requests using algorithms such as Token Bucket, Leaky Bucket, or Fixed/Sliding Window Counter.
- **Reverse Proxy**: An intermediary server (Render, Cloudflare, NGINX) positioned in front of web servers to handle SSL termination, load balancing, and DDoS protection.

### S
- **SSRF (Server-Side Request Forgery)**: A vulnerability where an attacker induces a backend server to make unauthorized HTTP requests to internal, private infrastructure.

