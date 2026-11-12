# LinkBee Product Design Brief & System Architecture

**Document Version**: 1.0.0  
**Status**: Approved & Ready for Build  
**Audience**: Students, creators, small business owners, community organizers, event planners, and teams.  
**Tone**: Plain, warm, confident, specific. Sentence case everywhere. Zero engineering jargon.

---

## 1. Feature Audit & Ground Truth (What LinkBee Actually Does Today)

Every piece of copy, card, FAQ, and mockup is strictly audited against the real codebase:

| Capability | Backend Implementation | Exact Reality in LinkBee Today |
|---|---|---|
| **Anonymous Link Creation** | `POST /api/v1/shorten` (`optionalAuth`, rate-limited) | An unauthenticated user can create **exactly 1 short link** (tracked by IP in Redis for 30 days). |
| **Anonymous Quota Enforcement** | Redis key `anon:created:<IP>` returns `403 AUTH_REQUIRED_LIMIT` | Subsequent attempts without signing in return: *"You have used your 1 free anonymous link! Please sign in with Google to create and manage more links."* |
| **Anonymous Link Analytics** | `GET /api/v1/links/:code` enforces `requireAuth` & `record.user_id === req.user.id` | Anonymous links **do not have analytics** because they have no owner account (`user_id = NULL`). |
| **Claiming Anonymous Link** | Code audit: no `claim` endpoint exists | **No claiming feature exists**. Copy must be honest: *"Your first link is free with no account. Make a free account to create more and track clicks."* We do **not** promise retrospective claiming. |
| **Authenticated Link Creation** | `POST /api/v1/shorten` with session cookie | Unlimited short links, associated with the Google user account (`user_id`). |
| **Custom Vanity Alias** | `customAlias` parameter in `POST /api/v1/shorten` | Users can specify a custom back-half (e.g., `linkbee.co/launch-party`). Returns `409 ALIAS_IN_USE` if taken. |
| **Link Expiration Date** | `expiresAt` parameter in `POST /api/v1/shorten` | ISO timestamp stored in PostgreSQL. If `NOW() > expires_at`, redirection returns `410 URL_EXPIRED`. |
| **Click Tracking** | `clicks` table via asynchronous `setImmediate` | Tracks each click with `clicked_at`, `referrer`, and `user_agent`. **Stores zero client IP addresses** (privacy-first). |
| **Analytics Dimensions** | `analyticsService.getUrlStats` | Exact stats available: <br>1. **Total Clicks** <br>2. **Clicks per day (Last 30 Days)** <br>3. **Top 5 Referrers** (e.g., Twitter, LinkedIn, Direct) |
| **Link Deletion** | `DELETE /api/v1/links/:code` | Permanent deletion from PostgreSQL + immediate Redis cache eviction. Cascades to `clicks` table. |
| **Editing Destination** | Code audit: no `PUT/PATCH /api/v1/links/:code` endpoint exists | Links cannot be edited after creation. (FAQ honestly answers this). |
| **Authentication** | Google OAuth (`POST /api/v1/auth/google`) + JWT session cookies | One-tap Google sign-in and local development mock sign-in. Sign out clears the `auth_token` cookie. |
| **Disallowed / Non-Existent Features** | *Audit Check* | ❌ No QR codes, ❌ No link-in-bio, ❌ No team workspaces, ❌ No custom domains, ❌ No country/geo-targeting, ❌ No password-protected links. None of these will appear on the site. |

---

## 2. Palette & Design Tokens

Derived from the logo (a honey bee on warm parchment canvas):

```css
:root {
  /* Canvas & Surfaces (Warm Notion Paper) */
  --bg-app: #FBFAF7;              /* Warm off-white canvas */
  --bg-surface: #FFFFFF;          /* Pure white card surface */
  --bg-subtle: #F4F2ED;           /* Subtle tinted neutral for visual areas & hover */
  --bg-subtle-hover: #ECE9E2;

  /* Ink & Contrast Hierarchy */
  --ink: #1C1B19;                 /* Warm charcoal ink (AAA contrast) */
  --ink-secondary: #63615C;       /* Warm readable mid-gray (AA contrast >= 4.5:1) */
  --ink-tertiary: #8F8D87;        /* Placeholder & subtle metadata */

  /* Borders (Crisp 1px Dub-style) */
  --border: #E7E4DC;              /* Soft warm border */
  --border-hover: #D4D0C5;        /* Focused / active border */
  --border-strong: #1C1B19;       /* High-contrast focus outline */

  /* Logo-Derived Brand Accent (Warm Amber / Honey Gold, <= 10% screen usage) */
  --accent: #E58E1A;              /* Warm honey bee amber */
  --accent-hover: #C9770E;
  --accent-tint: #FDF6EC;         /* Soft background tint for chips & badges */
  --accent-border: #F5D3A4;

  /* Status Tokens */
  --success: #15803D;
  --success-bg: #F0FDF4;
  --success-border: #BBF7D0;
  --danger: #B91C1C;
  --danger-bg: #FEF2F2;
  --danger-border: #FECACA;
  --warning: #B45309;
  --warning-bg: #FFFBEB;
  --warning-border: #FDE68A;

  /* Radii & Shadows */
  --radius-sm: 8px;               /* Inputs, buttons, chips */
  --radius-md: 12px;              /* Cards & containers */
  --radius-pill: 9999px;          /* Badges */
  --shadow-dropdown: 0 4px 12px rgba(28, 27, 25, 0.08); /* Minimal shadow */

  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-serif: 'Newsreader', 'Instrument Serif', Georgia, serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
}
```

---

## 3. Typography Scale & Line Heights

- **Display Headline (Hero)**: `48px` / `1.15` (Mobile `32px` / `1.2`), tight tracking `-0.03em`, with **one word in italic serif**.
- **Section Headline (H2)**: `28px` / `1.25`, tight tracking `-0.02em`.
- **Card Title (H3)**: `18px` / `1.3`, semibold, sentence case.
- **Body Large**: `18px` / `1.5`, max line length ~65 characters.
- **Body Regular**: `15px` / `1.5`, color `--ink-secondary`.
- **Caption / Meta**: `13px` / `1.4`, color `--ink-tertiary`.
- **Code / URLs**: Monospace `14px`, tabular numerals.

---

## 4. Component Catalog & Variants

1. **Button**:
   - `primary`: Solid ink (`#1C1B19`) with white text, 8px radius, 44px min height.
   - `accent`: Honey amber (`#E58E1A`) with ink text for focused conversion moments.
   - `secondary`: White surface, 1px border (`--border`), ink text.
   - `ghost`: Transparent, text hover background (`--bg-subtle`).
   - `destructive`: Red text with light red hover.
2. **Hero Input**:
   - 56px height, 1px solid border, internal primary "Shorten" button. Focus ring: 2px offset ink.
3. **Card**:
   - 12px radius, 1px border, white background, 24px padding. Equal height grid.
   - Top 55% visual area has subtle surface background (`#F4F2ED`) and a real HTML/SVG UI preview.
4. **Accordion (FAQ)**:
   - Accessible keyboard-operable disclosure with `aria-expanded` and SVG chevron.
5. **Table-like Row (Dashboard)**:
   - Solid container with 1px divider rows, hover highlight (`--bg-subtle`), destination truncation, copy chip, click sparkline/count, delete action.
6. **Spot Illustrations (Inline Notion-style SVG)**:
   - Clean 1.5px ink line weight, soft warm amber accent fill.

---

## 5. Page & Route Map

1. **Landing Page (`/`)**:
   - Sticky solid navigation (no blur).
   - Hero with input-first Bitly pattern & full 5-state anonymous engine.
   - "How it works" 3-step typographic strip.
   - Feature cards (3-column equal height with real UI mini-previews).
   - Real Analytics Showcase (sample data label).
   - "Made for" use case strip.
   - Truthful FAQ accordion.
   - Final CTA band & calm footer.
2. **Authentication Modals / Cards**:
   - Google Sign-in with clean email display & dev mock.
3. **Dashboard (`/dashboard` or logged-in view)**:
   - Sidebar navigation: Links, Analytics, Account.
   - Link management rows with copy, visit, and delete confirmation dialog.
4. **Analytics View**:
   - Total clicks, last 30 days bar chart, top referrers list.
5. **Public Error Pages**:
   - Link Expired (`410 Gone`).
   - Link Not Found (`404 Not Found`).
6. **Information Pages**:
   - Terms of Service (`/terms`).
   - Privacy Policy (`/privacy`).
   - Report a Link (`/report`).
