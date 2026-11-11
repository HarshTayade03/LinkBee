const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { redis } = require('../src/config/redis');

let server;
let baseUrl;

describe('URL Shortener - Click Analytics Test Suite', () => {
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

  test('Clicking a short URL records analytics without delaying response', async () => {
    const alias = 'analytics-test-' + Date.now();
    const destination = 'https://engineering.paypal.com/growth';

    // 1. Create short link
    const createRes = await fetch(`${baseUrl}/api/v1/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl: destination, customAlias: alias }),
    });
    assert.equal(createRes.status, 201);

    // 2. Click link 3 times with different referrers
    await fetch(`${baseUrl}/${alias}`, {
      headers: { 'Referer': 'https://twitter.com', 'User-Agent': 'Mozilla/5.0 TestBrowser' },
      redirect: 'manual',
    });
    await fetch(`${baseUrl}/${alias}`, {
      headers: { 'Referer': 'https://linkedin.com', 'User-Agent': 'MobileTestApp' },
      redirect: 'manual',
    });
    await fetch(`${baseUrl}/${alias}`, {
      headers: { 'User-Agent': 'DirectUserAgent' },
      redirect: 'manual',
    });

    // Brief wait for asynchronous fire-and-forget DB inserts to complete
    await new Promise((r) => setTimeout(r, 200));

    // 3. Query GET /api/v1/stats/:code
    const statsRes = await fetch(`${baseUrl}/api/v1/stats/${alias}`);
    assert.equal(statsRes.status, 200);
    const json = await statsRes.json();

    assert.equal(json.success, true);
    assert.equal(json.data.shortCode, alias);
    assert.equal(json.data.stats.totalClicks, 3);
    assert.ok(Array.isArray(json.data.stats.clicksByDay));
    assert.ok(json.data.stats.clicksByDay.length >= 1);
    assert.ok(Array.isArray(json.data.stats.topReferrers));
  });

  test('Querying stats for nonexistent code returns 404', async () => {
    const statsRes = await fetch(`${baseUrl}/api/v1/stats/nonexistent-code-999`);
    assert.equal(statsRes.status, 404);
    const json = await statsRes.json();
    assert.equal(json.error.code, 'URL_NOT_FOUND');
  });
});
