# Phase 6: Security Hardening

---

## 1. What We Built in This Phase
In this phase, we completed a comprehensive security hardening pass across our entire backend stack. We integrated `helmet` with a strict Content-Security-Policy (CSP) that blocks inline scripts, configured strict origin-locked CORS, introduced a **per-link secret management token model** (hashed with SHA-256 and verified using constant-time comparison) to authorize analytics viewing and link deletion without requiring a heavy user-login system, added an abuse blocklist, audited dependencies with `npm audit` (0 vulnerabilities), and updated [`docs/security-checklist.md`](security-checklist.md).

---

## 2. Why This Exists (The Problem It Solves)
A URL shortener without authentication and defensive headers is vulnerable to:
1. **Unauthorized Link Manipulation & Stats Snooping**: Anyone who guesses or discovers a short code can see the owner's click traffic or delete their links.
2. **Timing Attacks**: Standard string comparison (`===`) terminates on the first mismatched byte, allowing an attacker to deduce secret tokens by measuring network response times down to nanoseconds.
3. **Cross-Origin & Content Injection Attacks**: Without strict CORS and CSP headers, malicious third-party websites can query the API on behalf of users or execute inline scripts.

---

## 3. How It Works

### The Per-Link Management Token Architecture
```
Link Creator (POST /api/v1/shorten)
         |
         v
+------------------------------------+
| 1. Generate 192-bit crypto token   |  ---> mgmt_c1afcec08f654b2...
| 2. Compute SHA-256 hash            |  ---> 8a7d3f... (64-char hex)
| 3. Store ONLY hash in PostgreSQL   |
| 4. Return RAW token ONCE to client |
+------------------------------------+

Protected Operation (GET /api/v1/links/:code or DELETE)
         |
         v
+------------------------------------+
| 1. Client sends token in header:   |
|    X-Management-Token: mgmt_...    |
| 2. Server hashes incoming token    |
| 3. crypto.timingSafeEqual()        |
|    - Valid: 200 OK / 204 Deleted   |
|    - Invalid: 401 Unauthorized     |
+------------------------------------+
```

### Hashing vs Encryption & Fast Hash vs Slow Hash
- **Hashing vs Encryption**:
  - **Encryption** is two-way: with a secret key, cipher text can be decrypted back into plaintext.
  - **Hashing** is strictly one-way: plaintext produces a digest, but the digest can never be reversed.
  - Storing only hashes means that even if an attacker completely compromises or dumps our PostgreSQL database, **they cannot recover the original management tokens** to tamper with user links!
- **Why Fast SHA-256 is Ideal Here (and bcrypt is NOT)**:
  - Slow adaptive hashing (like bcrypt or Argon2) was invented to protect **low-entropy human passwords** (e.g. `Password123!`) from offline GPU dictionary attacks by artificially burning 100ms of CPU per hash.
  - Our management tokens are generated with 192 bits of cryptographic randomness (`crypto.randomBytes(24)`). There are $2^{192}$ possible tokens. An attacker with all the supercomputers on Earth could not brute-force a single token in a billion years.
  - Because entropy is already maximal, using a fast cryptographic hash (SHA-256) provides 100% security with sub-millisecond CPU overhead.

---

## 4. OWASP Top 10 Mapping for Our URL Shortener

| OWASP Vulnerability | Relevance to URL Shortener | Our Defense |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Viewing another user's analytics or deleting someone else's short link. | Per-link management token verified via constant-time SHA-256 hash check before reading analytics or running `DELETE`. |
| **A02: Cryptographic Failures** | Plaintext tokens in database or weak randomness (`Math.random()`). | `crypto.randomBytes(24)` for generation; SHA-256 hashing for storage; HTTPS enforced via HSTS headers. |
| **A03: Injection (SQLi & SSRF)** | SQL injection in parameters; SSRF targeting `169.254.169.254`. | 100% parameterized SQL queries (`$1, $2`); strict URL scheme whitelisting (`http:`/`https:`); blocked internal/metadata IPs. |
| **A04: Insecure Design** | Infinite redirect loops; lack of rate limits leading to DoS. | Loopback detection against `BASE_URL`; atomic Redis fixed-window rate limiter on creation endpoint. |
| **A05: Security Misconfiguration** | Leaking stack traces; exposing `X-Powered-By`; permissive CORS. | Generic JSON error envelopes; `helmet()` security headers; CORS restricted to exact allowed frontend origin. |
| **A06: Vulnerable Components** | Outdated or compromised npm libraries. | Pinned dependencies in `package-lock.json`; automated `npm audit` passing with **0 vulnerabilities**. |
| **A07: Identification & Auth Failures** | Credential stuffing on user logins. | Not applicable directly: we chose the token-per-link model specifically to eliminate password storage risks while maintaining access control. |
| **A08: Software & Data Integrity** | Accepting huge or malformed JSON payloads (payload bombs). | Body-parser limit enforced at `10kb` (`express.json({ limit: '10kb' })`). |
| **A09: Logging & Monitoring Failures** | Logging secret tokens or failing to detect brute force attempts. | Server logs scrubbed: management tokens, passwords, and sensitive URLs are never logged to console or logs. |
| **A10: Server-Side Request Forgery** | Attacker shortening internal service URLs or probing cloud ports. | Strict hostname and IP blocking in `validateShortenRequest`. |

---

## 5. Security Notes: Attack Demonstrations & Why We Are Safe

### Attack 1: SQL Injection
- **Vulnerable Code Pattern**:
  ```javascript
  // INSECURE
  db.query(`SELECT * FROM urls WHERE short_code = '${req.params.code}'`);
  ```
  If an attacker sends code `' OR '1'='1`, the query becomes `SELECT * FROM urls WHERE short_code = '' OR '1'='1'`, dumping all links.
- **Why Our Code Is Safe**:
  ```javascript
  // SECURE
  db.query('SELECT * FROM urls WHERE short_code = $1', [shortCode]);
  ```
  PostgreSQL treats `$1` as literal text. The SQL compiler never executes parameter text as SQL statements.

### Attack 2: Timing Attack on Token Verification
- **Vulnerable Code Pattern**:
  ```javascript
  // INSECURE
  if (record.mgmt_token_hash === reqTokenHash) { ... }
  ```
  JavaScript's `===` compares strings character by character from left to right and exits early on the first difference. An attacker sending thousands of requests can measure network roundtrip differences in nanoseconds to deduce each character of the hash sequentially.
- **Why Our Code Is Safe**:
  ```javascript
  // SECURE
  crypto.timingSafeEqual(Buffer.from(hashA), Buffer.from(hashB));
  ```
  `crypto.timingSafeEqual` executes in constant time regardless of where the mismatch occurs, completely neutralizing timing analysis.

---

## 6. How We Tested It

We verified the complete security pipeline via our automated test runner:
```bash
npm test
```
**Output**:
```
--- Running Complete Integrated Test Suite ---
1. Testing Security Headers & Helmet...
   ✔ Security headers verified (nosniff, CSP, X-Powered-By stripped)
2. Testing Input Validation & Scheme Blocking...
   ✔ Malicious inputs blocked (javascript:, SSRF metadata, domain blocklist)
3. Testing Creation with Management Token...
   ✔ Short URL created with one-time management token: mgmt_c1afcec08f...
4. Testing Redirection & Cache-Aside...
   ✔ Cache Miss: 9.43ms | Cache Hit: 2.58ms
5. Testing Protected Analytics...
   ✔ Protected analytics requires valid token, recorded 2 clicks
6. Testing Link Deletion...
   ✔ Link deleted and cache invalidated immediately

--- ALL INTEGRATION TESTS PASSED (6/6) ---
```

---

## 7. Interview Questions (Phase 6 Drill)

1. **Why is SHA-256 appropriate for hashing high-entropy management tokens, whereas passwords must use slow adaptive algorithms like bcrypt or Argon2id?**
2. **What is a side-channel timing attack, and how does `crypto.timingSafeEqual` protect token comparisons from it?**
3. **What is a Content-Security-Policy (CSP), and why is blocking `'unsafe-inline'` scripts critical for preventing Cross-Site Scripting (XSS)?**

