const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { redis } = require('../src/config/redis');

async function runTests() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Wait briefly for Redis connection to be fully ready
  await new Promise((r) => setTimeout(r, 200));

  if (redis && redis.status === 'ready') {
    await redis.del('rl:shorten:127.0.0.1');
    await redis.del('rl:shorten:::ffff:127.0.0.1');
  }

  console.log('\n--- Running Complete Integrated Test Suite ---');

  // Test 1: Health & Security Headers
  console.log('1. Testing Security Headers & Helmet...');
  const hRes = await fetch(`${baseUrl}/health`);
  assert.equal(hRes.status, 200);
  assert.equal(hRes.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(hRes.headers.get('x-powered-by'), null);
  assert.ok(hRes.headers.has('content-security-policy'));
  console.log('   ✔ Security headers verified (nosniff, CSP, X-Powered-By stripped)');

  // Test 2: Input Validation & Malicious Schemes
  console.log('2. Testing Input Validation & Scheme Blocking...');
  const xssRes = await fetch(`${baseUrl}/api/v1/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl: 'javascript:alert(1)' }),
  });
  assert.equal(xssRes.status, 400);

  const ssrfRes = await fetch(`${baseUrl}/api/v1/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl: 'http://169.254.169.254/latest/meta-data/' }),
  });
  assert.equal(ssrfRes.status, 400);

  const blockRes = await fetch(`${baseUrl}/api/v1/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl: 'https://grabify.link/track/abc' }),
  });
  assert.equal(blockRes.status, 400);
  console.log('   ✔ Malicious inputs blocked (javascript:, SSRF metadata, domain blocklist)');

  // Test 3: Creation with Management Token
  console.log('3. Testing Creation with Management Token...');
  const alias = 'integ-test-' + Date.now();
  const createRes = await fetch(`${baseUrl}/api/v1/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://engineering.paypal.com',
      customAlias: alias,
    }),
  });
  assert.equal(createRes.status, 201);
  const createJson = await createRes.json();
  const token = createJson.data.managementToken;
  assert.ok(token && token.startsWith('mgmt_'));
  console.log('   ✔ Short URL created with one-time management token:', token.substring(0, 15) + '...');

  // Test 4: Cache-Aside & Redirection Latency
  console.log('4. Testing Redirection & Cache-Aside...');
  const t0 = performance.now();
  const missRes = await fetch(`${baseUrl}/${alias}`, { redirect: 'manual' });
  const missDuration = performance.now() - t0;
  assert.equal(missRes.status, 302);
  assert.equal(missRes.headers.get('location'), 'https://engineering.paypal.com');
  assert.equal(missRes.headers.get('x-cache'), 'MISS');

  const t1 = performance.now();
  const hitRes = await fetch(`${baseUrl}/${alias}`, { redirect: 'manual' });
  const hitDuration = performance.now() - t1;
  assert.equal(hitRes.status, 302);
  assert.equal(hitRes.headers.get('x-cache'), 'HIT');
  console.log(`   ✔ Cache Miss: ${missDuration.toFixed(2)}ms | Cache Hit: ${hitDuration.toFixed(2)}ms`);

  // Test 5: Click Analytics Verification
  console.log('5. Testing Protected Analytics...');
  // Wait 100ms for async click insert
  await new Promise((r) => setTimeout(r, 100));

  const unauthStats = await fetch(`${baseUrl}/api/v1/links/${alias}`);
  assert.equal(unauthStats.status, 401);

  const authStats = await fetch(`${baseUrl}/api/v1/links/${alias}`, {
    headers: { 'X-Management-Token': token },
  });
  assert.equal(authStats.status, 200);
  const statsJson = await authStats.json();
  assert.equal(statsJson.data.stats.totalClicks, 2);
  console.log('   ✔ Protected analytics requires valid token, recorded 2 clicks');

  // Test 6: Deletion
  console.log('6. Testing Link Deletion...');
  const delRes = await fetch(`${baseUrl}/api/v1/links/${alias}`, {
    method: 'DELETE',
    headers: { 'X-Management-Token': token },
  });
  assert.equal(delRes.status, 204);

  const getAfterDel = await fetch(`${baseUrl}/${alias}`, { redirect: 'manual' });
  assert.equal(getAfterDel.status, 404);
  console.log('   ✔ Link deleted and cache invalidated immediately');

  console.log('\n--- ALL INTEGRATION TESTS PASSED (6/6) ---');
  server.close();
  await pool.end();
  if (redis) await redis.quit();
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
