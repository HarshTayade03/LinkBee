const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { redis } = require('../src/config/redis');

let server;
let baseUrl;

describe('URL Shortener - Redis Rate Limiter Test Suite', () => {
  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // Clear rate limit keys for 127.0.0.1 before testing
    if (redis) {
      await redis.del('rl:shorten:127.0.0.1');
      await redis.del('rl:shorten:::ffff:127.0.0.1');
    }
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    if (redis) {
      await redis.quit();
    }
  });

  test('Permits requests up to the limit (10) and then returns 429 Too Many Requests', async () => {
    const originalUrl = 'https://paypal.com/developers';

    // Send 10 valid requests (should all succeed)
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl }),
      });
      assert.equal(res.status, 201, `Request #${i + 1} should succeed with 201`);
      assert.ok(res.headers.has('x-ratelimit-remaining'));
    }

    // 11th request must be rate limited with HTTP 429
    const blockedRes = await fetch(`${baseUrl}/api/v1/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl }),
    });

    assert.equal(blockedRes.status, 429);
    assert.equal(blockedRes.headers.get('x-ratelimit-remaining'), '0');
    assert.ok(blockedRes.headers.has('retry-after'));

    const json = await blockedRes.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'RATE_LIMIT_EXCEEDED');
  });
});
