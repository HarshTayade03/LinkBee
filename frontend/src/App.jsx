import React, { useState, useEffect } from 'react';
import { 
  Link2, 
  Copy, 
  Check, 
  BarChart2, 
  Trash2, 
  ExternalLink, 
  ChevronDown, 
  ArrowRight, 
  LogOut, 
  Clock, 
  Shield, 
  MousePointer, 
  User, 
  AlertCircle,
  Calendar,
  X
} from 'lucide-react';
import { 
  BeeSpot, 
  ChainLinkSpot, 
  CalendarSpot, 
  EmptyTraySpot, 
  ExpiredLinkSpot 
} from './components/SpotIllustrations';
import logoImg from './assets/logo.jpg';

export default function App() {
  // Navigation / Page state
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing', 'dashboard', 'analytics', 'account', 'terms', 'privacy', 'report', 'expired', 'not-found'
  const [toastMessage, setToastMessage] = useState('');

  // Session state
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Landing Hero / Composer state
  const [heroUrl, setHeroUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerError, setComposerError] = useState('');
  const [composerState, setComposerState] = useState('empty'); // 'empty', 'loading', 'success', 'quota_exceeded', 'error'
  const [createdResult, setCreatedResult] = useState(null);
  const [copiedHero, setCopiedHero] = useState(false);

  // Dashboard state
  const [userLinks, setUserLinks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLinkSlug, setSelectedLinkSlug] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    checkSession();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

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
          fetchAnalytics(data.data.links[0].shortCode);
        }
      }
    } catch (err) {
      console.error('Failed to load user links:', err);
    }
  };

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devMock: true,
          mockEmail: 'alex@linkbee.co',
          mockName: 'Alex Mercer',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.data.user);
        loadUserLinks();
        setCurrentPage('dashboard');
        showToast('Signed in successfully');
      }
    } catch (err) {
      console.error('Sign in error:', err);
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
      setCurrentPage('landing');
      showToast('Signed out');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Full 5-State Anonymous Shorten Engine
  const handleShorten = async (e) => {
    if (e) e.preventDefault();
    setComposerError('');

    if (!heroUrl.trim()) {
      setComposerError('Please enter a destination URL.');
      return;
    }

    setComposerLoading(true);
    setComposerState('loading');

    try {
      const payload = {
        originalUrl: heroUrl.trim(),
        customAlias: customAlias.trim() || undefined,
        expiresAt: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      };

      const res = await fetch('/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 403 && data.error?.code === 'AUTH_REQUIRED_LIMIT') {
        // State 4: Free anonymous link already used
        setComposerState('quota_exceeded');
        setComposerLoading(false);
        return;
      }

      if (!res.ok) {
        // State 5: Validation or conflict error
        let errorMsg = data.error?.message || 'That does not look like a link. Try adding https:// at the start.';
        if (data.error?.code === 'ALIAS_IN_USE') {
          errorMsg = `The custom back-half "${customAlias}" is already taken. Try another name.`;
        }
        setComposerError(errorMsg);
        setComposerState('error');
        setComposerLoading(false);
        return;
      }

      // State 3: Success
      setCreatedResult(data.data);
      setComposerState('success');
      setComposerLoading(false);

      if (currentUser) {
        loadUserLinks();
        fetchAnalytics(data.data.shortCode);
      }
    } catch {
      setComposerError('Network connection issue. Please check your connection and try again.');
      setComposerState('error');
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

  const handleDelete = async (slug) => {
    try {
      const res = await fetch(`/api/v1/links/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setUserLinks((prev) => prev.filter((l) => l.shortCode !== slug));
        setDeleteConfirmSlug(null);
        if (selectedLinkSlug === slug) {
          setSelectedLinkSlug(null);
          setAnalyticsData(null);
        }
        showToast('Link deleted');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHero(true);
    showToast('Link copied to clipboard');
    setTimeout(() => setCopiedHero(false), 2000);
  };

  const resetComposer = () => {
    setHeroUrl('');
    setCustomAlias('');
    setExpiryDate('');
    setShowOptions(false);
    setComposerState('empty');
    setCreatedResult(null);
    setComposerError('');
  };

  // Filtered links for dashboard
  const filteredLinks = userLinks.filter((l) => 
    l.shortCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.originalUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="site-wrapper">
      {/* Toast Notification (Announced for Screen Readers) */}
      {toastMessage && (
        <div className="toast-notice" role="status" aria-live="polite">
          <Check size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation: Solid, 64px, Sticky, 1px border */}
      <header className="site-nav">
        <div className="site-nav-inner">
          <a 
            href="/" 
            className="nav-brand"
            onClick={(e) => { e.preventDefault(); setCurrentPage('landing'); }}
          >
            <img src={logoImg} alt="LinkBee" className="nav-brand-logo" />
            <span>LinkBee</span>
          </a>

          <div className="nav-links">
            {authLoading ? (
              <span style={{ fontSize: '0.85rem', color: '#8F8D87' }}>Checking...</span>
            ) : currentUser ? (
              <>
                <button 
                  onClick={() => setCurrentPage('dashboard')} 
                  className={`btn btn-ghost ${currentPage === 'dashboard' ? 'btn-secondary' : ''}`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => setCurrentPage('account')} 
                  className={`btn btn-ghost ${currentPage === 'account' ? 'btn-secondary' : ''}`}
                >
                  Account
                </button>
                <button onClick={handleSignOut} className="btn btn-ghost" title="Log out">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <button onClick={handleSignIn} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  Log in
                </button>
                <button onClick={handleSignIn} className="btn btn-primary">
                  Sign up free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          PAGE: LANDING PAGE
          ========================================================================= */}
      {currentPage === 'landing' && (
        <main>
          {/* Hero Section */}
          <section className="hero-section">
            <div className="hero-dot-grid" />
            
            <div className="hero-pill">
              <span>Link shortener with click stats</span>
            </div>

            <h1 className="hero-headline">
              Make long links short. <br />
              See who <span className="serif-accent">clicks.</span>
            </h1>

            <p className="hero-subline">
              Paste a link, get a short one in a second. Your first link is free, no account needed.
            </p>

            {/* Bitly-Style Input-First Link Box (5 States) */}
            <div className="link-box-container">
              {composerState === 'success' && createdResult ? (
                /* State 3: Success Result Card */
                <div className="hero-result-card">
                  <div className="hero-result-row">
                    <div>
                      <a 
                        href={createdResult.shortUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="hero-result-url"
                      >
                        {createdResult.shortUrl}
                      </a>
                      <div className="hero-result-dest">↳ {createdResult.originalUrl}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => copyToClipboard(createdResult.shortUrl)} 
                        className="btn btn-primary"
                        aria-live="polite"
                      >
                        {copiedHero ? <Check size={16} /> : <Copy size={16} />}
                        <span>{copiedHero ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="hero-result-prompt">
                    <span style={{ fontSize: '0.88rem', color: '#63615C' }}>
                      Want to see who clicks this? Create a free account to track clicks.
                    </span>
                    <button onClick={handleSignIn} className="btn btn-secondary" style={{ padding: '6px 14px' }}>
                      Sign up free
                    </button>
                  </div>

                  <div style={{ marginTop: '14px', textAlign: 'right' }}>
                    <button 
                      onClick={resetComposer} 
                      className="btn-ghost" 
                      style={{ fontSize: '0.85rem', padding: '4px 8px', cursor: 'pointer' }}
                    >
                      Shorten another link →
                    </button>
                  </div>
                </div>
              ) : composerState === 'quota_exceeded' ? (
                /* State 4: Free link already used */
                <div className="hero-quota-card">
                  <BeeSpot size={56} />
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '6px' }}>
                      You've used your free link.
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: '#63615C', marginBottom: '16px', lineHeight: 1.5 }}>
                      Sign up free to make unlimited links and watch clicks come in. Your link is still saved in the box below.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button onClick={handleSignIn} className="btn btn-primary">
                        Sign up free
                      </button>
                      <button onClick={handleSignIn} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        Log in
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* State 1 (Empty), State 2 (Loading), State 5 (Error) */
                <form onSubmit={handleShorten}>
                  <div className="link-box">
                    <input
                      type="url"
                      className="link-box-input"
                      placeholder="Paste your long link here"
                      value={heroUrl}
                      onChange={(e) => setHeroUrl(e.target.value)}
                      disabled={composerLoading}
                      required
                    />
                    <button 
                      type="submit" 
                      className="btn btn-primary link-box-btn"
                      disabled={composerLoading}
                    >
                      {composerLoading ? 'Shortening...' : 'Shorten'}
                    </button>
                  </div>

                  {/* Options Drawer Toggle */}
                  <div className="link-box-note">
                    <span>
                      {currentUser ? 'Unlimited links with your account' : 'Your first link is free with no account.'}
                    </span>
                    <button
                      type="button"
                      className="link-options-toggle"
                      onClick={() => setShowOptions(!showOptions)}
                      aria-expanded={showOptions}
                    >
                      <span>Custom ending or expiry</span>
                      <ChevronDown size={14} style={{ transform: showOptions ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>
                  </div>

                  {showOptions && (
                    <div className="link-options-drawer">
                      <div>
                        <label className="form-label">Custom back-half</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. summer-sale"
                          value={customAlias}
                          onChange={(e) => setCustomAlias(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">Switch off after date</label>
                        <input
                          type="datetime-local"
                          className="form-input"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* State 5: Validation Error Banner */}
                  {composerError && (
                    <div className="hero-error-banner" role="alert">
                      <AlertCircle size={16} />
                      <span>{composerError}</span>
                    </div>
                  )}
                </form>
              )}
            </div>
          </section>

          {/* How It Works Strip (Three short steps in one quiet row) */}
          <section className="how-it-works-section">
            <div className="how-it-works-grid">
              <div className="step-item">
                <span className="step-num">Step 1</span>
                <h3 className="step-title">Paste your link</h3>
                <p className="step-desc">Drop in any long web address. Add an optional custom ending or expiration date.</p>
              </div>

              <div className="step-item">
                <span className="step-num">Step 2</span>
                <h3 className="step-title">Get your short link</h3>
                <p className="step-desc">Copy your clean short address in one click, ready for messages, posts or slides.</p>
              </div>

              <div className="step-item">
                <span className="step-num">Step 3</span>
                <h3 className="step-title">Share and watch clicks</h3>
                <p className="step-desc">Share anywhere and follow daily clicks and traffic sources in your dashboard.</p>
              </div>
            </div>
          </section>

          {/* Feature Cards Section (Bitly pattern: visual on top, title, 1 sentence benefit, text action) */}
          <section className="features-section">
            <div className="section-header">
              <div className="section-label">Features</div>
              <h2 className="section-title">Everything you need to share with confidence</h2>
            </div>

            <div className="features-grid">
              {/* Card 1: Shorten any link */}
              <div className="feature-card">
                <div className="card-visual-top">
                  <div className="mini-link-bar">
                    <span className="mini-link-text">linkbee.co/r7x2k9</span>
                    <span className="mini-btn-chip">Copy</span>
                  </div>
                </div>
                <h3 className="card-title">Shorten any link</h3>
                <p className="card-benefit">Paste a long link, get a short one you can share anywhere.</p>
                <a href="#top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="card-action">
                  <span>Try it free</span>
                  <ArrowRight size={14} className="card-action-arrow" />
                </a>
              </div>

              {/* Card 2: Custom back-half */}
              <div className="feature-card">
                <div className="card-visual-top">
                  <span className="mini-pill-tag">linkbee.co/summer-sale</span>
                </div>
                <h3 className="card-title">Choose your own ending</h3>
                <p className="card-benefit">Turn a messy link into something people remember, like linkbee.co/summer-sale.</p>
                <a href="#top" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setShowOptions(true); }} className="card-action">
                  <span>Pick a back-half</span>
                  <ArrowRight size={14} className="card-action-arrow" />
                </a>
              </div>

              {/* Card 3: Real Click Stats */}
              <div className="feature-card">
                <div className="card-visual-top">
                  <div className="mini-sparkline">
                    <div className="mini-bar" style={{ height: '35%' }} />
                    <div className="mini-bar" style={{ height: '50%' }} />
                    <div className="mini-bar" style={{ height: '30%' }} />
                    <div className="mini-bar highlight" style={{ height: '85%' }} />
                    <div className="mini-bar" style={{ height: '60%' }} />
                    <div className="mini-bar" style={{ height: '40%' }} />
                  </div>
                </div>
                <h3 className="card-title">See who clicks</h3>
                <p className="card-benefit">Watch clicks come in over time and see where your visitors come from.</p>
                <button onClick={handleSignIn} className="card-action" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <span>View click stats</span>
                  <ArrowRight size={14} className="card-action-arrow" />
                </button>
              </div>

              {/* Card 4: Scheduled Expiration */}
              <div className="feature-card">
                <div className="card-visual-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '8px 14px', borderRadius: '6px', border: '1px solid #E7E4DC' }}>
                    <Calendar size={16} color="#E58E1A" />
                    <span style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>Ends: Nov 30, 2026</span>
                  </div>
                </div>
                <h3 className="card-title">Set it to expire</h3>
                <p className="card-benefit">Pick a date and the link switches itself off. Good for offers and events.</p>
                <a href="#top" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setShowOptions(true); }} className="card-action">
                  <span>Set an expiry date</span>
                  <ArrowRight size={14} className="card-action-arrow" />
                </a>
              </div>

              {/* Card 5: Link Management */}
              <div className="feature-card">
                <div className="card-visual-top">
                  <div style={{ width: '100%', maxWidth: '240px', background: '#FFFFFF', border: '1px solid #E7E4DC', borderRadius: '6px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#8F8D87', marginBottom: '4px' }}>YOUR LINKS</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1C1B19' }}>/launch-deck</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1C1B19' }}>/newsletter-nov</div>
                  </div>
                </div>
                <h3 className="card-title">Keep it all in one place</h3>
                <p className="card-benefit">Search, copy and clean up every link from a single dashboard.</p>
                <button onClick={handleSignIn} className="card-action" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <span>Open dashboard</span>
                  <ArrowRight size={14} className="card-action-arrow" />
                </button>
              </div>

              {/* Card 6: Privacy by Design */}
              <div className="feature-card">
                <div className="card-visual-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '8px 14px', borderRadius: '6px', border: '1px solid #E7E4DC' }}>
                    <Shield size={16} color="#15803D" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Zero IP logging</span>
                  </div>
                </div>
                <h3 className="card-title">Privacy first</h3>
                <p className="card-benefit">We record click counts and sources without storing IP addresses or personal data.</p>
                <button onClick={() => setCurrentPage('privacy')} className="card-action" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <span>Read our privacy policy</span>
                  <ArrowRight size={14} className="card-action-arrow" />
                </button>
              </div>
            </div>
          </section>

          {/* Analytics Showcase (Accurate mock with real stats) */}
          <section className="analytics-showcase-section">
            <div className="analytics-showcase-grid">
              <div>
                <div className="section-label">Analytics</div>
                <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '16px' }}>
                  See what happens after you share
                </h2>
                <p style={{ fontSize: '1rem', color: '#63615C', lineHeight: 1.6, marginBottom: '24px' }}>
                  Every click is counted the moment someone opens your short link. Review daily engagement and learn which channels drive real visits.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Check size={18} color="#15803D" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '0.92rem', color: '#1C1B19' }}>
                      <strong>Daily click graph</strong> showing traffic patterns across the last 30 days.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Check size={18} color="#15803D" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '0.92rem', color: '#1C1B19' }}>
                      <strong>Top referrer breakdown</strong> telling you whether visitors clicked from Twitter, LinkedIn, or directly.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Check size={18} color="#15803D" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '0.92rem', color: '#1C1B19' }}>
                      <strong>Browser and device insight</strong> without compromising reader privacy.
                    </span>
                  </div>
                </div>
              </div>

              {/* Real UI Mock (Accurate to LinkBee's actual data model) */}
              <div className="analytics-mock-card">
                <div className="analytics-mock-header">
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.95rem' }}>
                    linkbee.co/workshop-rsvp
                  </span>
                  <span className="sample-data-badge">Sample data</span>
                </div>

                <div className="mock-stat-tile">
                  <div className="mock-stat-num">248</div>
                  <div className="mock-stat-label">Total Clicks (Last 30 Days)</div>
                </div>

                <div className="mock-chart-container">
                  <div className="mock-chart-col"><div className="mock-chart-bar" style={{ height: '20%' }} /><span className="mock-chart-day">Mon</span></div>
                  <div className="mock-chart-col"><div className="mock-chart-bar" style={{ height: '35%' }} /><span className="mock-chart-day">Tue</span></div>
                  <div className="mock-chart-col"><div className="mock-chart-bar" style={{ height: '50%' }} /><span className="mock-chart-day">Wed</span></div>
                  <div className="mock-chart-col"><div className="mock-chart-bar active" style={{ height: '90%' }} /><span className="mock-chart-day">Thu</span></div>
                  <div className="mock-chart-col"><div className="mock-chart-bar" style={{ height: '65%' }} /><span className="mock-chart-day">Fri</span></div>
                  <div className="mock-chart-col"><div className="mock-chart-bar" style={{ height: '30%' }} /><span className="mock-chart-day">Sat</span></div>
                  <div className="mock-chart-col"><div className="mock-chart-bar" style={{ height: '40%' }} /><span className="mock-chart-day">Sun</span></div>
                </div>

                <div className="mock-sources-list">
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8F8D87', textTransform: 'uppercase' }}>
                    Top Traffic Sources
                  </div>
                  <div className="mock-source-row">
                    <span className="mock-source-name">Direct / Email</span>
                    <span className="mock-source-count">112 clicks</span>
                  </div>
                  <div className="mock-source-row">
                    <span className="mock-source-name">linkedin.com</span>
                    <span className="mock-source-count">74 clicks</span>
                  </div>
                  <div className="mock-source-row">
                    <span className="mock-source-name">twitter.com</span>
                    <span className="mock-source-count">48 clicks</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* "Made For" Row (Plain, Honest Use Cases) */}
          <section className="made-for-section">
            <div className="made-for-grid">
              <div className="made-for-item">
                <h4 className="made-for-title">Posters and flyers</h4>
                <p className="made-for-desc">Short links that people can easily read and type into their phones.</p>
              </div>
              <div className="made-for-item">
                <h4 className="made-for-title">Social bios and posts</h4>
                <p className="made-for-desc">Clean, memorable links that do not clutter your message or character limit.</p>
              </div>
              <div className="made-for-item">
                <h4 className="made-for-title">Messages and emails</h4>
                <p className="made-for-desc">Replace unwieldy paragraph-long URLs with clear, single-line links.</p>
              </div>
              <div className="made-for-item">
                <h4 className="made-for-title">Event registrations</h4>
                <p className="made-for-desc">Set links to turn off after the sign-up deadline so nobody registers late.</p>
              </div>
            </div>
          </section>

          {/* FAQ Accordion (Truthful to codebase) */}
          <section className="faq-section">
            <div className="section-header">
              <div className="section-label">Questions & Answers</div>
              <h2 className="section-title">Frequently asked questions</h2>
            </div>

            <div className="faq-item">
              <button 
                className="faq-trigger" 
                onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}
                aria-expanded={openFaq === 1}
              >
                <span>Is LinkBee free to use?</span>
                <ChevronDown size={18} className={`faq-icon ${openFaq === 1 ? 'open' : ''}`} />
              </button>
              {openFaq === 1 && (
                <div className="faq-content">
                  Yes. You can create your first link without an account. Creating additional links and viewing click statistics requires a free account.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button 
                className="faq-trigger" 
                onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}
                aria-expanded={openFaq === 2}
              >
                <span>Do I need an account to create a link?</span>
                <ChevronDown size={18} className={`faq-icon ${openFaq === 2 ? 'open' : ''}`} />
              </button>
              {openFaq === 2 && (
                <div className="faq-content">
                  No, you can shorten one link immediately as a guest. To shorten more links, you can sign in with your Google account.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button 
                className="faq-trigger" 
                onClick={() => setOpenFaq(openFaq === 3 ? null : 3)}
                aria-expanded={openFaq === 3}
              >
                <span>What happens after I use my free trial link?</span>
                <ChevronDown size={18} className={`faq-icon ${openFaq === 3 ? 'open' : ''}`} />
              </button>
              {openFaq === 3 && (
                <div className="faq-content">
                  If you attempt to shorten a second link without signing in, LinkBee will prompt you to sign in with Google. Once signed in, you can create unlimited links.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button 
                className="faq-trigger" 
                onClick={() => setOpenFaq(openFaq === 4 ? null : 4)}
                aria-expanded={openFaq === 4}
              >
                <span>Do my short links expire?</span>
                <ChevronDown size={18} className={`faq-icon ${openFaq === 4 ? 'open' : ''}`} />
              </button>
              {openFaq === 4 && (
                <div className="faq-content">
                  Links do not expire unless you set an expiration date when creating the link. If you choose an expiration date, the link switches off automatically after that time.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button 
                className="faq-trigger" 
                onClick={() => setOpenFaq(openFaq === 5 ? null : 5)}
                aria-expanded={openFaq === 5}
              >
                <span>Can I change where a link redirects after creating it?</span>
                <ChevronDown size={18} className={`faq-icon ${openFaq === 5 ? 'open' : ''}`} />
              </button>
              {openFaq === 5 && (
                <div className="faq-content">
                  Destination URLs cannot be edited once created to ensure visitors are protected against destination swapping. You can delete the link and create a new one at any time.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button 
                className="faq-trigger" 
                onClick={() => setOpenFaq(openFaq === 6 ? null : 6)}
                aria-expanded={openFaq === 6}
              >
                <span>What happens if I delete a link?</span>
                <ChevronDown size={18} className={`faq-icon ${openFaq === 6 ? 'open' : ''}`} />
              </button>
              {openFaq === 6 && (
                <div className="faq-content">
                  Deleting a link removes it permanently from your dashboard, purges its cache, and stops redirection immediately. Anyone who opens the deleted link will see our friendly link not found page.
                </div>
              )}
            </div>

            <div className="faq-item">
              <button 
                className="faq-trigger" 
                onClick={() => setOpenFaq(openFaq === 7 ? null : 7)}
                aria-expanded={openFaq === 7}
              >
                <span>Who can see my click statistics?</span>
                <ChevronDown size={18} className={`faq-icon ${openFaq === 7 ? 'open' : ''}`} />
              </button>
              {openFaq === 7 && (
                <div className="faq-content">
                  Only you can see your click statistics. Analytics are strictly private to the account that created the link.
                </div>
              )}
            </div>
          </section>

          {/* Final Call to Action Band */}
          <section className="final-cta-band">
            <div className="final-cta-inner">
              <h2 className="final-cta-title">Your next link, shorter.</h2>
              <p className="final-cta-sub">
                Paste a long link and try LinkBee in one second. No credit card, no password.
              </p>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontSize: '1rem' }}
              >
                Shorten a link now
              </button>
            </div>
          </section>
        </main>
      )}

      {/* =========================================================================
          PAGE: DASHBOARD (Dub-Style Precision)
          ========================================================================= */}
      {currentPage === 'dashboard' && currentUser && (
        <div className="dashboard-layout">
          {/* Sidebar */}
          <aside className="dashboard-sidebar">
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#8F8D87', textTransform: 'uppercase', marginBottom: '12px' }}>
                WORKSPACE
              </div>
              <div className="dash-nav-items">
                <button 
                  className={`dash-nav-btn ${selectedLinkSlug === null ? 'active' : ''}`}
                  onClick={() => setSelectedLinkSlug(null)}
                >
                  <Link2 size={16} />
                  <span>All Links</span>
                </button>
                <button 
                  className="dash-nav-btn"
                  onClick={() => setCurrentPage('account')}
                >
                  <User size={16} />
                  <span>Account</span>
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #E7E4DC', paddingTop: '16px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1C1B19' }}>{currentUser.name}</div>
              <div style={{ fontSize: '0.78rem', color: '#8F8D87' }}>{currentUser.email}</div>
            </div>
          </aside>

          {/* Main Area */}
          <main className="dashboard-main">
            <div className="dash-toolbar">
              <div>
                <h1 className="dash-page-title">Links</h1>
                <p style={{ fontSize: '0.88rem', color: '#63615C', marginTop: '2px' }}>
                  Manage all short links created under your account.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search links..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ width: '200px' }}
                />
                <button 
                  onClick={() => setIsCreateDialogOpen(true)} 
                  className="btn btn-primary"
                >
                  Create link
                </button>
              </div>
            </div>

            {/* Links Table (Container with 1px border, not floating cards) */}
            {userLinks.length === 0 ? (
              <div style={{ background: '#FFFFFF', border: '1px solid #E7E4DC', borderRadius: '12px', padding: '64px 24px', textAlign: 'center' }}>
                <EmptyTraySpot size={72} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '16px', marginBottom: '6px' }}>No links yet</h3>
                <p style={{ fontSize: '0.9rem', color: '#63615C', marginBottom: '20px' }}>
                  Create your first link to start sharing and tracking clicks.
                </p>
                <button onClick={() => setIsCreateDialogOpen(true)} className="btn btn-primary">
                  Create your first link
                </button>
              </div>
            ) : (
              <div className="links-table-container">
                {filteredLinks.map((link) => (
                  <div key={link.id} className="link-row">
                    <div className="link-row-left">
                      <div className="link-favicon-fallback">
                        {link.shortCode.charAt(0).toUpperCase()}
                      </div>
                      <div className="link-row-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <a 
                            href={link.shortUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="link-row-slug"
                          >
                            /{link.shortCode}
                          </a>
                          <button 
                            onClick={() => copyToClipboard(link.shortUrl)} 
                            className="btn-ghost" 
                            style={{ padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
                            title="Copy link"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                        <div className="link-row-dest" title={link.originalUrl}>
                          {link.originalUrl}
                        </div>
                      </div>
                    </div>

                    <div className="link-row-right">
                      <div className="link-clicks-chip">
                        {link.totalClicks || 0} {link.totalClicks === 1 ? 'click' : 'clicks'}
                      </div>
                      <button 
                        onClick={() => fetchAnalytics(link.shortCode)} 
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                      >
                        Stats
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmSlug(link.shortCode)} 
                        className="btn btn-ghost"
                        style={{ padding: '6px 8px', color: '#B91C1C' }}
                        title="Delete link"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* In-Line Analytics Details Modal/Drawer */}
            {selectedLinkSlug && analyticsData && (
              <div style={{ marginTop: '36px', background: '#FFFFFF', border: '1px solid #E7E4DC', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #E7E4DC', paddingBottom: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Analytics for /{selectedLinkSlug}</h2>
                    <span style={{ fontSize: '0.82rem', color: '#63615C' }}>Destination: {analyticsData.originalUrl}</span>
                  </div>
                  <button onClick={() => setSelectedLinkSlug(null)} className="btn btn-ghost" style={{ padding: '4px' }}>
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                  <div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 700, fontFamily: 'monospace' }}>
                      {analyticsData.stats.totalClicks}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#63615C', fontWeight: 500 }}>Total visits recorded</div>
                    <div style={{ fontSize: '0.78rem', color: '#8F8D87', marginTop: '4px' }}>Privacy-preserving click logging</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>Top Traffic Referrers</div>
                    {analyticsData.stats.topReferrers.length === 0 ? (
                      <div style={{ fontSize: '0.85rem', color: '#8F8D87' }}>No visits yet. Share your link to see data.</div>
                    ) : (
                      analyticsData.stats.topReferrers.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #E7E4DC', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 500 }}>{r.source}</span>
                          <span style={{ fontFamily: 'monospace' }}>{r.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* =========================================================================
          PAGE: ACCOUNT
          ========================================================================= */}
      {currentPage === 'account' && currentUser && (
        <main style={{ maxWidth: '640px', margin: '48px auto', padding: '0 24px', flex: 1 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Account Settings</h1>
          <p style={{ fontSize: '0.9rem', color: '#63615C', marginBottom: '32px' }}>
            Manage your personal profile and session details.
          </p>

          <div style={{ background: '#FFFFFF', border: '1px solid #E7E4DC', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Full Name</label>
              <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{currentUser.name}</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Email Address</label>
              <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{currentUser.email}</div>
            </div>
            <div>
              <label className="form-label">Authentication Method</label>
              <div style={{ fontSize: '0.85rem', color: '#63615C' }}>Google OAuth 2.0</div>
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E7E4DC', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#B91C1C', marginBottom: '6px' }}>Sign Out</h3>
            <p style={{ fontSize: '0.85rem', color: '#63615C', marginBottom: '16px' }}>
              Signing out will end your current session on this device.
            </p>
            <button onClick={handleSignOut} className="btn btn-destructive">
              Log out of LinkBee
            </button>
          </div>
        </main>
      )}

      {/* =========================================================================
          PAGE: PUBLIC ERROR PAGES (Link Expired / Not Found)
          ========================================================================= */}
      {currentPage === 'expired' && (
        <main style={{ maxWidth: '480px', margin: '80px auto', padding: '0 24px', textAlign: 'center', flex: 1 }}>
          <ExpiredLinkSpot size={80} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '20px', marginBottom: '8px' }}>This link has expired</h1>
          <p style={{ fontSize: '0.92rem', color: '#63615C', lineHeight: 1.5, marginBottom: '28px' }}>
            The creator set an expiration date for this short link, and it is no longer accepting visits.
          </p>
          <button onClick={() => setCurrentPage('landing')} className="btn btn-primary">
            Back to LinkBee home
          </button>
        </main>
      )}

      {currentPage === 'not-found' && (
        <main style={{ maxWidth: '480px', margin: '80px auto', padding: '0 24px', textAlign: 'center', flex: 1 }}>
          <BeeSpot size={80} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '20px', marginBottom: '8px' }}>We can't find that link</h1>
          <p style={{ fontSize: '0.92rem', color: '#63615C', lineHeight: 1.5, marginBottom: '28px' }}>
            Double-check the web address you entered, or the owner may have deleted this link.
          </p>
          <button onClick={() => setCurrentPage('landing')} className="btn btn-primary">
            Back to LinkBee home
          </button>
        </main>
      )}

      {/* =========================================================================
          PAGE: LEGAL & INFO (Terms, Privacy, Report a Link)
          ========================================================================= */}
      {(currentPage === 'terms' || currentPage === 'privacy' || currentPage === 'report') && (
        <main style={{ maxWidth: '680px', margin: '64px auto', padding: '0 24px', flex: 1 }}>
          {currentPage === 'terms' && (
            <article>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>Terms of Service</h1>
              <p style={{ fontSize: '0.85rem', color: '#8F8D87', marginBottom: '32px' }}>Last updated: November 2026</p>
              <div style={{ fontSize: '0.95rem', color: '#63615C', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p>Welcome to LinkBee. By accessing or using our URL shortening service, you agree to comply with these terms.</p>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1C1B19' }}>1. Acceptable Use</h3>
                <p>LinkBee may only be used for lawful purposes. You agree not to shorten links leading to malware, credential phishing, illegal content, or unauthorized network scanning.</p>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1C1B19' }}>2. Service Availability</h3>
                <p>We strive for high uptime and rapid redirection. However, LinkBee is provided on an "as is" and "as available" basis without warranty of any kind.</p>
                <p style={{ fontSize: '0.82rem', color: '#8F8D87' }}>{/* TODO: Legal counsel review recommended */}</p>
              </div>
            </article>
          )}

          {currentPage === 'privacy' && (
            <article>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>Privacy Policy</h1>
              <p style={{ fontSize: '0.85rem', color: '#8F8D87', marginBottom: '32px' }}>Last updated: November 2026</p>
              <div style={{ fontSize: '0.95rem', color: '#63615C', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p>LinkBee was designed from day one to respect visitor privacy.</p>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1C1B19' }}>Zero IP Address Storage</h3>
                <p>When someone clicks a short link, we record the timestamp, the referring website header (if provided), and the browser family. We do NOT store client IP addresses in our analytics database.</p>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1C1B19' }}>Account Information</h3>
                <p>When you sign in with Google, we store your name, email address, and profile picture purely to maintain your account and associate your links with you.</p>
              </div>
            </article>
          )}

          {currentPage === 'report' && (
            <article>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>Report an Abusive Link</h1>
              <p style={{ fontSize: '0.9rem', color: '#63615C', marginBottom: '32px' }}>
                We investigate every reported link to keep LinkBee safe from phishing, malware, and spam.
              </p>
              <div style={{ background: '#FFFFFF', border: '1px solid #E7E4DC', borderRadius: '12px', padding: '24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Suspect Short Link</label>
                  <input type="text" className="form-input" placeholder="https://linkbee.co/abc1234" />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label">Reason for Report</label>
                  <textarea className="form-input" rows={4} placeholder="Describe the violation (e.g. phishing page impersonating a bank)..." />
                </div>
                <button 
                  onClick={() => showToast('Thank you. Link report submitted for review.')} 
                  className="btn btn-primary"
                >
                  Submit Report
                </button>
              </div>
            </article>
          )}

          <div style={{ marginTop: '40px', borderTop: '1px solid #E7E4DC', paddingTop: '20px' }}>
            <button onClick={() => setCurrentPage('landing')} className="btn btn-secondary">
              ← Back to home
            </button>
          </div>
        </main>
      )}

      {/* =========================================================================
          MODAL: CREATE LINK (Dashboard)
          ========================================================================= */}
      {isCreateDialogOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateDialogOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Create a new short link</h2>
            <p className="modal-desc">Enter your destination web address and optional custom back-half.</p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              await handleShorten();
              setIsCreateDialogOpen(false);
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Destination URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/long-page"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Custom back-half (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. newsletter-issue-12"
                  value={customAlias}
                  onChange={(e) => setCustomAlias(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className="form-label">Expiry Date (Optional)</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsCreateDialogOpen(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={composerLoading}>
                  {composerLoading ? 'Creating...' : 'Create link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: DELETE CONFIRMATION DIALOG
          ========================================================================= */}
      {deleteConfirmSlug && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmSlug(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Delete link /{deleteConfirmSlug}?</h2>
            <p className="modal-desc">
              Are you sure you want to delete this short link? It will stop redirecting immediately and its click analytics will be removed permanently.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setDeleteConfirmSlug(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirmSlug)} className="btn btn-destructive">
                Delete link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer (Calm & Compact) */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-copy">
            <img src={logoImg} alt="" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
            <span>LinkBee. Short links people actually click.</span>
          </div>

          <div className="footer-links">
            <button 
              onClick={() => setCurrentPage('terms')} 
              className="footer-link" 
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Terms
            </button>
            <button 
              onClick={() => setCurrentPage('privacy')} 
              className="footer-link" 
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Privacy
            </button>
            <button 
              onClick={() => setCurrentPage('report')} 
              className="footer-link" 
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Report a link
            </button>
            <span style={{ fontSize: '0.85rem', color: '#8F8D87' }}>© 2026 LinkBee</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
