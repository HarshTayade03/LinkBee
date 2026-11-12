# Phase 8: Load Testing & Benchmarks

---

## 1. What We Built in This Phase
In this phase, we established a repeatable load testing framework using `autocannon` to evaluate the real-world throughput and latency distribution of our system under sustained concurrent traffic. We stressed the hot redirect path (`GET /:code`) at 50 concurrent connections, evaluated cache hits against cache misses, confirmed that rate limiting enforces HTTP 429 correctly under load, and saved all raw empirical data into [`docs/benchmarks.md`](benchmarks.md).

---

## 2. Why This Exists (The Problem It Solves)
Engineers often make claims like "my API is ultra-fast" without empirical proof. In high-caliber interviews (e.g. PayPal, Stripe), interviewers immediately probe: *"What was your p95 and p99 latency? At what concurrency did you test? How many requests per second did your single instance handle before degrading?"* Conducting real load tests against our actual Dockerized Redis and PostgreSQL services gives us concrete, verified numbers to put on our resume and discuss with confidence.

---

## 3. Official Benchmark Results

Running `node tests/runBenchmark.js` with **50 concurrent connections** for 10 seconds produced:

```
┌─────────┬───────┬───────┬───────┬───────┬──────────┬─────────┬───────┐
│ Stat    │ 2.5%  │ 50%   │ 97.5% │ 99%   │ Avg      │ Stdev   │ Max   │
├─────────┼───────┼───────┼───────┼───────┼──────────┼─────────┼───────┤
│ Latency │ 18 ms │ 25 ms │ 41 ms │ 51 ms │ 25.58 ms │ 6.08 ms │ 82 ms │
└─────────┴───────┴───────┴───────┴───────┴──────────┴─────────┴───────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬───────┬────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg   │ Stdev  │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼───────┼────────┼─────────┤
│ Req/Sec   │ 1,589   │ 1,589   │ 1,845   │ 2,221   │ 1,920 │ 212.88 │ 1,589   │
└───────────┴─────────┴─────────┴─────────┴─────────┴───────┴────────┴─────────┘
Total Requests: 19,198 requests in 10.05 seconds | Throughput: 1.91 MB/s
```

### Key Takeaways:
1. **Throughput**: Single Node.js process sustained **1,920 requests/second**.
2. **Median Latency (p50)**: **25 ms**.
3. **Tail Latency (p99)**: **51 ms** (99% of all requests resolved in under 51 milliseconds).
4. **Zero Dropped Requests**: 100% of requests responded without a single timeout or 500 error.

---

## 4. Interview Questions (Phase 8 Drill)

1. **What is tail latency (p95 / p99), and why is it more important for system reliability than average (mean) latency?**
2. **How does connection concurrency affect server latency according to Little's Law?**
3. **What is the difference between load testing, stress testing, and soak testing?**

