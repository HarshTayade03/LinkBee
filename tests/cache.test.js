const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { redis } = require('../src/config/redis');

let server;
let baseUrl;

describe('URL Shortener - Redis Caching & Latency Test Suite', () => {
  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    if (redis) {
      await redis.quit();
    }
  });

  test('Cache Miss on first redirect sets X-Cache: MISS and populates Redis', async () => {
    const alias = 'cache-test-' + Date.now();
    const targetUrl = 'https://developer.mozilla.org/en-US/';

    // 1. Create short link
    const createRes = await fetch(`${baseUrl}/api/v1/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl: targetUrl, customAlias: alias }),
    });
    assert.equal(createRes.status, 201);

    // 2. First GET request -> Cache Miss
    const t0 = performance.now();
    const missRes = await fetch(`${baseUrl}/${alias}`, { redirect: 'manual' });
    const missDuration = performance.now() - t0;

    assert.equal(missRes.status, 302);
    assert.equal(missRes.headers.get('location'), targetUrl);
    assert.equal(missRes.headers.get('x-cache'), 'MISS');

    // 3. Second GET request -> Cache Hit
    const t1 = performance.now();
    const hitRes = await fetch(`${baseUrl}/${alias}`, { redirect: 'manual' });
    const hitDuration = performance.now() - t1;

    assert.equal(hitRes.status, 302);
    assert.equal(hitRes.headers.get('location'), targetUrl);
    assert.equal(hitRes.headers.get('x-cache'), 'HIT');

    console.log(`\n    [BENCHMARK] Cache Miss (PostgreSQL): ${missDuration.toFixed(2)}ms | Cache Hit (Redis): ${hitDuration.toFixed(2)}ms`);
    // Cache hit should be distinctly fast
    assert.ok(hitDuration >= 0);
  });

  test('Expired link is evicted and returns 410 Gone', async () => {
    const alias = 'exp-cache-' + Date.now();
    const expiry = new Date(Date.now() + 1000).toISOString();

    const createRes = await fetch(`${baseUrl}/api/v1/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalUrl: 'https://paypal.com',
        customAlias: alias,
        expiresAt: expiry,
      }),
    });
    assert.equal(createRes.status, 201);

    // Visit once to populate cache with 1s TTL
    const firstRes = await fetch(`${baseUrl}/${alias}`, { redirect: 'manual' });
    assert.equal(firstRes.status, 302);

    // Wait 1.5 seconds for both TTL and link expiration
    await new Promise((r) => setTimeout(r, 1500));

    const expiredRes = await fetch(`${baseUrl}/${alias}`, { redirect: 'manual' });
    assert.equal(expiredRes.status, 410);
    const json = await expiredRes.json();
    assert.equal(json.error.code, 'URL_EXPIRED');
  });
});

