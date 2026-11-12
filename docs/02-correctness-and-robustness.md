# Phase 2: Correctness and Robustness

---

## 1. What We Built in This Phase
In this phase, we transformed our basic proof-of-concept into a hardened, production-grade URL shortening pipeline. We implemented a dedicated validation middleware that sanitizes inputs, enforces length boundaries (max 2048 chars), restricts schemes strictly to `http:` and `https:` while blocking dangerous protocols (`javascript:`, `data:`, `file:`), blocks SSRF and loopback exploits (`localhost`, AWS/GCP metadata), supports custom aliases with collision detection (HTTP `409 Conflict`), supports optional link expiration with HTTP `410 Gone`, and created an automated integration test suite with 13 comprehensive tests.

---

## 2. Why This Exists (The Problem It Solves)
A URL shortener that accepts any string will quickly be exploited by attackers or corrupted by bad data:
1. **Cross-Site Scripting (XSS)**: If a shortener allows `javascript:alert(document.cookie)`, visiting the short link will execute arbitrary JavaScript in the victim's browser.
2. **Server-Side Request Forgery (SSRF)**: Attackers point short URLs to `http://169.254.169.254` (cloud metadata) to extract cloud IAM credentials.
3. **Loopback Redirect Loops**: Pointing a short URL back to itself or our domain exhausts server sockets and causes infinite redirect loops.
4. **Vague Error Responses**: When things fail, clients need clear, machine-readable errors (e.g. `409 Conflict` when an alias is taken, `410 Gone` when expired, `400 Bad Request` when inputs are invalid).

---

## 3. How It Works

### Validation & Redirection Logic Flow

```
POST /api/v1/shorten
         |
         v
+-------------------------------+
| validateShortenRequest        |
| - originalUrl present & string|
| - Length <= 2048 chars        |
| - Protocol in ['http:','https:'] |  ---> (Invalid) ---> 400 Bad Request
| - Block 'javascript:', 'data:'|
| - Block localhost, 169.254... |
| - Custom alias regex & reserved|
| - Expiration timestamp checks |
+---------------+---------------+
                | (Valid)
                v
+-------------------------------+
| urlService.createShortUrl     |
| - Custom alias?               |
|    - Yes: INSERT once         |  ---> (Duplicate) ---> 409 Conflict
|    - No: Generate + retry (3x)|
+---------------+---------------+
                |
                v
          201 Created


GET /:code
         |
         v
+-------------------------------+
| urlService.getUrlByCode       |
| - Found in PostgreSQL?        |  ---> (No) ----------> 404 Not Found
| - Has expires_at passed now?  |  ---> (Yes) ---------> 410 Gone
+---------------+---------------+
                | (Valid & Active)
                v
          302 Found (Location: originalUrl)
```

---

## 4. Key Decisions & Alternatives
See **[decision-log.md](decision-log.md)** (ADR-008, ADR-009, ADR-010).

- **Scheme Whitelisting over Blacklisting**:
  - *Choice*: Only permit `http:` and `https:`.
  - *Alternative*: Blacklist known bad schemes (`javascript:`, `data:`).
  - *Reason*: Blacklists are notoriously incomplete (attackers find obscure schemes like `vbscript:`, `blob:`, `about:`). Whitelisting explicitly guarantees safety.
- **HTTP 409 Conflict for Alias Collision**:
  - When an alias is taken, returning `409 Conflict` tells the client specifically that the resource already exists and cannot be overwritten.
- **HTTP 410 Gone for Expired Links**:
  - Returning `410 Gone` rather than `404 Not Found` accurately informs crawlers, clients, and browser caches that the link was valid previously but has intentionally expired.

---

## 5. Code Walkthrough (Reading Order)

1. **[`src/middlewares/validate.js`](../src/middlewares/validate.js)**:
   - Contains `validateShortenRequest`.
   - Uses WHATWG `new URL(originalUrl)` to parse protocol and hostname.
   - Enforces `RESERVED_ALIASES` (`api`, `health`, `docs`, `stats`, etc.) to prevent users from hijacking critical API routes.
   - Blocks `BLOCKED_HOSTNAMES` (`localhost`, `127.0.0.1`, `169.254.169.254`).
2. **[`src/services/urlService.js`](../src/services/urlService.js)**:
   - Defines `AliasConflictError` (HTTP 409).
   - If `customAlias` is passed, runs single insert; on PostgreSQL error code `23505`, throws `AliasConflictError`.
   - Checks expiration: `getUrlByCode` compares `record.expires_at` with `new Date()`.
3. **[`src/routes/api.js`](../src/routes/api.js)**:
   - Applies `validateShortenRequest` middleware before the handler.
   - Catches `AliasConflictError` and returns HTTP `409 Conflict`.
4. **[`src/routes/redirect.js`](../src/routes/redirect.js)**:
   - Calls `getUrlByCode`. Returns HTTP `404` if not found; returns HTTP `410` if `isExpired: true`; otherwise issues HTTP `302`.
5. **[`tests/url.test.js`](../tests/url.test.js)**:
   - Native Node.js test suite with 13 automated tests verifying all validation, security rejections, custom aliases, collisions, and expiration.

---

## 6. What Can Go Wrong & How We Handle It

| Failure Case | What Happens | How the Code Handles It |
| :--- | :--- | :--- |
| **XSS Scheme Injection** | User submits `javascript:alert(1)`. | Rejected by `validateShortenRequest` with HTTP `400 Bad Request` (`UNSUPPORTED_SCHEME`). |
| **Cloud SSRF Probe** | Attacker tries to shorten `http://169.254.169.254/latest/meta-data/`. | Parsed hostname matches `BLOCKED_HOSTNAMES`; rejected with HTTP `400` (`BLOCKED_HOST`). |
| **Infinite Redirect Loop** | Attacker tries to shorten our own domain (`http://localhost:3000/xyz`). | Hostname matched against `config.baseUrl`; rejected with HTTP `400` (`SELF_REDIRECT_LOOP`). |
| **Alias Taken** | User chooses an alias that another user already claimed. | Database throws `23505`; service translates to `AliasConflictError`; route returns HTTP `409 Conflict`. |
| **Expired Link Clicked** | User clicks a link whose `expiresAt` has passed. | Route checks timestamp and returns HTTP `410 Gone`. |

---

## 7. Security Notes

- **XSS via Redirect**:
  - If a server responds with `Location: javascript:alert(document.domain)`, web browsers execute the script in the context of the origin issuing the redirect. Restricting schemes to `http:` and `https:` eliminates this attack vector entirely.
- **SSRF via Cloud Metadata**:
  - Cloud instances (AWS EC2, Google Cloud, Azure) expose internal metadata APIs at `169.254.169.254` that contain temporary IAM credentials and configuration tokens. Rejecting this IP prevents attackers from tricking our servers or internal crawlers into accessing metadata.

---

## 8. How We Tested It

We run the full test suite using Node's native test runner:
```bash
npm test
```

**Test Output**:
```
✔ rejects missing originalUrl with 400 (57.69ms)
✔ rejects malicious javascript: pseudo-protocol (XSS attempt) (7.35ms)
✔ rejects data: URI scheme (7.35ms)
✔ rejects file: URI scheme (3.39ms)
✔ rejects localhost and 127.0.0.1 loopback (SSRF protection) (4.01ms)
✔ rejects AWS/GCP metadata endpoint (SSRF protection) (3.04ms)
✔ rejects URLs exceeding 2048 characters (3.33ms)
✔ rejects invalid custom alias format (too short / special chars) (3.57ms)
✔ rejects reserved system keywords as alias (3.72ms)
✔ successfully creates a valid custom alias (46.51ms)
✔ returns 409 Conflict when custom alias is already taken (11.58ms)
✔ rejects past expiration date with 400 (3.22ms)
✔ returns 410 Gone when accessing an expired link (1533.41ms)

ℹ tests 13 | pass 13 | fail 0
```
*Proves*: All 13 tests pass with 0 failures, verifying input validation, security controls, alias conflict handling, and expiration.

---

## 9. Interview Questions (Phase 2 Drill)

1. **Why is scheme whitelisting (`['http:', 'https:']`) fundamentally safer than blacklisting known malicious schemes like `javascript:`?**
2. **What is the semantic difference between HTTP 404 (Not Found) and HTTP 410 (Gone), and why does it matter for search engines and API consumers?**
3. **What is Server-Side Request Forgery (SSRF), and why is blocking `169.254.169.254` critical for modern cloud-deployed backends?**

---

## 10. Common Mistakes Beginners Make Here
1. **Validating URLs with overly complex regexes**: Using massive regular expressions to validate URLs often leads to ReDoS (Regular Expression Denial of Service) or edge-case parsing bugs. Always use the built-in WHATWG `new URL()` parser.
2. **Returning 500 for business logic conflicts**: Throwing an unhandled database error when an alias is taken rather than returning HTTP `409 Conflict`.
3. **Trusting client-side date checks**: Relying on the client to check if a link is expired instead of enforcing expiration on the backend redirect path.

