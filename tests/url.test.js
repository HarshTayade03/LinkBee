const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool } = require('../src/config/db');

let server;
let baseUrl;

describe('URL Shortener - Correctness & Robustness Test Suite', () => {
  before(async () => {
    // Start server on an ephemeral port
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
  });

  describe('1. Input Validation & Security Rejections', () => {
    test('rejects missing originalUrl with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'MISSING_URL');
    });

    test('rejects malicious javascript: pseudo-protocol (XSS attempt)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl: 'javascript:alert(document.cookie)' }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'UNSUPPORTED_SCHEME');
    });

    test('rejects data: URI scheme', async () => {
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl: 'data:text/html,<script>alert(1)</script>' }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'UNSUPPORTED_SCHEME');
    });

    test('rejects file: URI scheme', async () => {
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl: 'file:///etc/passwd' }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'UNSUPPORTED_SCHEME');
    });

    test('rejects localhost and 127.0.0.1 loopback (SSRF protection)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl: 'http://localhost:8080/admin' }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'BLOCKED_HOST');
    });

    test('rejects AWS/GCP metadata endpoint (SSRF protection)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl: 'http://169.254.169.254/latest/meta-data/' }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'BLOCKED_HOST');
    });

    test('rejects URLs exceeding 2048 characters', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2050);
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl: longUrl }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'URL_TOO_LONG');
    });
  });

  describe('2. Custom Alias Handling & Collisions', () => {
    test('rejects invalid custom alias format (too short / special chars)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalUrl: 'https://paypal.com',
          customAlias: 'ab@#$',
        }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'INVALID_ALIAS_FORMAT');
    });

    test('rejects reserved system keywords as alias', async () => {
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalUrl: 'https://paypal.com',
          customAlias: 'health',
        }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'RESERVED_ALIAS');
    });

    test('successfully creates a valid custom alias', async () => {
      const uniqueAlias = 'test-alias-' + Date.now();
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalUrl: 'https://news.ycombinator.com',
          customAlias: uniqueAlias,
        }),
      });
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.data.shortCode, uniqueAlias);

      // Verify redirect works
      const redirectRes = await fetch(`${baseUrl}/${uniqueAlias}`, { redirect: 'manual' });
      assert.equal(redirectRes.status, 302);
      assert.equal(redirectRes.headers.get('location'), 'https://news.ycombinator.com');
    });

    test('returns 409 Conflict when custom alias is already taken', async () => {
      const duplicatedAlias = 'dup-alias-' + Date.now();

      // First creation succeeds
      const firstRes = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalUrl: 'https://example.com/first',
          customAlias: duplicatedAlias,
        }),
      });
      assert.equal(firstRes.status, 201);

      // Second creation with same alias must return 409 Conflict
      const secondRes = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalUrl: 'https://example.com/second',
          customAlias: duplicatedAlias,
        }),
      });
      assert.equal(secondRes.status, 409);
      const json = await secondRes.json();
      assert.equal(json.error.code, 'ALIAS_IN_USE');
    });
  });

  describe('3. Link Expiration (410 Gone)', () => {
    test('rejects past expiration date with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalUrl: 'https://paypal.com',
          expiresAt: '2020-01-01T00:00:00.000Z',
        }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, 'EXPIRY_IN_PAST');
    });

    test('returns 410 Gone when accessing an expired link', async () => {
      // Set expiry to 1 second in future
      const expiry = new Date(Date.now() + 1000).toISOString();
      const res = await fetch(`${baseUrl}/api/v1/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalUrl: 'https://paypal.com/expiring-soon',
          expiresAt: expiry,
        }),
      });
      assert.equal(res.status, 201);
      const json = await res.json();
      const code = json.data.shortCode;

      // Wait 1.5 seconds for link to expire
      await new Promise((r) => setTimeout(r, 1500));

      const redirectRes = await fetch(`${baseUrl}/${code}`, { redirect: 'manual' });
      assert.equal(redirectRes.status, 410);
      const redirectJson = await redirectRes.json();
      assert.equal(redirectJson.error.code, 'URL_EXPIRED');
    });
  });
});
