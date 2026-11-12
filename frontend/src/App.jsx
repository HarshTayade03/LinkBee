import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  Link2, 
  Copy, 
  Check, 
  BarChart3, 
  Trash2, 
  ExternalLink,
  Lock,
  ArrowRight,
  LogOut,
  Sparkles,
  Calendar,
  Layers,
  ShieldCheck,
  TrendingUp,
  Globe2,
  ChevronDown,
  ChevronUp,
  Zap,
  MousePointerClick
} from 'lucide-react';
import logoImg from './assets/logo.jpg';

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
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadUserLinks = async () => {
    try {
      const res = await fetch('/api/v1/user/links');
      const data = await res.json();
      if (data.success && data.data.links) {
        setUserLinks(data.data.links);
        if (data.data.links.length > 0 && !selectedLinkSlug) {
          fetchAnalytics(data.data.links[0].short_code);
        }
      }
    } catch (err) {
      console.error('Failed to load user links:', err);
    }
  };

  const handleDevMockSignIn = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devMock: true,
          mockEmail: 'alex@linkbee.dev',
          mockName: 'Alex Mercer',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.data.user);
        loadUserLinks();
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.8 } });
      }
    } catch (err) {
      console.error('Dev sign in error:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setUserLinks([]);
      setSelectedLinkSlug(null);
      setAnalyticsData(null);
      setCreatedLink(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleCreateLink = async (e) => {
    e.preventDefault();
    setComposerError('');
    setCreatedLink(null);

    if (!originalUrl.trim()) {
      setComposerError('Please enter a destination URL.');
      return;
    }

    setComposerLoading(true);

    try {
      const payload = {
        url: originalUrl.trim(),
        customAlias: customAlias.trim() || undefined,
        expiresAt: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      };

      const res = await fetch('/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setComposerError(data.error?.message || 'Failed to shorten URL.');
        return;
      }

      setCreatedLink(data.data);
      setOriginalUrl('');
      setCustomAlias('');
      setExpiryDate('');
      setShowAdvanced(false);

      // Trigger motion celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#D97706', '#1E293B', '#10B981']
      });

      // Refresh dashboard if authenticated
      if (currentUser) {
        loadUserLinks();
        fetchAnalytics(data.data.shortCode);
      }
    } catch {
      setComposerError('Network error connecting to LinkBee service.');
    } finally {
      setComposerLoading(false);
    }
  };

  const fetchAnalytics = async (slug) => {
    setSelectedLinkSlug(slug);
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/v1/links/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data.data);
      } else {
        setAnalyticsData(null);
      }
    } catch {
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleDeleteLink = async (slug, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete /${slug}?`)) return;

    setDeletingSlug(slug);
    try {
      const res = await fetch(`/api/v1/links/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setUserLinks((prev) => prev.filter((item) => item.short_code !== slug));
        if (selectedLinkSlug === slug) {
          setSelectedLinkSlug(null);
          setAnalyticsData(null);
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingSlug(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  return (
    <div className="app-container">
      {/* Background Visual Grid & Ambient Glow */}
      <div className="canvas-grid" />
      <div className="canvas-radial-glow" />

      {/* Navigation Bar */}
      <header className="navbar">
        <div className="navbar-inner">
          <a href="/" className="brand-link">
            <img src={logoImg} alt="LinkBee Logo" className="brand-logo-img" />
            <span>LinkBee</span>
          </a>

          <div className="nav-actions">
            {authLoading ? (
              <div style={{ fontSize: '0.85rem', color: '#64748B' }}>Connecting...</div>
            ) : currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="user-badge">
                  <img 
                    src={currentUser.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=linkbee'} 
                    alt={currentUser.name} 
                    className="user-avatar" 
                  />
                  <span className="user-name">{currentUser.name?.split(' ')[0]}</span>
                </div>
                <button onClick={handleSignOut} className="btn-mini" title="Sign Out">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={handleDevMockSignIn} className="btn-google-auth">
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section 
        className="hero-wrapper"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="badge-tag">
          <Sparkles size={14} />
          <span>Intelligent Link Infrastructure for Creators</span>
        </div>
        <h1 className="hero-title">
          Shorten, analyze, and <br />
          <span className="hero-highlight">scale your connections</span>
        </h1>
        <p className="hero-subtitle">
          {currentUser 
            ? "Manage your links, review real-time click distributions, and control your audience flow."
            : "Transform long messy URLs into branded, memorable links with sub-millisecond redirect performance."}
        </p>
      </motion.section>

      {/* Bitly-Style Action Composer Card */}
      <section className="composer-outer">
        <motion.div 
          className="composer-glass-card"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <form onSubmit={handleCreateLink}>
            <div className="input-primary-group">
              <Link2 size={20} />
              <input
                type="url"
                className="input-primary"
                placeholder="Paste a long destination URL (e.g., https://github.com/org/repo)..."
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                required
              />
              <button 
                type="submit" 
                className="btn-shorten-cta" 
                disabled={composerLoading}
              >
                {composerLoading ? (
                  <span>Shortening...</span>
                ) : (
                  <>
                    <span>Shorten URL</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>

            {/* Notion style Collapsible Drawer */}
            <div className="advanced-toggle-bar">
              <button
                type="button"
                className="toggle-button"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>Custom alias & expiration settings</span>
              </button>

              {!currentUser && (
                <div className="guest-limit-hint">
                  <Zap size={13} color="#D97706" />
                  <span>1 free trial link without sign-in</span>
                </div>
              )}
            </div>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div 
                  className="advanced-drawer"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div>
                    <label className="input-sub-label">Custom Vanity Alias (Optional)</label>
                    <input
                      type="text"
                      className="input-sub-box"
                      placeholder="e.g. launch-2026"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-sub-label">Expiration Date (Optional)</label>
                    <input
                      type="datetime-local"
                      className="input-sub-box"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {composerError && (
              <motion.div 
                style={{ 
                  marginTop: '14px', 
                  color: '#DC2626', 
                  fontSize: '0.85rem', 
                  background: '#FEF2F2', 
                  padding: '8px 12px', 
                  borderRadius: '6px' 
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {composerError}
              </motion.div>
            )}
          </form>

          {/* Success Result Banner */}
          <AnimatePresence>
            {createdLink && (
              <motion.div 
                className="success-banner"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="success-details">
                  <a 
                    href={createdLink.shortUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="success-url"
                  >
                    {createdLink.shortUrl}
                  </a>
                  <span className="success-target">↳ {createdLink.originalUrl}</span>
                </div>
                <div className="success-actions">
                  <button 
                    onClick={() => copyToClipboard(createdLink.shortUrl)} 
                    className="btn-icon-action"
                  >
                    {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  <a 
                    href={createdLink.shortUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn-icon-action"
                  >
                    <ExternalLink size={15} />
                    <span>Visit</span>
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* Main Content Area: Dashboard (Signed-in) OR Notion Callouts (Guest) */}
      {currentUser ? (
        <section className="dashboard-wrapper">
          <div className="dash-header">
            <div>
              <h2 className="dash-title">Your Shortened Links</h2>
              <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
                All links created under your account with 30-day analytics.
              </p>
            </div>
            <div className="dash-stats-bar">
              <span className="stat-chip">
                {userLinks.length} {userLinks.length === 1 ? 'Link' : 'Links'} Created
              </span>
            </div>
          </div>

          <div className="dash-grid">
            {/* Left Column: Link Cards List */}
            <div>
              {userLinks.length === 0 ? (
                <div className="link-card" style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                  <Layers size={36} style={{ margin: '0 auto 12px auto', opacity: 0.6 }} />
                  <p>No links created yet. Use the composer above to create your first shortlink!</p>
                </div>
              ) : (
                userLinks.map((link) => {
                  const isSelected = selectedLinkSlug === link.short_code;
                  return (
                    <motion.div
                      key={link.id}
                      className={`link-card ${isSelected ? 'active' : ''}`}
                      onClick={() => fetchAnalytics(link.short_code)}
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="link-card-top">
                        <span className="link-code">/{link.short_code}</span>
                        <div className="link-actions-group">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(`${window.location.origin}/${link.short_code}`);
                            }}
                            className="btn-mini"
                            title="Copy link"
                          >
                            <Copy size={15} />
                          </button>
                          <a
                            href={`/${link.short_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-mini"
                            onClick={(e) => e.stopPropagation()}
                            title="Visit destination"
                          >
                            <ExternalLink size={15} />
                          </a>
                          <button
                            onClick={(e) => handleDeleteLink(link.short_code, e)}
                            className="btn-mini danger"
                            disabled={deletingSlug === link.short_code}
                            title="Delete link"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="link-original" title={link.original_url}>
                        {link.original_url}
                      </div>

                      <div className="link-footer-meta">
                        <span>Created {new Date(link.created_at).toLocaleDateString()}</span>
                        <span>Click to view metrics →</span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Right Column: Dub-style Analytics Panel */}
            <div>
              <div className="analytics-panel">
                <div className="analytics-header">
                  <div>
                    <div className="metric-label">Total Clicks</div>
                    <div className="metric-big-num">
                      {analyticsLoading ? '...' : analyticsData ? analyticsData.analytics.totalClicks : 0}
                    </div>
                  </div>
                  <BarChart3 size={28} color="#D97706" />
                </div>

                {analyticsLoading ? (
                  <div style={{ textAlign: 'center', padding: '50px 0', color: '#94A3B8' }}>
                    Loading real-time analytics...
                  </div>
                ) : analyticsData ? (
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                      Click Distribution (Last 30 Days)
                    </div>

                    <div className="timeline-bar-chart">
                      {analyticsData.analytics.clicksByDate.slice(-14).map((entry, idx) => {
                        const maxVal = Math.max(
                          ...analyticsData.analytics.clicksByDate.map((d) => parseInt(d.count, 10)),
                          1
                        );
                        const heightPct = Math.max((parseInt(entry.count, 10) / maxVal) * 100, 8);
                        return (
                          <div key={idx} className="bar-column">
                            <motion.div 
                              className="bar-pill" 
                              initial={{ height: 0 }}
                              animate={{ height: `${heightPct}%` }}
                              transition={{ duration: 0.3 }}
                              title={`${entry.date}: ${entry.count} clicks`}
                            />
                            <span className="bar-label">{entry.date.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                      <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', marginBottom: '8px' }}>
                          TOP REFERRERS
                        </div>
                        {analyticsData.analytics.referrers.length === 0 ? (
                          <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Direct / None</div>
                        ) : (
                          analyticsData.analytics.referrers.slice(0, 3).map((r, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                              <span style={{ color: '#1E293B', fontWeight: 500 }}>{r.referrer || 'Direct'}</span>
                              <span style={{ color: '#64748B' }}>{r.count}</span>
                            </div>
                          ))
                        )}
                      </div>

                      <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', marginBottom: '8px' }}>
                          TOP BROWSERS
                        </div>
                        {analyticsData.analytics.userAgents.length === 0 ? (
                          <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>No data</div>
                        ) : (
                          analyticsData.analytics.userAgents.slice(0, 3).map((u, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                              <span style={{ color: '#1E293B', fontWeight: 500 }}>{u.user_agent || 'Unknown'}</span>
                              <span style={{ color: '#64748B' }}>{u.count}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                    Select a link to view click analytics and referral traffic.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Guest Experience Notion-style Feature Grid */
        <section style={{ maxWidth: '960px', margin: '20px auto 80px auto', padding: '0 24px' }}>
          <div className="notion-callout">
            <div className="notion-callout-icon">💡</div>
            <div className="notion-callout-content">
              <div className="notion-callout-title">Create your first link instantly</div>
              You can shorten 1 link immediately without creating an account. Sign in with Google to unlock permanent links, custom vanity aliases, and real-time click metrics.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '36px' }}>
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
              <Zap size={22} color="#D97706" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>Sub-millisecond Routing</h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: 1.5 }}>
                Redis-backed Cache-Aside architecture delivers rapid redirects globally while gracefully degrading if cache misses occur.
              </p>
            </div>

            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
              <TrendingUp size={22} color="#2563EB" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>Real-time Analytics</h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: 1.5 }}>
                Understand who is engaging with your links with privacy-preserving referrers and browser metrics—zero raw IP tracking.
              </p>
            </div>

            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
              <ShieldCheck size={22} color="#059669" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>SSRF & Phishing Guard</h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: 1.5 }}>
                Multi-layer inspection blocks private IPs, metadata endpoints, and dangerous URL protocols before links are created.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="footer-wrap">
        <p>© 2026 LinkBee • High-performance link infrastructure.</p>
      </footer>
    </div>
  );
}
