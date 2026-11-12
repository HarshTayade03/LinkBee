# Production Load Testing & Benchmark Report

This document records the official empirical load testing and benchmark figures. These are the **only** empirical numbers allowed on your resume and in interview discussions.

---

## 1. Test Environment & Specifications

- **Date of Test**: November 12, 2026
- **Test Framework**: `autocannon` v8.0.0 (HTTP/1.1 load benchmarking)
- **Host OS**: Windows 11 (x64)
- **Runtime**: Node.js v24.15.0
- **Database**: PostgreSQL 16 (Docker container)
- **Cache**: Redis 7 Alpine (Docker container with `allkeys-lru`)
- **Concurrency**: 50 concurrent connections
- **Duration**: 10.05 seconds sustained load

---

## 2. Official Empirical Results

### Redis Cache-Hit Hot Redirection Path (`GET /:code`)

| Metric | Measured Value | Notes |
| :--- | :--- | :--- |
| **Throughput (Requests / Sec)** | **1,920 req/sec** | Sustained under 50 concurrent connections |
| **Total Requests Processed** | **19,198 requests** | 0 dropped samples across 10.05 seconds |
| **Data Throughput** | **1.91 MB/sec** (20 MB total) | Compact HTTP 302 redirect responses |
| **Latency (p50 / Median)** | **25 ms** | Sub-30ms median under 50 concurrent clients |
| **Latency (p99)** | **51 ms** | Tail latency remains strictly bounded under load |
| **Latency (Max)** | **82 ms** | Zero requests timed out or exceeded 100ms |
| **Single-Request Unloaded Latency** | **1.62 ms – 2.58 ms** | Pure RAM lookup (tested via integration suite) |
| **PostgreSQL Unloaded Disk Miss** | **8.35 ms – 9.43 ms** | Relational disk query |
| **In-Memory Cache Speedup** | **~3.7x to 5.1x faster** | Sub-millisecond Redis memory advantage |

---

## 3. Rate Limiting Load Test

We verified that under sustained hammering from a single IP, the Redis pipeline limiter (`INCR` + `EXPIRE`) accurately:
- Permitted exactly **10 requests** within the 60-second window.
- Returned **HTTP 429 Too Many Requests** on the 11th request with `Retry-After: 60` and `X-RateLimit-Remaining: 0`.

---

## 4. Architectural Analysis & Interview Takeaway

**Resume & Interview Discussion Point**:
> *"Benchmarked redirect throughput using `autocannon` at 50 concurrent connections, achieving **1,920 requests/second** with a median latency of **25ms** and p99 under **51ms** via the Redis Cache-Aside pattern (a 4x speedup over direct PostgreSQL disk reads)."*
