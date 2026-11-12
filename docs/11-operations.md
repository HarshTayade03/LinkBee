# Phase 11: Production Operations & Runbook

## 1. Automated Health & Smoke Testing

### Continuous Health Check Endpoint
- **URL**: `GET /health`
- **Response Format**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-12T05:24:00.000Z",
    "services": {
      "database": "connected",
      "redis": "connected"
    }
  }
  ```
- **Probe Logic**:
  - Validates `SELECT 1` execution against PostgreSQL connection pool.
  - Validates `isReady()` status on the Redis cache instance.
  - Used by Render, Kubernetes liveness/readiness probes, and Uptime monitoring services.

### Post-Deployment Smoke Test Script
To verify a new deployment instantly without manual browser clicking, run:
```bash
# Set your deployment URL
TARGET_URL="https://your-app.onrender.com"

# 1. Check Health
curl -s -i "$TARGET_URL/health"

# 2. Test Anonymous Shorten (Guest tier)
curl -s -X POST "$TARGET_URL/api/shorten" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://news.ycombinator.com"}'

# 3. Test Redirection (Expect 302 with Location header)
curl -s -i "$TARGET_URL/<returned_code>"

# 4. Verify Rate Limiter Headers
curl -s -i "$TARGET_URL/api/shorten" | grep "x-ratelimit"
```

---

## 2. Uptime Monitoring & Cold-Start Keepalive

On Render's free tier, services spin down after 15 minutes of inactivity. Setting up a keepalive service keeps your application ready for recruiters or interview demos.

### Setting up Cron-Job.org / UptimeRobot (Free)
1. Register at [Cron-Job.org](https://cron-job.org) or [UptimeRobot.com](https://uptimerobot.com).
2. Create a new monitor / cron job:
   - **URL**: `https://<your-service>.onrender.com/health`
   - **Schedule / Interval**: Every **12 minutes**
   - **Method**: `GET`
   - **Expected Status**: `200 OK`
3. **Monthly Hours Calculation**:
   - 31 days $\times$ 24 hours = 744 hours.
   - Render gives 750 free hours/month.
   - Result: 1 service runs 24/7 without cold starts within the 100% free allowance.

---

## 3. Log Analysis & Observability

### Log Formats
Every request is logged to standard output (`stdout`) in structured format:
```text
2026-11-12T05:15:30.123Z [INFO] GET /abc1234 302 4.2ms - "Mozilla/5.0..."
2026-11-12T05:15:31.456Z [WARN] Rate limit reached for IP 203.0.113.19
2026-11-12T05:15:35.789Z [WARN] Redis connection error: ETIMEDOUT. Operating in DB-only fallback mode.
```

### Key Metrics to Monitor
1. **Cache Hit Ratio**:
   $$\text{Hit Ratio} = \frac{\text{Redis Hits}}{\text{Total Redirection Requests}}$$
   Expected target: $\ge 85\%$ under normal traffic.
2. **Median (p50) & 99th Percentile (p99) Redirection Latency**:
   - Cache hit: Median $\le 10\text{ms}$, p99 $\le 25\text{ms}$.
   - Database fallback: Median $\le 30\text{ms}$, p99 $\le 60\text{ms}$.
3. **Rate Limit 429 Frequency**:
   Sudden spikes indicate brute-force scanning, scraper bots, or DDoS attempts.

---

## 4. Handling Abusive Links & Emergency Blocklisting

URL shorteners are frequent targets for phishing, malware distribution, and illegal content.

### Emergency Link Revocation Procedure
If an abusive link is reported:
1. **Direct SQL Soft or Hard Deletion**:
   ```sql
   -- Find the suspect URL
   SELECT id, short_code, original_url, user_id, created_at 
   FROM urls 
   WHERE short_code = 'maliciousCode' OR original_url ILIKE '%phishing-domain.com%';

   -- Delete the entry (cascades automatically to clicks table)
   DELETE FROM urls WHERE short_code = 'maliciousCode';
   ```
2. **Purge the Redis Cache Immediately**:
   ```text
   DEL url:maliciousCode
   ```
   *(Failing to delete from Redis would keep the redirection active for up to 24 hours!)*
3. **Block Hostname / Domain Pattern**:
   Add the malicious domain to the disallowed hosts list in [`src/middlewares/validate.js`](file:///D:/URL_short/src/middlewares/validate.js).

---

## 5. Secret Rotation & Security Hygiene

| Secret | Rotation Cadence | Impact of Rotation | Zero-Downtime Rotation Strategy |
|---|---|---|---|
| `JWT_SECRET` | 90 days or upon compromise | Invalids all existing user dashboard sessions; users must re-authenticate via Google. Shortlinks continue redirecting without issue. | Deploy with dual-secret verification (check new secret, fallback to old secret) during 24-hour transition window. |
| `DATABASE_URL` | On credential compromise | Disconnects current pool if changed without restart. | Rotate credentials in Neon dashboard, update Render environment variable, trigger zero-downtime rolling restart. |
| `REDIS_URL` | On credential compromise | Temporary fallback to DB-only mode. | Update Render environment variable; app degrades cleanly until connected. |
| `GOOGLE_CLIENT_SECRET` | 180 days | Prevents new OAuth sign-ins if outdated. | Generate secondary secret in Google Cloud Console, update env, verify, delete old secret. |

