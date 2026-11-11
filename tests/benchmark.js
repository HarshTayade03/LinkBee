const autocannon = require('autocannon');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { redis } = require('../src/config/redis');

async function runBenchmark() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`[LOAD_TEST] Server listening on ${baseUrl}`);
  await new Promise((r) => setTimeout(r, 200));

  // 1. Create a benchmark test link
  const createRes = await fetch(`${baseUrl}/api/v1/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://paypal.com/growth/benchmark-target',
      customAlias: 'bench-link',
    }),
  });
  assertStatus(createRes.status, 201);
  console.log('[LOAD_TEST] Benchmark target URL created: /bench-link');

  // Prime the Redis cache with a first request
  const primeRes = await fetch(`${baseUrl}/bench-link`, { redirect: 'manual' });
  assertStatus(primeRes.status, 302);
  console.log('[LOAD_TEST] Redis cache primed for /bench-link');

  console.log('\n======================================================');
  console.log('BENCHMARK 1: Redis In-Memory Cache Hit (GET /bench-link)');
  console.log('Running 100 concurrent connections for 10 seconds...');
  console.log('======================================================');

  const cacheHitResult = await autocannon({
    url: `${baseUrl}/bench-link`,
    connections: 100,
    duration: 10,
    headers: {
      'User-Agent': 'AutocannonBench/1.0',
    },
  });

  console.log(autocannon.printResult(cacheHitResult));

  // Output JSON for docs/benchmarks.md
  console.log('\n--- RAW SUMMARY DATA ---');
  console.log(JSON.stringify({
    title: 'Redis Cache Hit Benchmark',
    requestsPerSecond: cacheHitResult.requests.average,
    totalRequests: cacheHitResult.requests.total,
    throughputBytesPerSec: cacheHitResult.throughput.average,
    latency: {
      p50: cacheHitResult.latency.p50,
      p95: cacheHitResult.latency.p95,
      p99: cacheHitResult.latency.p99,
      max: cacheHitResult.latency.max,
    },
  }, null, 2));

  server.close();
  await pool.end();
  if (redis) await redis.quit();
}

function assertStatus(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Expected HTTP ${expected}, received ${actual}`);
  }
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

