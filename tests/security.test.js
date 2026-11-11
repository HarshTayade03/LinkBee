const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { redis } = require('../src/config/redis');

let server;
let baseUrl;

describe('URL Shortener - Security Hardening & Management Token Test Suite', () => {
  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    if (redis) {
      await redis.del('rl:shorten:127.0.0.1');
    }
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    if (redis) {
      await redis.quit();
    }
  });

  test('Enforces Helmet security headers (CSP, X-Content-Type-Options)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    // Verify defensive headers
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.has('content-security-policy'));
    // X-Powered-By must be stripped
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  test('Blocks malicious domain from blocklist (grabify.link)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl: 'https://grabify.link/track/abc' }),
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'BLOCKED_HOST');
  });

  test('Requires management token to view stats (401 Unauthorized without token)', async () => {
    const alias = 'token-test-' + Date.now();
    const createRes = await fetch(`${baseUrl}/api/v1/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl: 'https://paypal.com/security', customAlias: alias }),
    });
    assert.equal(createRes.status, 201);
    const createJson = await createRes.json();
    const token = createJson.data.managementToken;
    assert.ok(token.startsWith('mgmt_'));

    // Attempt to access stats with NO token -> 401 Unauthorized
    const unauthRes = await fetch(`${baseUrl}/api/v1/links/${alias}`);
    assert.equal(unauthRes.status, 401);
    const unauthJson = await unauthRes.json();
    assert.equal(unauthJson.error.code, 'UNAUTHORIZED');

    // Attempt to access stats with INVALID token -> 401 Unauthorized
    const invalidRes = await fetch(`${baseUrl}/api/v1/links/${alias}`, {
      headers: { 'X-Management-Token': 'mgmt_wrongtoken123' },
    });
    assert.equal(invalidRes.status, 401);

    // Access stats with VALID token header -> 200 OK
    const authRes = await fetch(`${baseUrl}/api/v1/links/${alias}`, {
      headers: { 'X-Management-Token': token },
    });
    assert.equal(authRes.status, 200);
    const authJson = await authRes.json();
    assert.equal(authJson.success, true);
    assert.equal(authJson.data.shortCode, alias);
  });

  test('Requires management token to delete a link (DELETE 204)', async () => {
    const alias = 'delete-test-' + Date.now();
    const createRes = await fetch(`${baseUrl}/api/v1/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl: 'https://paypal.com/delete-me', customAlias: alias }),
    });
    assert.equal(createRes.status, 201);
    const { managementToken } = (await createRes.json()).data;

    // Delete without token -> 401
    const unauthDel = await fetch(`${baseUrl}/api/v1/links/${alias}`, { method: 'DELETE' });
    assert.equal(unauthDel.status, 401);

    // Delete with valid token -> 204 No Content
    const authDel = await fetch(`${baseUrl}/api/v1/links/${alias}`, {
      method: 'DELETE',
      headers: { 'X-Management-Token': managementToken },
    });
    assert.equal(authDel.status, 204);

    // Verify link is truly deleted from DB and cache (GET returns 404)
    const getRes = await fetch(`${baseUrl}/${alias}`, { redirect: 'manual' });
    assert.equal(getRes.status, 404);
  });
});
