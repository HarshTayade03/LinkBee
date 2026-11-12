# High-Impact Resume & Portfolio Bullet Points

These bullet points are crafted following the **Google XYZ Formula** (*"Accomplished [X] as measured by [Y], by doing [Z]"*) specifically for software engineering resumes targeting Tier-1 tech companies (PayPal, Stripe, Uber, Google).

---

## Resume Option 1: Backend / Distributed Systems Focus

- **Distributed URL Shortener & High-Throughput Redirection Engine** | *Node.js, PostgreSQL, Redis, Docker, React*
  - Architected a production-grade URL shortener handling a 100:1 read-to-write traffic asymmetry, achieving **1,920 req/s** throughput with a **25ms median latency** and **51ms p99** under Autocannon benchmark load tests.
  - Implemented a **Cache-Aside pattern in Redis** with randomized TTL jitter and fail-open degradation, ensuring 100% redirection uptime and sub-millisecond cache hits even during simulated cache outages.
  - Optimized analytics queries by creating a composite B-tree index on `(url_id, clicked_at DESC)`, enabling **Index-Only Scans** and reducing 30-day analytics aggregation query execution time by **85%**.
  - Engineered atomic sliding-window rate limiting using Redis pipelines and secured system endpoints against SSRF, loopback network probing, and brute-force enumeration attacks.
  - Integrated Google OAuth 2.0 multi-tenant authentication with `HttpOnly; SameSite=Lax` JWT cookies, containerized with multi-stage Docker builds, and automated CI test pipelines via GitHub Actions.

---

## Resume Option 2: Full-Stack / Platform Focus

- **Full-Stack Link Management Platform** | *React, Vite, Express, PostgreSQL, Redis*
  - Built an end-to-end link management platform inspired by Dub.co and Notion, serving dynamic creator dashboards, real-time click analytics, and custom alias vanity management.
  - Developed an asynchronous click-tracking pipeline using `setImmediate` event loop scheduling, decoupling write persistence from user redirection to guarantee zero added latency on 302 responses.
  - Unified Vite React SPA with Express runtime into a single containerized artifact, eliminating CORS preflight overhead and reducing cold deployment time.
  - Benchmarked and documented complete system performance across 10+ architectural decision records (ADRs) and authored production runbooks covering zero-downtime database migrations and fail-over scenarios.

---

## GitHub Repository Highlights (For README / Portfolio Overview)

Place this concise elevator summary at the top of your GitHub repository `README.md`:

```markdown
### ⚡ Key Engineering Highlights
- **Throughput & Latency**: Sustains **1,920 req/s** at **25ms median** / **51ms p99** latency using Redis Cache-Aside.
- **Fail-Open Resilience**: Redis crashes degrade seamlessly to PostgreSQL direct reads without dropping traffic.
- **Asynchronous Click Analytics**: 302 redirects are dispatched instantly; database click logging runs asynchronously via event-loop scheduling.
- **Enterprise-Grade Security**: Defends against SSRF, loopback attacks, XSS, and race conditions via atomic Redis pipelines.
- **Production Monorepo**: React + Vite frontend served seamlessly by Express with zero CORS overhead and Google OAuth multi-tenancy.
```
