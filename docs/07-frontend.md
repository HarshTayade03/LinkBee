# Phase 7: Frontend Application

---

## 1. What We Built in This Phase
In this phase, we built an accessible, responsive, single-page web interface served directly by our Express backend (`public/index.html`, `public/style.css`, and `public/app.js`). We synthesized design inspiration from **Dub.co** (tactile cards, real-time analytics), **Notion** (warm ivory monochrome palette, crisp typography), and **Bitly** (clear call-to-action workhorse and transparent tier comparison). The entire frontend is written in pure vanilla HTML, CSS, and JavaScript with **zero external libraries**, strictly adheres to our strict Content-Security-Policy (no inline scripts), and renders 100% of server data safely without `innerHTML` to prevent Cross-Site Scripting (XSS).

---

## 2. Why This Exists (The Problem It Solves)
A backend API without a user interface is difficult for end-users and non-technical stakeholders to use. However, introducing heavy client-side frameworks (like Next.js or React) for a single-page shortener introduces hundreds of megabytes of `node_modules`, hydration complexity, separate dev servers, and potential CORS or routing conflicts on free-tier hosting platforms. Serving a lightweight vanilla frontend directly from Express proves core HTTP, DOM manipulation, and browser security fundamentals directly in an interview setting.

---

## 3. How It Works

### Frontend Architecture & Data Flow
```
User visits http://localhost:3000/
          |
          v
Express Static Middleware (serves public/index.html, style.css, app.js)
          |
          v
Browser loads assets (Enforces Content-Security-Policy headers from Helmet)
          |
          +---> 1. User submits URL in Shortener Form
          |        - fetch('POST /api/v1/shorten')
          |        - Displays short link & one-time Management Token alert
          |
          +---> 2. User inspects Analytics
          |        - fetch('GET /api/v1/links/:code', { headers: { 'X-Management-Token': token } })
          |        - Pure mathematical SVG Daily Bar Chart generated in DOM
          |        - Top referrers list safely rendered via document.createElement()
          |
          +---> 3. User deletes link (Danger Zone)
                   - fetch('DELETE /api/v1/links/:code', { headers: { 'X-Management-Token': token } })
                   - Link permanently deleted and removed from UI
```

---

## 4. Key Decisions & Alternatives
See **[decision-log.md](decision-log.md)** (ADR-021).

- **Backend-Served Static Assets in `public/` over Monorepo Subfolder Split**:
  - *Choice*: Serve from `public/` using `express.static()`.
  - *Alternative*: Separate `frontend/` and `backend/` directories with separate ports or frameworks.
  - *Reason*: Eliminates CORS issues in production, simplifies Docker builds and CI/CD, requires only one port on free hosting platforms (e.g. Render/Koyeb), and showcases pure DOM manipulation skills.
- **Pure Mathematical SVG Chart vs External Chart Library (Chart.js / Recharts)**:
  - *Choice*: Pure `<svg>` bar chart generated dynamically in JavaScript.
  - *Alternative*: Pulling in a 200kb external charting library.
  - *Reason*: Demonstrates deep frontend engineering competence (calculating coordinates, height scaling, and SVG namespaces) while maintaining a sub-10kb total frontend bundle size.
- **Strict `textContent` and `createElement` over `innerHTML`**:
  - Eliminates DOM-based XSS vulnerabilities entirely.

---

## 5. Code Walkthrough (Reading Order)

1. **[`public/style.css`](../public/style.css)**:
   - Organizes CSS variables at the top (`--bg-canvas`, `--accent-primary`, `--shadow-md`).
   - Implements Neo-Brutalist offset shadows (`4px 4px 0px #1C1917`) with tactile button presses (`transform: translate(2px, 2px)`).
   - Fully responsive grid layout across mobile (360px) and desktop.
2. **[`public/index.html`](../public/index.html)**:
   - Semantic HTML5 structure with `<header>`, `<main>`, `<section>`, and `<footer>`.
   - Accessible labels on every input (`for` matching `id`) and `aria-live` regions for error announcements.
   - Includes transparent pricing section comparing our active Open Source community plan with a planned Pro Cloud vision.
   - Zero inline `<script>` tags, compliant with our strict CSP.
3. **[`public/app.js`](../public/app.js)**:
   - Form submission handlers for link creation and stats inspection using the modern `fetch()` API.
   - Renders SVG bars dynamically using `document.createElementNS('http://www.w3.org/2000/svg', 'rect')`.
   - Implements clipboard copy utilities for links and tokens with temporary feedback states ("Copied!").
4. **[`src/app.js`](../src/app.js)**:
   - Configured `express.static(path.join(__dirname, '../public'))` to serve frontend assets.

---

## 6. Security Notes: DOM-Based XSS Prevention

### The Danger: `innerHTML` Injection
If we rendered user-supplied data (such as the target destination URL or HTTP referrer) using `innerHTML`:
```javascript
// INSECURE VULNERABILITY:
container.innerHTML = `<a href="${data.originalUrl}">${data.originalUrl}</a>`;
```
If an attacker shortened a link whose URL or referrer contained `"><img src=x onerror=alert(document.cookie)>`, the payload would parse as HTML and execute JavaScript in the victim's session.

### The Defense: Safe DOM Manipulation
Our frontend exclusively uses `document.createElement()` and `.textContent`:
```javascript
// SECURE DEFENSE:
const link = document.createElement('span');
link.textContent = data.originalUrl; // Browser treats text strictly as literal string, never HTML
container.appendChild(link);
```
Even if the data contains `<script>` or HTML tags, the browser encodes and renders them strictly as inert text glyphs.

---

## 7. How We Tested It

1. **HTTP Serving Verification**:
   ```bash
   curl -I http://localhost:3000/
   ```
   **Output**:
   ```http
   HTTP/1.1 200 OK
   Content-Type: text/html; charset=UTF-8
   Content-Security-Policy: default-src 'self'; script-src 'self'; ...
   X-Content-Type-Options: nosniff
   ```
2. **End-to-End Automated Test Suite**:
   ```bash
   npm test
   ```
   All 6 integrated test suites pass with 100% success.

---

## 8. Interview Questions (Phase 7 Drill)

1. **Why is using `innerHTML` with data received from a backend API considered a security risk, and how does `textContent` or `document.createElement` eliminate that risk?**
2. **How does our Content-Security-Policy (CSP) interact with the frontend, and what happens if a script tag is placed directly into `index.html`?**
3. **Why did we choose to render the analytics bar chart using pure mathematical SVG instead of installing an external charting library? What are the trade-offs?**

