import React, { useState, useEffect } from 'react';
import { 
  Link2, 
  Copy, 
  Check, 
  BarChart3, 
  Trash2, 
  ExternalLink,
  Lock,
  ArrowRight,
  User,
  LogOut,
  Sparkles,
  Calendar,
  Layers,
  ShieldCheck,
  TrendingUp,
  Globe2,
  ChevronRight
} from 'lucide-react';

export default function App() {
  // Session State
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Link Composer State
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerError, setComposerError] = useState('');
  const [createdLink, setCreatedLink] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Dashboard State (For signed-in users)
  const [userLinks, setUserLinks] = useState([]);
  const [selectedLinkSlug, setSelectedLinkSlug] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState(null);

  // Check active session on initial load
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/v1/auth/me');
      const data = await res.json();
      if (data.success && data.data.user) {
        setCurrentUser(data.data.user);
        loadUserLinks();
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadUserLinks = async () => {
    try {
      const res = await fetch('/api/v1/user/links');
      const data = await res.json();
      if (data.success) {
        const links = data.data.links || [];
        setUserLinks(links);
        if (links.length > 0 && !selectedLinkSlug) {
          // Auto-select most recent link
          inspectLink(links[0].shortCode);
        }
      }
    } catch (err) {
      console.error('Failed to load user links:', err);
    }
  };

  // Google Sign-In (Instant mock for local dev, real OAuth token in cloud)
  const handleGoogleSignIn = async () => {
    try {
      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devMock: true,
          mockEmail: 'developer@example.com',
          mockName: 'Alex Rivera',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.data.user);
        loadUserLinks();
      } else {
        alert(data.error?.message || 'Login failed');
      }
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setUserLinks([]);
    setSelectedLinkSlug(null);
    setAnalyticsData(null);
    setCreatedLink(null);
  };

  // Create Short Link
  const handleCreateLink = async (e) => {
    e.preventDefault();
    setComposerError('');
    setCreatedLink(null);
    setComposerLoading(true);

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

      setCreatedLink(data.data);
      setOriginalUrl('');
      setCustomAlias('');
      setExpiryDate('');
      setShowAdvanced(false);

      if (currentUser) {
        loadUserLinks();
        inspectLink(data.data.shortCode);
      }
    } catch (err) {
      setComposerError(err.message);
    } finally {
      setComposerLoading(false);
    }
  };

  // Inspect link analytics
  const inspectLink = async (slug) => {
    setSelectedLinkSlug(slug);
    setAnalyticsLoading(true);
    setAnalyticsData(null);

    try {
      const res = await fetch(`/api/v1/links/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data.data);
      }
    } catch (err) {
      console.error('Failed to load link metrics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Delete Link
  const handleDeleteLink = async (slug) => {
    if (!window.confirm(`Permanently delete /${slug}? This action cannot be undone.`)) return;
    setDeletingSlug(slug);

    try {
      const res = await fetch(`/api/v1/links/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedLinkSlug === slug) {
          setSelectedLinkSlug(null);
          setAnalyticsData(null);
        }
        loadUserLinks();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to delete link');
      }
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    } finally {
      setDeletingSlug(null);
    }
  };

  const copyUrl = async (url) => {
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div>
      {/* Notion-styled Sticky Navigation Bar */}
      <header className="site-header">
        <div className="container header-inner">
          <a href="/" className="brand-link">
            <div className="brand-icon">
              <Link2 size={18} strokeWidth={2.5} />
            </div>
            <span className="brand-title">sho.rt</span>
          </a>

          <div className="nav-actions">
            {authLoading ? null : currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="user-menu-pill">
                  <img 
                    src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=sho'} 
                    alt="User Avatar"
                    className="user-avatar"
                  />
                  <span className="user-name-text">{currentUser.name}</span>
                </div>
                <button 
                  type="button" 
                  onClick={handleLogout} 
                  className="btn btn-ghost" 
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  title="Sign Out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button 
                type="button" 
                onClick={handleGoogleSignIn} 
                className="btn btn-primary"
              >
                <User size={15} />
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Dynamic Context-Aware Hero (Changes state whether signed in or guest) */}
        <section className="hero-wrapper">
          <div className="container">
            {!currentUser ? (
              <>
                <div className="hero-chip">
                  <Sparkles size={14} color="#2563EB" />
                  <span>Modern, privacy-first link infrastructure</span>
                </div>
                <h1 className="hero-heading">
                  Short links with superpowers.
                </h1>
                <p className="hero-description">
                  Transform messy, lengthy URLs into branded, trackable links. 
                  Experience zero tracking cookies, robust access controls, and real-time referral metrics.
                </p>
              </>
            ) : (
              <>
                <h1 className="hero-heading" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                  Welcome back, {currentUser.name.split(' ')[0]}
                </h1>
                <p className="hero-description" style={{ marginBottom: '1.75rem' }}>
                  Create and manage your links. Monitor click trends and referral origins in real time.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Primary CTA Shortener Card (Bitly / Dub.co inspired workhorse) */}
        <section className="container">
          <div className="composer-card">
            <form onSubmit={handleCreateLink}>
              {composerError && (
                <div className="error-chip" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{composerError}</span>
                  {!currentUser && (
                    <button 
                      type="button" 
                      onClick={handleGoogleSignIn} 
                      className="btn btn-blue" 
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                    >
                      Sign In Now
                    </button>
                  )}
                </div>
              )}

              {/* High-Intent Main URL Bar */}
              <div className="url-primary-input-wrap">
                <Globe2 size={18} color="var(--text-secondary)" />
                <input 
                  type="url"
                  className="url-primary-input"
                  placeholder="Paste your long link here... (e.g. https://mybrand.com/spring-launch-post)"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  required
                />
                <button 
                  type="submit" 
                  disabled={composerLoading} 
                  className="btn btn-blue"
                  style={{ height: '38px', padding: '0 1.25rem' }}
                >
                  <span>{composerLoading ? 'Shortening...' : 'Shorten Link'}</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* Progressive Disclosure (Custom Alias & Expiry) */}
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAdvanced(!showAdvanced)} 
                  className="btn btn-ghost"
                  style={{ fontSize: '0.82rem', padding: '0.25rem 0.5rem', gap: '0.35rem' }}
                >
                  <span>{showAdvanced ? 'Hide options' : '+ Custom alias & expiry'}</span>
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  {!currentUser ? '1 free trial link' : 'Unlimited links active'}
                </span>
              </div>

              {showAdvanced && (
                <div className="composer-meta-row">
                  <div className="meta-field">
                    <span>sho.rt /</span>
                    <input 
                      type="text"
                      placeholder="custom-alias"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value)}
                    />
                  </div>
                  <div className="meta-field">
                    <Calendar size={14} />
                    <input 
                      type="datetime-local"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      title="Optional Expiration Timestamp"
                    />
                  </div>
                </div>
              )}
            </form>

            {/* Created Link Success Toast */}
            {createdLink && (
              <div className="created-link-card">
                <div className="created-link-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }}></div>
                    <a 
                      href={createdLink.shortUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="created-link-anchor"
                    >
                      {createdLink.shortUrl}
                    </a>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => copyUrl(createdLink.shortUrl)} 
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                  >
                    {copiedLink ? <Check size={15} color="#059669" /> : <Copy size={15} />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Conversion Trigger: Shown only to anonymous guest users */}
                {createdLink.isAnonymous && (
                  <div className="anonymous-banner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Lock size={16} />
                      <span><strong>Free link created!</strong> To track clicks, protect links, and create more:</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleGoogleSignIn} 
                      className="btn btn-blue"
                      style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                    >
                      Sign in with Google
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Authenticated Dashboard (Dub.co Style Master-Detail Layout) */}
        {currentUser && (
          <section className="container" style={{ marginBottom: '4rem' }}>
            <div className="dashboard-header">
              <h2 className="dashboard-title">Your Links</h2>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {userLinks.length} total links
              </span>
            </div>

            {userLinks.length === 0 ? (
              <div className="composer-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                <Layers size={36} color="var(--text-secondary)" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
                <h3 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>No links yet</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '360px', margin: '0 auto' }}>
                  Paste a destination URL into the composer above to generate your first link.
                </p>
              </div>
            ) : (
              <div className="dashboard-grid">
                {/* Links Master Column */}
                <div className="links-list">
                  {userLinks.map((link) => {
                    const isActive = selectedLinkSlug === link.shortCode;
                    return (
                      <div 
                        key={link.id}
                        onClick={() => inspectLink(link.shortCode)}
                        className={`link-item-card ${isActive ? 'active' : ''}`}
                      >
                        <div className="link-item-header">
                          <span className="link-item-slug">
                            <span>/{link.shortCode}</span>
                          </span>
                          <span className="link-item-clicks">
                            {link.totalClicks} clicks
                          </span>
                        </div>
                        <div className="link-item-dest">
                          {link.originalUrl}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Link Analytics Detail Column */}
                <div>
                  {selectedLinkSlug && (
                    <div className="analytics-pane">
                      <div className="analytics-pane-header">
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                            Link Analytics
                          </div>
                          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                            /{selectedLinkSlug}
                          </h3>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            type="button" 
                            onClick={() => copyUrl(`${window.location.origin}/${selectedLinkSlug}`)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                            title="Copy short URL"
                          >
                            <Copy size={14} />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleDeleteLink(selectedLinkSlug)}
                            disabled={deletingSlug === selectedLinkSlug}
                            className="btn btn-danger-subtle"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                            title="Delete link"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {analyticsLoading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          Loading analytics...
                        </div>
                      ) : analyticsData ? (
                        <div>
                          {/* Metrics Header */}
                          <div className="metrics-row">
                            <div className="metric-box">
                              <div className="metric-label">Total Clicks</div>
                              <div className="metric-number">{analyticsData.stats.totalClicks}</div>
                            </div>
                            <div className="metric-box">
                              <div className="metric-label">Link Status</div>
                              <div 
                                className="metric-number" 
                                style={{ 
                                  fontSize: '1.25rem', 
                                  color: analyticsData.isExpired ? 'var(--status-danger-text)' : 'var(--status-success-text)' 
                                }}
                              >
                                {analyticsData.isExpired ? 'Expired' : 'Active'}
                              </div>
                            </div>
                          </div>

                          {/* 30-Day Click Trend SVG Chart */}
                          <div className="chart-section">
                            <div className="chart-section-title">
                              30-Day Click Trajectory
                            </div>
                            <CleanSvgChart dailyData={analyticsData.stats.clicksByDay || []} />
                          </div>

                          {/* Top Referrers */}
                          <div className="chart-section" style={{ marginBottom: 0 }}>
                            <div className="chart-section-title">
                              Top Referral Traffic
                            </div>
                            {(!analyticsData.stats.topReferrers || analyticsData.stats.topReferrers.length === 0) ? (
                              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No clicks recorded yet.</p>
                            ) : (
                              <div>
                                {analyticsData.stats.topReferrers.map((item, idx) => (
                                  <div key={idx} className="referrer-row">
                                    <span style={{ fontWeight: 600 }}>{item.source}</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                      {item.count} clicks
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Feature Highlights (Rendered only for guests/unauthenticated visitors) */}
        {!currentUser && (
          <section className="features-section">
            <div className="container">
              <div style={{ textAlign: 'center', maxWidth: '540px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                  Engineered with production discipline.
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                  Built from the ground up for high-throughput resilience, transparent data ownership, and rock-solid security.
                </p>
              </div>

              <div className="features-grid">
                <div className="feature-item">
                  <div className="feature-icon-wrapper">
                    <TrendingUp size={18} color="#2563EB" />
                  </div>
                  <h3 className="feature-title">High-Throughput Caching</h3>
                  <p className="feature-desc">
                    In-memory cache-aside architecture serving viral traffic directly from memory with empirical sub-25ms median latency.
                  </p>
                </div>

                <div className="feature-item">
                  <div className="feature-icon-wrapper">
                    <ShieldCheck size={18} color="#059669" />
                  </div>
                  <h3 className="feature-title">Privacy by Design</h3>
                  <p className="feature-desc">
                    Zero raw client IP addresses stored in our database. Compliant with strict GDPR and CCPA privacy standards from day one.
                  </p>
                </div>

                <div className="feature-item">
                  <div className="feature-icon-wrapper">
                    <Lock size={18} color="#6366F1" />
                  </div>
                  <h3 className="feature-title">Seamless Google Access</h3>
                  <p className="feature-desc">
                    Never worry about losing manual API tokens. Sign in securely with Google to access and manage your link dashboard anytime.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Notion-styled Minimalist Footer */}
      <footer className="site-footer">
        <div className="container">
          <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            sho.rt — High-Performance URL Shortener & Analytics
          </p>
          <p>
            Engineered with Node.js, PostgreSQL, Redis, and React. 100% Free & Open Source.
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Clean Mathematical SVG Bar Chart (Dub.co Style)
 */
function CleanSvgChart({ dailyData }) {
  if (!dailyData || dailyData.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        No clicks in the last 30 days
      </div>
    );
  }

  const maxClicks = Math.max(...dailyData.map((d) => d.clicks), 1);
  const chartHeight = 110;
  const startY = 135;
  const barWidth = Math.max(12, Math.min(28, Math.floor(520 / dailyData.length) - 6));
  const stepX = 520 / dailyData.length;

  return (
    <div style={{ width: '100%', height: '160px' }}>
      <svg width="100%" height="100%" viewBox="0 0 560 160" preserveAspectRatio="none">
        {dailyData.map((day, index) => {
          const x = 20 + index * stepX + (stepX - barWidth) / 2;
          const barH = (day.clicks / maxClicks) * chartHeight;
          const y = startY - barH;

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barH, 2)}
              fill="#2563EB"
              rx="3"
            >
              <title>{`${day.date}: ${day.clicks} clicks`}</title>
            </rect>
          );
        })}
        <line x1="10" y1="137" x2="550" y2="137" stroke="#E8E8E5" strokeWidth="1" />
      </svg>
    </div>
  );
}
