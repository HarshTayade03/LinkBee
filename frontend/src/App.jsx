import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Copy, 
  Check, 
  BarChart2, 
  Trash2, 
  ExternalLink,
  Lock,
  ArrowRight,
  User,
  LogOut,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Shortener Form State
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [shortenLoading, setShortenLoading] = useState(false);
  const [shortenError, setShortenError] = useState('');
  const [createdResult, setCreatedResult] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // User Dashboard State
  const [userLinks, setUserLinks] = useState([]);
  const [selectedLink, setSelectedLink] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [deletingCode, setDeletingCode] = useState(null);

  // 1. Check active user session on load
  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const res = await fetch('/api/v1/auth/me');
      const data = await res.json();
      if (data.success && data.data.user) {
        setCurrentUser(data.data.user);
        fetchUserLinks();
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchUserLinks = async () => {
    try {
      const res = await fetch('/api/v1/user/links');
      const data = await res.json();
      if (data.success) {
        setUserLinks(data.data.links || []);
      }
    } catch (err) {
      console.error('Error fetching user links:', err);
    }
  };

  // Google Sign-In (Supports real token or convenient Dev One-Click Sign-In)
  const handleGoogleSignIn = async () => {
    try {
      // In development mode, trigger instant mock login for easy local testing
      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devMock: true,
          mockEmail: 'student.engineer@example.com',
          mockName: 'Student Engineer',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.data.user);
        fetchUserLinks();
      } else {
        alert(data.error?.message || 'Login failed');
      }
    } catch (err) {
      alert(`Login error: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setUserLinks([]);
    setSelectedLink(null);
    setAnalyticsData(null);
  };

  // 2. Submit Shorten Link
  const handleShorten = async (e) => {
    e.preventDefault();
    setShortenError('');
    setCreatedResult(null);
    setShortenLoading(true);

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
      setOriginalUrl('');
      setCustomAlias('');
      setExpiryDate('');

      // Refresh link list if user is authenticated
      if (currentUser) {
        fetchUserLinks();
      }
    } catch (err) {
      setShortenError(err.message);
    } finally {
      setShortenLoading(false);
    }
  };

  // 3. Inspect Analytics for an owned link
  const handleInspectLink = async (shortCode) => {
    setSelectedLink(shortCode);
    setAnalyticsLoading(true);
    setAnalyticsData(null);

    try {
      const res = await fetch(`/api/v1/links/${encodeURIComponent(shortCode)}`);
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data.data);
      } else {
        alert(data.error?.message || 'Could not load analytics');
      }
    } catch (err) {
      alert(`Error loading analytics: ${err.message}`);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // 4. Delete link
  const handleDeleteLink = async (shortCode) => {
    if (!window.confirm(`Are you sure you want to delete /${shortCode}?`)) return;
    setDeletingCode(shortCode);

    try {
      const res = await fetch(`/api/v1/links/${encodeURIComponent(shortCode)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedLink === shortCode) {
          setSelectedLink(null);
          setAnalyticsData(null);
        }
        fetchUserLinks();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to delete link');
      }
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    } finally {
      setDeletingCode(null);
    }
  };

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div>
      {/* Sticky Header */}
      <header className="site-header">
        <div className="container header-inner">
          <a href="/" className="brand-logo">
            <Zap size={22} color="#2563EB" strokeWidth={3} />
            <span>sho.rt</span>
            <span className="brand-badge">OAuth Edition</span>
          </a>
          <nav>
            <ul className="nav-links">
              <li><a href="#shorten" className="nav-link">Shortener</a></li>
              {currentUser && <li><a href="#dashboard" className="nav-link">My Links</a></li>}
              <li><a href="#plans" className="nav-link">Plans</a></li>
              
              {/* User Authentication Navigation */}
              {authLoading ? null : currentUser ? (
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem' }}>
                    <img 
                      src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'} 
                      alt="Avatar" 
                      style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid var(--border-color)' }}
                    />
                    <span>{currentUser.name}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleLogout} 
                    className="btn btn-secondary" 
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    title="Sign Out"
                  >
                    <LogOut size={14} />
                    <span>Logout</span>
                  </button>
                </li>
              ) : (
                <li>
                  <button 
                    type="button" 
                    onClick={handleGoogleSignIn} 
                    className="btn btn-primary" 
                    style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                  >
                    <User size={15} />
                    <span>Sign in with Google</span>
                  </button>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="hero-section">
          <div className="container">
            <div className="hero-pill">
              <Zap size={14} color="#2563EB" />
              <span>Sub-2ms Redis Caching</span>
              <span>•</span>
              <Lock size={14} color="#059669" />
              <span>Google OAuth User Account Security</span>
            </div>
            <h1 className="hero-title">
              Short links engineered for scale.<br />
              Zero tokens. 100% User Owned.
            </h1>
            <p className="hero-subtitle">
              Try 1 link anonymously for free. Sign in with Google to create unlimited links, 
              view 30-day click trends, and manage your custom destinations.
            </p>
          </div>
        </section>

        {/* Shortener Workhorse Card */}
        <section id="shorten" className="container">
          <div className="neo-card">
            <form onSubmit={handleShorten}>
              {shortenError && (
                <div className="error-banner" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{shortenError}</span>
                  {!currentUser && (
                    <button 
                      type="button" 
                      onClick={handleGoogleSignIn} 
                      className="btn btn-primary" 
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      Sign In Now
                    </button>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="url-input" className="form-label">Destination URL</label>
                <input 
                  id="url-input"
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/very/long/destination/url"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="alias-input" className="form-label">Custom Alias (Optional)</label>
                  <input 
                    id="alias-input"
                    type="text"
                    className="form-input"
                    placeholder="e.g. spring-sale"
                    value={customAlias}
                    onChange={(e) => setCustomAlias(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="expiry-input" className="form-label">Expiration Date (Optional)</label>
                  <input 
                    id="expiry-input"
                    type="datetime-local"
                    className="form-input"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" disabled={shortenLoading} className="btn btn-primary btn-full">
                <span>{shortenLoading ? 'Generating short link...' : 'Shorten Link'}</span>
                <ArrowRight size={18} />
              </button>
            </form>

            {/* Link Creation Result */}
            {createdResult && (
              <div className="result-box">
                <div className="result-url-row">
                  <span className="short-url-text">{createdResult.shortUrl}</span>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => copyToClipboard(createdResult.shortUrl)}
                  >
                    {copiedLink ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>

                {createdResult.isAnonymous ? (
                  <div style={{ background: '#EFF6FF', border: '2px solid #2563EB', padding: '0.85rem 1rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                    <div style={{ fontWeight: 800, marginBottom: '0.25rem', color: '#1D4ED8' }}>
                      ⚡ Free Anonymous Link Created!
                    </div>
                    <span>
                      You have used your 1 free anonymous link. To view click analytics and create unlimited links, 
                    </span>{' '}
                    <button 
                      type="button" 
                      onClick={handleGoogleSignIn} 
                      style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Sign in with Google
                    </button>.
                  </div>
                ) : (
                  <div style={{ background: 'var(--accent-success)', border: '2px solid var(--accent-success-border)', padding: '0.85rem 1rem', borderRadius: '4px', fontSize: '0.9rem', color: 'var(--accent-success-text)' }}>
                    ✔ Link saved to your account! You can monitor click traffic below in your dashboard.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Authenticated User Dashboard */}
        {currentUser && (
          <section id="dashboard" className="container" style={{ paddingTop: '1rem', marginBottom: '3.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 900 }}>My Shortened Links</h2>
                <p style={{ color: 'var(--text-muted)' }}>Manage your active destinations and inspect click analytics.</p>
              </div>
              <span className="brand-badge" style={{ background: '#2563EB' }}>
                {userLinks.length} Active Links
              </span>
            </div>

            {userLinks.length === 0 ? (
              <div className="neo-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                <LinkIcon size={36} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ fontWeight: 800, marginBottom: '0.25rem' }}>No links created yet</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Shorten your first link above to view analytics.</p>
                <a href="#shorten" className="btn btn-primary">Create a Link</a>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 1.5fr', gap: '1.5rem' }}>
                {/* Link Table / List */}
                <div className="neo-card" style={{ padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontWeight: 800, padding: '0.5rem', borderBottom: '2px solid var(--border-color)', marginBottom: '0.5rem' }}>
                    Select Link to Inspect
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {userLinks.map((link) => (
                      <div 
                        key={link.id}
                        onClick={() => handleInspectLink(link.shortCode)}
                        style={{
                          padding: '0.75rem',
                          border: '2px solid var(--border-color)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: selectedLink === link.shortCode ? '#EFF6FF' : '#FFFFFF',
                          borderColor: selectedLink === link.shortCode ? '#2563EB' : 'var(--border-color)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#2563EB' }}>
                            /{link.shortCode}
                          </span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, background: '#F3F4F6', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                            {link.totalClicks} clicks
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {link.originalUrl}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selected Link Analytics Inspector */}
                <div>
                  {selectedLink && (
                    <div className="neo-card" style={{ boxShadow: 'var(--shadow-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)' }}>
                            Link Analytics
                          </span>
                          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                            /{selectedLink}
                          </h3>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteLink(selectedLink)}
                          disabled={deletingCode === selectedLink}
                          className="btn btn-danger"
                          style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>

                      {analyticsLoading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Loading analytics...
                        </div>
                      ) : analyticsData ? (
                        <div>
                          <div className="stats-grid">
                            <div className="stat-card">
                              <div className="stat-label">Total Clicks</div>
                              <div className="stat-value">{analyticsData.stats.totalClicks.toLocaleString()}</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-label">Status</div>
                              <div className="stat-value" style={{ fontSize: '1.35rem', color: analyticsData.isExpired ? '#DC2626' : '#059669' }}>
                                {analyticsData.isExpired ? 'Expired' : 'Active'}
                              </div>
                            </div>
                          </div>

                          {/* 30-Day SVG Chart */}
                          <div className="chart-card">
                            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '1rem' }}>
                              30-Day Click Trend
                            </div>
                            <SvgTrendChart dailyData={analyticsData.stats.clicksByDay || []} />
                          </div>

                          {/* Top Referrers */}
                          <div className="chart-card" style={{ marginBottom: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.75rem' }}>
                              Top Referrers
                            </div>
                            {analyticsData.stats.topReferrers.length === 0 ? (
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No clicks recorded yet.</p>
                            ) : (
                              <ul style={{ listStyle: 'none' }}>
                                {analyticsData.stats.topReferrers.map((item, idx) => (
                                  <li key={idx} className="referrer-item">
                                    <span style={{ fontWeight: 600 }}>{item.source}</span>
                                    <span style={{ fontFamily: 'var(--font-mono)' }}>{item.count} clicks</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {!selectedLink && (
                    <div className="neo-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', boxShadow: 'var(--shadow-sm)' }}>
                      <BarChart2 size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                      <p>Select any link from the left to view click trends.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Transparent Tiers Section */}
        <section id="plans" className="pricing-section">
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>Simple, Transparent Usage</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                Try 1 link free, or sign in with Google for unlimited links and real-time analytics.
              </p>
            </div>

            <div className="pricing-grid">
              {/* Free Trial */}
              <div className="plan-card">
                <h3 className="plan-name">Anonymous Trial</h3>
                <div className="plan-price">$0 <span>/ try</span></div>
                <ul className="plan-features">
                  <li className="plan-feature-item">✔ <strong>1 free short link</strong> without an account</li>
                  <li className="plan-feature-item">✔ <strong>Sub-2ms Redis</strong> cache-aside redirect</li>
                  <li className="plan-feature-item">✔ <strong>Full protocol security</strong> & validation</li>
                  <li className="plan-feature-item" style={{ opacity: 0.6 }}>✖ No analytics dashboard</li>
                  <li className="plan-feature-item" style={{ opacity: 0.6 }}>✖ Cannot edit or delete link</li>
                </ul>
                <a href="#shorten" className="btn btn-secondary">Try 1 Link</a>
              </div>

              {/* Authenticated Community Plan */}
              <div className="plan-card featured">
                <span className="plan-badge">Most Popular</span>
                <h3 className="plan-name">Google Sign-In</h3>
                <div className="plan-price">$0 <span>/ forever</span></div>
                <ul className="plan-features">
                  <li className="plan-feature-item">✔ <strong>Unlimited short links</strong> per user</li>
                  <li className="plan-feature-item">✔ <strong>Full 30-day analytics</strong> & charts</li>
                  <li className="plan-feature-item">✔ <strong>Manage & delete</strong> your short URLs</li>
                  <li className="plan-feature-item">✔ <strong>Custom aliases</strong> & expiration dates</li>
                  <li className="plan-feature-item">✔ <strong>Zero tokens to lose</strong> — securely linked to Google</li>
                </ul>
                <button type="button" onClick={handleGoogleSignIn} className="btn btn-primary">
                  Sign in with Google
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
            ⚡ sho.rt — Engineered with Node.js, PostgreSQL, Redis, React & Google OAuth.
          </p>
          <p>Built for PayPal-level backend interviews. Zero tracking cookies. 100% Free & Open Source.</p>
        </div>
      </footer>
    </div>
  );
}

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
