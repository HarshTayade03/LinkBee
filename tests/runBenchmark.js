const autocannon = require('autocannon');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { redis } = require('../src/config/redis');

async function runBenchmark() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`[BENCHMARK] Test server listening on ${baseUrl}`);
  await new Promise((r) => setTimeout(r, 200));

  // 1. Create a short link to benchmark
  const code = 'bench' + Date.now();
  const createRes = await fetch(`${baseUrl}/api/v1/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://paypal.com/benchmarking-target',
      customAlias: code,
    }),
  });
  if (createRes.status !== 201) {
    throw new Error(`Failed to create benchmark link: status ${createRes.status}`);
  }

  // Prime the Redis cache with a first GET request
  await fetch(`${baseUrl}/${code}`, { redirect: 'manual' });
  console.log(`[BENCHMARK] Target primed in Redis cache: /${code}`);

  // Warm-up run (3 seconds)
  console.log('[BENCHMARK] Running warm-up...');
  await autocannon({
    url: `${baseUrl}/${code}`,
    connections: 10,
    duration: 3,
  });

  console.log('\n--- EXECUTING OFFICIAL LOAD TEST (Redis Cache Hit Path) ---');
  console.log('Parameters: 50 concurrent connections, 10 seconds duration');

  const result = await autocannon({
    url: `${baseUrl}/${code}`,
    connections: 50,
    duration: 10,
  });

  console.log(autocannon.printResult(result));

  const stats = {
    requestsPerSecond: Math.round(result.requests.average),
    totalRequests: result.requests.total,
    throughputMbPerSec: (result.throughput.average / (1024 * 1024)).toFixed(2),
    latencyP50: result.latency.p50,
    latencyP95: result.latency.p95,
    latencyP99: result.latency.p99,
    latencyMax: result.latency.max,
    durationSeconds: 10,
    connections: 50,
  };

  console.log('BENCHMARK_JSON_OUTPUT:');
  console.log(JSON.stringify(stats, null, 2));

  server.close();
  await pool.end();
  if (redis) await redis.quit();
}

runBenchmark().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});

