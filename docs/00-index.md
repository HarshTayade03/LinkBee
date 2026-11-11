# Documentation Index & Reading Order

Welcome! This study guide accompanies our production-grade URL Shortener. It is structured progressively from initial design and threat modeling to production operation, benchmarks, and PayPal-level interview preparation.

## Core Curriculum & Implementation Chapters

| Chapter | Title | Focus Area | Status |
| :--- | :--- | :--- | :--- |
| **[00-requirements-and-design.md](00-requirements-and-design.md)** | **Phase 0: Requirements, Design & Threat Model** | Functional & non-functional requirements, API contracts, capacity estimation, initial data model, directory layout, and complete threat model. | Completed |
| **[01-core-shorten-and-redirect.md](01-core-shorten-and-redirect.md)** | **Phase 1: Core - Shorten & Redirect** | PostgreSQL schema, Base62 vs UUID vs Random strings, 301 vs 302 redirects, Docker Compose setup. | Completed |
| **[02-correctness-and-robustness.md](02-correctness-and-robustness.md)** | **Phase 2: Correctness & Robustness** | Input validation, SSRF/scheme blocking, custom aliases, link expiry, error handling standards, and automated testing. | Completed |
| **[03-caching-with-redis.md](03-caching-with-redis.md)** | **Phase 3: Caching with Redis** | Cache-aside pattern, TTL policies, handling cache stampedes/failures gracefully, and latency impact. | Completed |
| **[04-click-analytics.md](04-click-analytics.md)** | **Phase 4: Click Analytics** | Asynchronous fire-and-forget logging, indexing strategies (`EXPLAIN ANALYZE`), aggregation queries, and IP privacy. | Completed |
| **[05-rate-limiting.md](05-rate-limiting.md)** | **Phase 5: Rate Limiting** | Redis atomic fixed-window limiter (`INCR` + `EXPIRE`), reverse proxy trust, and DDoS mitigation. | Completed |
| **[06-security-hardening.md](06-security-hardening.md)** | **Phase 6: Security Hardening** | OWASP Top 10 breakdown, CSP/Helmet, per-link management tokens (hashing vs encryption), database least-privilege. | Pending |
| **[07-frontend.md](07-frontend.md)** | **Phase 7: Accessible Frontend** | Semantic HTML, CSS design tokens, DOM security (safe rendering without innerHTML), fetch & error handling. | Pending |
| **[08-benchmarks.md](08-benchmarks.md)** | **Phase 8: Load Testing & Real Numbers** | k6 / autocannon load tests, latency distributions (p50, p95, p99), cache performance validation. | Pending |
| **[09-packaging-and-ci.md](09-packaging-and-ci.md)** | **Phase 9: Packaging & CI/CD** | Multi-stage Docker builds, non-root execution, GitHub Actions workflows, lockfile security audits. | Pending |
| **[10-deployment.md](10-deployment.md)** | **Phase 10: Free Tier Cloud Deployment** | Production deployment, managed databases, environment variables, SSL/TLS, and handling free-tier cold starts. | Pending |
| **[11-operations.md](11-operations.md)** | **Phase 11: Production Operations** | Operational runbooks, structured log analysis, incident response, handling abusive links, and secret rotation. | Pending |

---

## Supporting Living Documents

- **[student-interview-log.md](student-interview-log.md)**: Log of every question asked at the end of each phase, your submitted answers, evaluation feedback, and model answers.
- **[decision-log.md](decision-log.md)**: Architectural Decision Records (ADRs) tracking every engineering choice, evaluated alternatives, and trade-offs.
- **[security-checklist.md](security-checklist.md)**: Production deployment verification checklist covering transport, auth, data, network, and runtime security.
- **[glossary.md](glossary.md)**: One-line concise definitions for core distributed systems, database, networking, and security concepts.
- **[interview-pitch.md](interview-pitch.md)**: 30-second elevator pitch, 2-minute project walkthrough, and 5-minute deep-dive for technical interviews.
- **[qa-bank.md](qa-bank.md)**: 50+ categorization-based interview questions and high-scoring answers.
- **[scaling-discussion.md](scaling-discussion.md)**: System design evolution for scaling from 1k to 100M+ requests/day (sharding, read replicas, distributed ID generation).
- **[failure-scenarios.md](failure-scenarios.md)**: Chaos engineering & resilience analysis (Redis failure, DB connection exhaustion, hash collisions).
- **[security-qa.md](security-qa.md)**: Security-specific interview drill questions.
- **[resume-bullets.md](resume-bullets.md)**: High-impact, benchmark-backed resume statements.

