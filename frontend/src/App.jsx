import React, { useState } from 'react';
import { 
  Zap, 
  Copy, 
  Check, 
  AlertTriangle, 
  BarChart2, 
  Trash2, 
  ExternalLink,
  Lock,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function App() {
  // Shortener Form State
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [shortenError, setShortenError] = useState('');
  const [createdResult, setCreatedResult] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Analytics Inspector State
  const [statsCode, setStatsCode] = useState('');
  const [statsToken, setStatsToken] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // 1. Submit Shorten URL
  const handleShorten = async (e) => {
    e.preventDefault();
    setShortenError('');
    setCreatedResult(null);
    setLoading(true);

    try {
      const payload = {
        originalUrl: originalUrl.trim(),
        customAlias: customAlias.trim() || undefined,
        expiresAt: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      };

      const res = await fetch('/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to shorten URL');
      }

      setCreatedResult(data.data);
      // Pre-populate stats fields for convenience
      setStatsCode(data.data.shortCode);
      setStatsToken(data.data.managementToken);
    } catch (err) {
      setShortenError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Copy Helpers
  const copyToClipboard = async (text, isToken = false) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    if (isToken) {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // 2. Inspect Analytics
  const handleInspectStats = async (e) => {
    e.preventDefault();
    setStatsError('');
    setAnalyticsData(null);
    setStatsLoading(true);

    try {
      const res = await fetch(`/api/v1/links/${encodeURIComponent(statsCode.trim())}`, {
        headers: {
          'X-Management-Token': statsToken.trim(),
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to fetch analytics');
      }

      setAnalyticsData(data.data);
    } catch (err) {
      setStatsError(err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  // 3. Delete Link
  const handleDeleteLink = async () => {
    if (!statsCode || !statsToken) return;
    const confirm = window.confirm(`Permanently delete short link '${statsCode}'? This cannot be undone.`);
    if (!confirm) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/links/${encodeURIComponent(statsCode.trim())}`, {
        method: 'DELETE',
        headers: { 'X-Management-Token': statsToken.trim() },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to delete link');
      }

      alert(`Link '${statsCode}' was successfully deleted.`);
      setAnalyticsData(null);
      setStatsCode('');
      setStatsToken('');
    } catch (err) {
      alert(`Deletion error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* Sticky Header */}
      <header class="site-header">
        <div class="container header-inner">
          <a href="/" class="brand-logo">
            <Zap size={22} color="#2563EB" strokeWidth={3} />
            <span>sho.rt</span>
            <span class="brand-badge">React Monorepo</span>
          </a>
          <nav>
            <ul class="nav-links">
              <li><a href="#shorten" class="nav-link">Shortener</a></li>
              <li><a href="#analytics" class="nav-link">Analytics</a></li>
              <li><a href="#plans" class="nav-link">Plans</a></li>
              <li>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  class="nav-link"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  GitHub <ExternalLink size={14} />
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section class="hero-section">
          <div class="container">
            <div class="hero-pill">
              <Zap size={14} color="#2563EB" />
              <span>Sub-2ms Redis Caching</span>
              <span>•</span>
              <Lock size={14} color="#059669" />
              <span>Zero IP Tracking</span>
            </div>
            <h1 class="hero-title">
              Links that don't look like spam.<br />
              Analytics that don't spy.
            </h1>
            <p class="hero-subtitle">
              Engineered with Node.js, PostgreSQL, Redis, and React. Cache-aside hot path, 
              asynchronous click analytics, and per-link 192-bit cryptographic tokens.
            </p>
          </div>
        </section>

        {/* Shortener Workhorse Card */}
        <section id="shorten" class="container">
          <div class="neo-card">
            <form onSubmit={handleShorten}>
              {shortenError && (
                <div class="error-banner" role="alert">
                  {shortenError}
                </div>
              )}

              <div class="form-group">
                <label htmlFor="url-input" class="form-label">Destination URL</label>
                <input 
                  id="url-input"
                  type="url"
                  class="form-input"
                  placeholder="https://example.com/long-article-path-to-shorten"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  required
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label htmlFor="alias-input" class="form-label">Custom Alias (Optional)</label>
                  <input 
                    id="alias-input"
                    type="text"
                    class="form-input"
                    placeholder="e.g. launch-2026"
                    value={customAlias}
                    onChange={(e) => setCustomAlias(e.target.value)}
                  />
                </div>
                <div class="form-group">
                  <label htmlFor="expiry-input" class="form-label">Expiration Date (Optional)</label>
                  <input 
                    id="expiry-input"
                    type="datetime-local"
                    class="form-input"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} class="btn btn-primary btn-full">
                <span>{loading ? 'Creating short link...' : 'Shorten Link'}</span>
                <ArrowRight size={18} />
              </button>
            </form>

            {/* Success Result Drawer */}
            {createdResult && (
              <div class="result-box">
                <div class="result-url-row">
                  <span class="short-url-text">{createdResult.shortUrl}</span>
                  <button 
                    type="button" 
                    class="btn btn-secondary"
                    onClick={() => copyToClipboard(createdResult.shortUrl, false)}
                  >
                    {copiedLink ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>

                <div class="token-alert">
                  <div class="token-alert-header">
                    <AlertTriangle size={18} />
                    <span>One-Time Management Token (Save this!)</span>
                  </div>
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    This secret token is generated with 192 bits of entropy and shown <strong>once</strong>. 
                    We store only its SHA-256 hash. You need it to view stats or delete this link.
                  </p>
                  <div class="token-display">
                    <span>{createdResult.managementToken}</span>
                    <button 
                      type="button" 
                      class="btn btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                      onClick={() => copyToClipboard(createdResult.managementToken, true)}
                    >
                      {copiedToken ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                      <span>{copiedToken ? 'Copied!' : 'Copy Token'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Analytics Inspector Section */}
        <section id="analytics" class="container" style={{ paddingTop: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Link Analytics Inspector</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Inspect real-time engagement and top referrers using your link's secret management token.
            </p>
          </div>

          <div class="neo-card" style={{ boxShadow: 'var(--shadow-md)' }}>
            <form onSubmit={handleInspectStats}>
              {statsError && <div class="error-banner">{statsError}</div>}

              <div class="form-row">
                <div class="form-group">
                  <label htmlFor="stats-code-input" class="form-label">Short Code or Custom Alias</label>
                  <input 
                    id="stats-code-input"
                    type="text"
                    class="form-input"
                    placeholder="e.g. M2Igdd5 or launch-2026"
                    value={statsCode}
                    onChange={(e) => setStatsCode(e.target.value)}
                    required
                  />
                </div>
                <div class="form-group">
                  <label htmlFor="stats-token-input" class="form-label">Management Token</label>
                  <input 
                    id="stats-token-input"
                    type="text"
                    class="form-input"
                    placeholder="mgmt_..."
                    value={statsToken}
                    onChange={(e) => setStatsToken(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={statsLoading} class="btn btn-secondary">
                <BarChart2 size={18} />
                <span>{statsLoading ? 'Loading metrics...' : 'Inspect Analytics'}</span>
              </button>
            </form>

            {/* Render Analytics Dashboard */}
            {analyticsData && (
              <div style={{ marginTop: '2rem' }}>
                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-label">Total Clicks</div>
                    <div class="stat-value">{analyticsData.stats.totalClicks.toLocaleString()}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Link Status</div>
                    <div 
                      class="stat-value" 
                      style={{ fontSize: '1.5rem', color: analyticsData.isExpired ? '#DC2626' : '#059669' }}
                    >
                      {analyticsData.isExpired ? 'Expired' : 'Active'}
                    </div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Destination URL</div>
                    <div style={{ fontSize: '0.95rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', marginTop: '0.5rem' }}>
                      {analyticsData.originalUrl}
                    </div>
                  </div>
                </div>

                {/* 30-Day SVG Trend Chart */}
                <div class="chart-card">
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
                    30-Day Click Trend
                  </div>
                  <SvgTrendChart dailyData={analyticsData.stats.clicksByDay || []} />
                </div>

                {/* Top Referrers */}
                <div class="chart-card">
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
                    Top Traffic Referrers
                  </div>
                  {(!analyticsData.stats.topReferrers || analyticsData.stats.topReferrers.length === 0) ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>No clicks recorded yet.</p>
                  ) : (
                    <ul style={{ listStyle: 'none' }}>
                      {analyticsData.stats.topReferrers.map((item, idx) => (
                        <li key={idx} class="referrer-item">
                          <span style={{ fontWeight: 600 }}>{item.source}</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{item.count} clicks</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Danger Zone: Delete */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button 
                    type="button" 
                    onClick={handleDeleteLink} 
                    disabled={deleting} 
                    class="btn btn-danger"
                  >
                    <Trash2 size={16} />
                    <span>{deleting ? 'Deleting...' : 'Delete This Link'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Pricing / Tiers Section */}
        <section id="plans" class="pricing-section">
          <div class="container">
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Transparent Tiers & Roadmap</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                Our production open-source engine active today, alongside planned high-throughput expansions.
              </p>
            </div>

            <div class="pricing-grid">
              {/* Community OSS */}
              <div class="plan-card featured">
                <span class="plan-badge">Active Deployment</span>
                <h3 class="plan-name">Community OSS</h3>
                <div class="plan-price">$0 <span>/ forever</span></div>
                <ul class="plan-features">
                  <li class="plan-feature-item">✔ <strong>10 links / minute</strong> rate limit per IP</li>
                  <li class="plan-feature-item">✔ <strong>Sub-2ms Redis</strong> cache-aside redirect latency</li>
                  <li class="plan-feature-item">✔ <strong>30-day analytics</strong> trend retention</li>
                  <li class="plan-feature-item">✔ <strong>Custom aliases</strong> & expiration controls</li>
                  <li class="plan-feature-item">✔ <strong>Zero IP storage</strong> (Privacy by Design)</li>
                  <li class="plan-feature-item">✔ <strong>Hashed tokens</strong> for authorization</li>
                </ul>
                <a href="#shorten" class="btn btn-primary">Start Shortening</a>
              </div>

              {/* Pro Cloud (Future Vision) */}
              <div class="plan-card">
                <h3 class="plan-name">Pro Cloud</h3>
                <div class="plan-price">$12 <span>/ month (Planned)</span></div>
                <ul class="plan-features">
                  <li class="plan-feature-item">⏳ <strong>Custom domains</strong> (e.g. go.brand.com)</li>
                  <li class="plan-feature-item">⏳ <strong>1,000 links / min</strong> high-throughput tier</li>
                  <li class="plan-feature-item">⏳ <strong>Multi-region Redis</strong> replication</li>
                  <li class="plan-feature-item">⏳ <strong>Real-time webhooks</strong> on click events</li>
                  <li class="plan-feature-item">⏳ <strong>Team accounts</strong> & RBAC permissions</li>
                  <li class="plan-feature-item">⏳ <strong>SSO / SAML login</strong> integration</li>
                </ul>
                <button type="button" class="btn btn-secondary" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer class="site-footer">
        <div class="container">
          <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
            ⚡ sho.rt — Engineered with Node.js, Express, PostgreSQL, Redis, and React.
          </p>
          <p>Built for PayPal-level backend interviews. Zero tracking cookies. 100% Free & Open Source.</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Pure SVG Mathematical Chart Component (Zero external dependencies)
 */
function SvgTrendChart({ dailyData }) {
  if (!dailyData || dailyData.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', color: 'var(--text-muted)' }}>
        No daily click activity recorded yet.
      </div>
    );
  }

  const maxClicks = Math.max(...dailyData.map((d) => d.clicks), 1);
  const chartHeight = 130;
  const startY = 160;
  const barWidth = Math.max(10, Math.min(30, Math.floor(540 / dailyData.length) - 8));
  const stepX = 540 / dailyData.length;

  return (
    <div style={{ width: '100%', height: '180px' }}>
      <svg width="100%" height="100%" viewBox="0 0 600 180" preserveAspectRatio="none">
        {dailyData.map((day, index) => {
          const x = 30 + index * stepX + (stepX - barWidth) / 2;
          const barH = (day.clicks / maxClicks) * chartHeight;
          const y = startY - barH;

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barH, 3)}
              fill="#2563EB"
              stroke="#1C1917"
              strokeWidth="2"
              rx="2"
            >
              <title>{`${day.date}: ${day.clicks} clicks`}</title>
            </rect>
          );
        })}
        <line x1="20" y1="162" x2="580" y2="162" stroke="#1C1917" strokeWidth="2" />
      </svg>
    </div>
  );
}
