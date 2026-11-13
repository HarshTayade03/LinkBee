const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { redis } = require('../src/config/redis');
const userService = require('../src/services/userService');

async function runTests() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Wait briefly for connections
  await new Promise((r) => setTimeout(r, 200));

  if (redis && redis.status === 'ready') {
    await redis.del('rl:shorten:127.0.0.1');
    await redis.del('rl:shorten:::ffff:127.0.0.1');
    await redis.del('anon:created:127.0.0.1');
    await redis.del('anon:created:::ffff:127.0.0.1');
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

  // Test 2: Input Validation & Scheme Blocking
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
  console.log('   ✔ Malicious inputs blocked (javascript:, SSRF metadata)');

  // Test 3: Email & Password Registration
  console.log('3. Testing Email/Password Registration & Username...');
  const testUser = 'user_' + Date.now();
  const testEmail = `${testUser}@linkbee.test`;
  const testPass = 'secretPass123';

  const regRes = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUser,
      email: testEmail,
      password: testPass,
    }),
  });
  assert.equal(regRes.status, 201);
  const regJson = await regRes.json();
  assert.ok(regJson.success);
  assert.equal(regJson.data.user.username, testUser);
  assert.equal(regJson.data.user.email, testEmail);
  assert.equal(regJson.data.user.isVerified, false);
  const cookieHeader = regRes.headers.get('set-cookie');
  console.log('   ✔ Account created with username, email, hashed password, and initial unverified status');

  // Test 4: 5 Free Links Limit for Unverified User
  console.log('4. Testing 5 Short Links Tier for Unverified Users...');
  for (let i = 1; i <= 5; i++) {
    const cRes = await fetch(`${baseUrl}/api/v1/shorten`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      body: JSON.stringify({
        originalUrl: `https://example.com/page-${i}`,
      }),
    });
    assert.equal(cRes.status, 201);
  }
  console.log('   ✔ Successfully created 5 short links as unverified user');

  // 6th link attempt should fail with VERIFICATION_REQUIRED_LIMIT
  const sixthRes = await fetch(`${baseUrl}/api/v1/shorten`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    },
    body: JSON.stringify({
      originalUrl: 'https://example.com/page-6',
    }),
  });
  assert.equal(sixthRes.status, 403);
  const sixthJson = await sixthRes.json();
  assert.equal(sixthJson.error.code, 'VERIFICATION_REQUIRED_LIMIT');
  console.log('   ✔ 6th link properly blocked: requires email verification to unlock unlimited');

  // Test 5: Email Verification Flow
  console.log('5. Testing Email Verification Token Flow...');
  const userRecord = await userService.findUserByLogin(testEmail);
  const dbUser = await pool.query('SELECT verification_token FROM users WHERE id = $1', [userRecord.id]);
  const token = dbUser.rows[0].verification_token;
  assert.ok(token);

  const verifyRes = await fetch(`${baseUrl}/api/v1/auth/verify-email?token=${token}`);
  assert.equal(verifyRes.status, 200);
  const verifiedCookieHeader = verifyRes.headers.get('set-cookie');
  console.log('   ✔ Email successfully verified via token');

  // Test 6: Unlimited Links After Verification
  console.log('6. Testing Unlimited Links After Verification...');
  const unlimRes = await fetch(`${baseUrl}/api/v1/shorten`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': verifiedCookieHeader,
    },
    body: JSON.stringify({
      originalUrl: 'https://example.com/unlimited-success',
      customAlias: 'verified-' + Date.now(),
    }),
  });
  assert.equal(unlimRes.status, 201);
  const unlimJson = await unlimRes.json();
  const verifiedSlug = unlimJson.data.shortCode;
  console.log('   ✔ Link created successfully beyond 5-link limit: /' + verifiedSlug);

  // Test 7: Redirection & Cache-Aside
  console.log('7. Testing Redirection & Cache-Aside...');
  const missRes = await fetch(`${baseUrl}/${verifiedSlug}`, { redirect: 'manual' });
  assert.equal(missRes.status, 302);
  assert.equal(missRes.headers.get('x-cache'), 'MISS');

  const hitRes = await fetch(`${baseUrl}/${verifiedSlug}`, { redirect: 'manual' });
  assert.equal(hitRes.status, 302);
  assert.equal(hitRes.headers.get('x-cache'), 'HIT');
  console.log('   ✔ Redirection verified (Cache Miss -> Cache Hit)');

  // Test 8: Login Flow with Username or Email
  console.log('8. Testing Login with Username and Email...');
  const loginWithUsernameRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: testUser, password: testPass }),
  });
  assert.equal(loginWithUsernameRes.status, 200);

  const loginWithEmailRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: testEmail, password: testPass }),
  });
  assert.equal(loginWithEmailRes.status, 200);
  console.log('   ✔ Sign in verified with both username and email');

  console.log('\n--- ALL INTEGRATION TESTS PASSED (8/8) ---');
  server.close();
  await pool.end();
  if (redis) await redis.quit();
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
