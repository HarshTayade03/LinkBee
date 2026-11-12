# Security Q&A & Threat Model

In payment and financial technology companies like **PayPal**, security is non-negotiable. This document covers the comprehensive threat model, OWASP Top 10 defenses, and security interview questions.

---

## 1. Threat Modeling: Attacker Personas & Attack Vectors

| Attacker Persona | Objective | Attack Vector | Our Mitigation |
|---|---|---|---|
| **Malicious Internal Recon Actor** | Map private cloud infrastructure / steal instance metadata | Server-Side Request Forgery (SSRF) via `http://169.254.169.254` | Strict DNS resolution check, protocol whitelist (`http:`, `https:`), loopback/RFC 1918 private IP range rejection. |
| **Credential Harvester / Phisher** | Trick users into trusting malicious domains disguised as short links | Shortening malware or credential phishing links | Domain blocklisting, safe browsing hooks, instant cache+DB revocation runbook. |
| **DDoS Botnet** | Exhaust server CPU/memory or DB connections | High-frequency link shortening or enumeration crawling | Atomic Redis token bucket rate limiting (429 Too Many Requests) + IP reputation checks. |
| **Malicious Script Injector** | Steal user sessions or perform account actions | Cross-Site Scripting (XSS) via custom short codes or referrers | Input sanitization, Helmet Content-Security-Policy (CSP), and `HttpOnly` cookie tokens. |
| **Link Hijacker / Competitor** | Guess existing links or brute-force user vanity URLs | Short code enumeration & sequential ID guessing | 7-character randomized Base62 ($3.52\text{ trillion}$ space) making blind enumeration computationally infeasible. |

---

## 2. Security Interview Questions & Detailed Responses

### Q1: How do you defend against SSRF (Server-Side Request Forgery) in a URL shortener?
**Answer**:
SSRF is one of the highest severity risks in URL shorteners because the server accepts arbitrary user-supplied URLs.
1. **Scheme Whitelist**: We explicitly allow only `http:` and `https:`. All other protocols (`ftp:`, `file:`, `javascript:`, `data:`, `gopher:`) are rejected with `400 Bad Request`.
2. **Hostname Validation**: We reject loopback hostnames (`localhost`, `127.0.0.1`, `::1`).
3. **Private Subnet Resolution**: We resolve the IP address of the target host and block all private IP allocations defined in RFC 1918:
   - `10.0.0.0/8`
   - `172.16.0.0/12`
   - `192.168.0.0/16`
   - Cloud metadata IP: `169.254.169.254`
4. **Self-Referential Prevention**: We check whether the target URL matches our own domain to prevent infinite redirect loops.

### Q2: Why did you choose HttpOnly cookies over Bearer tokens in Authorization headers?
**Answer**:
- If a JWT is stored in `localStorage` or `sessionStorage`, any Cross-Site Scripting (XSS) vulnerability (such as a compromised third-party npm package) can read `window.localStorage` and exfiltrate the token to an external attacker server.
- Storing JWTs in **`HttpOnly; Secure; SameSite=Lax`** cookies means the browser handles transmission automatically, but client-side JavaScript has zero access to the cookie string (`document.cookie` cannot see it).
- Even if an XSS flaw exists on the frontend, the attacker cannot steal the token.

### Q3: How do you prevent Cross-Site Request Forgery (CSRF) with cookies?
**Answer**:
1. We set the cookie attribute `SameSite=Lax` (or `SameSite=Strict`). With `SameSite=Lax`, modern browsers do not send the authentication cookie on cross-site asynchronous requests (such as `fetch()` or `XMLHttpRequest` initiated from an attacker's website).
2. For sensitive state-changing endpoints (creating/deleting links), requests require `POST`/`DELETE` verbs with `Content-Type: application/json`. Standard HTML form submissions (`multipart/form-data` or `application/x-www-form-urlencoded`) cannot trigger JSON REST APIs without CORS preflight failures.

### Q4: How do you prevent SQL Injection in your database queries?
**Answer**:
We strictly use **parameterized queries** provided by `pg`:
```javascript
// SAFE: Parameterized query
await pool.query('SELECT * FROM urls WHERE short_code = $1', [code]);

// NEVER: String concatenation
// await pool.query(`SELECT * FROM urls WHERE short_code = '${code}'`);
```
Parameterized queries ensure the database driver sends the query template and the user values as separate protocol packets. PostgreSQL parses the query tree before binding parameters, rendering SQL injection structurally impossible.

### Q5: How do you prevent timing attacks during authentication or token verification?
**Answer**:
When comparing sensitive secrets (such as API keys or webhook HMAC signatures), standard string equality `a === b` terminates early on the first non-matching byte, leaking execution time to attackers.
- To prevent this, we use `crypto.timingSafeEqual(bufferA, bufferB)`, ensuring the comparison takes identical execution time regardless of whether the match succeeds or fails.
