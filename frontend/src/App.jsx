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
  Shield, 
  User, 
  AlertCircle, 
  Calendar, 
  X,
  Mail,
  Lock,
  RefreshCw,
  Search,
  Route,
  SlidersHorizontal,
  Clock3,
  LockKeyhole,
  LayoutDashboard,
  MousePointer2
} from 'lucide-react';
import logoImg from './assets/logo.jpg';

export default function App() {
  // Navigation / Page state
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing', 'dashboard', 'account', 'auth', 'verify-email', 'terms', 'privacy', 'report', 'expired', 'not-found'
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [toastMessage, setToastMessage] = useState('');

  // Session state
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth form state
  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFormError, setAuthFormError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Email verification state
  const [verificationStatus, setVerificationStatus] = useState('pending'); // 'pending', 'success', 'error'
  const [verificationMessage, setVerificationMessage] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);

  // Landing Composer state
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

  // Abuse report form state
  const [reportUrl, setReportUrl] = useState('');
  const [reportReason, setReportReason] = useState('phishing');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (window.location.pathname === '/verify-email' && token) {
      setCurrentPage('verify-email');
      handleVerifyToken(token);
    } else {
      checkSession();
    }
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

  const handleVerifyToken = async (token) => {
    setVerificationStatus('pending');
    try {
      const res = await fetch(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data.success) {
        setVerificationStatus('success');
        setVerificationMessage(data.message || 'Email verified successfully.');
        if (data.data?.user) {
          setCurrentUser(data.data.user);
        }
        showToast('Email verified. Unlimited links unlocked.');
      } else {
        setVerificationStatus('error');
        setVerificationMessage(data.error?.message || 'Verification link is invalid or expired.');
      }
    } catch {
      setVerificationStatus('error');
      setVerificationMessage('Failed to connect to verification server. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      const res = await fetch('/api/v1/auth/resend-verification', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Verification email resent. Check your inbox.');
      } else {
        showToast(data.error?.message || 'Could not resend email.');
      }
    } catch {
      showToast('Network error resending email.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthFormError('');
    setAuthSubmitting(true);

    const endpoint = authMode === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/login';
    const payload = authMode === 'signup'
      ? { username: authUsername.trim(), email: authEmail.trim(), password: authPassword }
      : { login: (authEmail || authUsername).trim(), password: authPassword };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthFormError(data.error?.message || 'Authentication failed. Please check your credentials.');
        setAuthSubmitting(false);
        return;
      }

      setCurrentUser(data.data.user);
      loadUserLinks();
      setCurrentPage('dashboard');
      showToast(authMode === 'signup' ? 'Account created. 5 free links available.' : 'Signed in successfully');
      setAuthPassword('');
    } catch {
      setAuthFormError('Network connection issue. Please try again.');
    } finally {
      setAuthSubmitting(false);
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

      if (res.status === 403) {
        if (data.error?.code === 'AUTH_REQUIRED_LIMIT') {
          setComposerState('quota_exceeded');
          setComposerLoading(false);
          return;
        } else if (data.error?.code === 'VERIFICATION_REQUIRED_LIMIT') {
          setComposerError(data.error.message);
          setComposerState('error');
          setComposerLoading(false);
          return;
        }
      }

      if (!res.ok) {
        let errorMsg = data.error?.message || 'That does not look like a valid link. Try adding https:// at the start.';
        if (data.error?.code === 'ALIAS_IN_USE') {
          errorMsg = `The custom back-half "${customAlias}" is already taken. Try another name.`;
        }
        setComposerError(errorMsg);
        setComposerState('error');
        setComposerLoading(false);
        return;
      }

      setCreatedResult(data.data);
      setComposerState('success');
      setComposerLoading(false);

      if (currentUser) {
        loadUserLinks();
        fetchAnalytics(data.data.shortCode);
        checkSession();
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
        checkSession();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHero(true);
    showToast('Copied to clipboard');
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

  const handleReportSubmit = async (event) => {
    event.preventDefault();
    setReportError('');
    setReportSuccess(false);
    setReportSubmitting(true);

    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUrl: reportUrl,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReportError(data.error?.message || 'We could not submit that report. Please try again.');
        return;
      }
      setReportSuccess(true);
      setReportUrl('');
      setReportReason('phishing');
      setReportDetails('');
    } catch {
      setReportError('Network connection issue. Please try again.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const filteredLinks = userLinks.filter((l) => 
    l.shortCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.originalUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-shell">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast-bar" role="status" aria-live="polite">
          <Check size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Solid Quiet Navigation */}
      <header className="top-nav">
        <div className="top-nav-inner">
          <a 
            href="/" 
            className="brand-anchor"
            onClick={(e) => { e.preventDefault(); setCurrentPage('landing'); }}
          >
            <img src={logoImg} alt="LinkBee" className="brand-mark" />
            <span className="brand-wordmark">LinkBee</span>
          </a>

          {currentPage === 'landing' && (
            <nav className="nav-links" aria-label="Main navigation">
              <a href="#features">Product</a>
              <a href="#questions">FAQ</a>
              <a href="#shorten">Shorten a link</a>
            </nav>
          )}

          <div className="nav-actions">
            {authLoading ? (
              <span style={{ fontSize: '0.82rem', color: '#8A857B' }}>Checking session...</span>
            ) : currentUser ? (
              <>
                <button 
                  onClick={() => setCurrentPage('dashboard')} 
                  className={`btn ${currentPage === 'dashboard' ? 'btn-secondary' : 'btn-ghost'}`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => setCurrentPage('account')} 
                  className={`btn ${currentPage === 'account' ? 'btn-secondary' : 'btn-ghost'}`}
                >
                  Account
                </button>
                <button onClick={handleSignOut} className="btn btn-ghost" title="Log out">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => { setAuthMode('login'); setCurrentPage('auth'); setAuthFormError(''); }} 
                  className="btn btn-ghost"
                >
                  Log in
                </button>
                <button 
                  onClick={() => { setAuthMode('signup'); setCurrentPage('auth'); setAuthFormError(''); }} 
                  className="btn btn-primary"
                >
                  Sign up free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Unverified Account Banner */}
      {currentUser && !currentUser.isVerified && currentPage !== 'verify-email' && (
        <div className="unverified-banner">
          <span>
            <strong>Verify your email ({currentUser.email})</strong> to unlock unlimited short links.
          </span>
          <button 
            onClick={handleResendVerification} 
            disabled={resendingEmail}
            className="btn btn-secondary" 
            style={{ height: '28px', padding: '0 10px', fontSize: '0.78rem' }}
          >
            {resendingEmail ? 'Sending...' : 'Resend verification email'}
          </button>
        </div>
      )}

      {/* =========================================================================
          PAGE: EMAIL & PASSWORD AUTH
          ========================================================================= */}
      {currentPage === 'auth' && (
        <main style={{ maxWidth: '400px', margin: '72px auto', padding: '0 24px', flex: 1, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <img src={logoImg} alt="LinkBee" style={{ width: '36px', height: '36px', borderRadius: '8px', margin: '0 auto 12px auto' }} />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: '#1C1B19', letterSpacing: '-0.02em' }}>
              {authMode === 'signup' ? 'Create your LinkBee account' : 'Sign in to LinkBee'}
            </h1>
            <p style={{ fontSize: '0.88rem', color: '#5E5B54', marginTop: '6px' }}>
              {authMode === 'signup' 
                ? 'Get 5 free short links instantly. Verify email for unlimited.' 
                : 'Enter your credentials to access your dashboard.'}
            </p>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 2px rgba(28,27,25,0.04)' }}>
            <form onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. alex_mercer"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    required
                    autoFocus
                  />
                  <span style={{ fontSize: '0.74rem', color: '#8A857B', marginTop: '4px', display: 'block' }}>Letters, numbers, underscores and hyphens</span>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">{authMode === 'signup' ? 'Email Address' : 'Email or Username'}</label>
                <input
                  type={authMode === 'signup' ? 'email' : 'text'}
                  className="form-input"
                  placeholder={authMode === 'signup' ? 'you@domain.com' : 'you@domain.com or username'}
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  autoFocus={authMode === 'login'}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />
                {authMode === 'signup' && (
                  <span style={{ fontSize: '0.74rem', color: '#8A857B', marginTop: '4px', display: 'block' }}>Minimum 6 characters</span>
                )}
              </div>

              {authFormError && (
                <div className="error-banner" style={{ marginBottom: '16px' }} role="alert">
                  <AlertCircle size={16} />
                  <span>{authFormError}</span>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', height: '40px', fontSize: '0.92rem' }}
                disabled={authSubmitting}
              >
                {authSubmitting 
                  ? 'Please wait...' 
                  : authMode === 'signup' ? 'Create free account' : 'Sign in'}
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.84rem', color: '#5E5B54' }}>
              {authMode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <button 
                    onClick={() => { setAuthMode('login'); setAuthFormError(''); }}
                    style={{ background: 'none', border: 'none', color: '#1C1B19', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  Need an account?{' '}
                  <button 
                    onClick={() => { setAuthMode('signup'); setAuthFormError(''); }}
                    style={{ background: 'none', border: 'none', color: '#1C1B19', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Sign up free
                  </button>
                </>
              )}
            </div>
          </div>
        </main>
      )}

      {/* =========================================================================
          PAGE: EMAIL VERIFICATION CONFIRMATION (/verify-email)
          ========================================================================= */}
      {currentPage === 'verify-email' && (
        <main style={{ maxWidth: '440px', margin: '80px auto', padding: '0 24px', textAlign: 'center', flex: 1 }}>
          {verificationStatus === 'pending' && (
            <div>
              <RefreshCw size={32} style={{ margin: '0 auto 16px auto', color: '#D97706' }} />
              <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Verifying your email...</h1>
              <p style={{ fontSize: '0.88rem', color: '#5E5B54', marginTop: '8px' }}>Please hold on while we confirm your account.</p>
            </div>
          )}

          {verificationStatus === 'success' && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: '12px', padding: '32px 24px' }}>
              <Check size={36} color="#16A34A" style={{ margin: '0 auto 16px auto' }} />
              <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: '#16A34A' }}>Email verified</h1>
              <p style={{ fontSize: '0.9rem', color: '#5E5B54', lineHeight: 1.6, marginTop: '8px', marginBottom: '24px' }}>
                Your email address has been verified. You now have unlimited short links and access to real-time analytics.
              </p>
              <button 
                onClick={() => setCurrentPage('dashboard')} 
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Go to dashboard
              </button>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E5DD', borderRadius: '12px', padding: '32px 24px' }}>
              <AlertCircle size={36} color="#DC2626" style={{ margin: '0 auto 16px auto' }} />
              <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#DC2626' }}>Verification failed</h1>
              <p style={{ fontSize: '0.9rem', color: '#5E5B54', lineHeight: 1.6, marginTop: '8px', marginBottom: '24px' }}>
                {verificationMessage}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={() => setCurrentPage('landing')} className="btn btn-secondary">
                  Back to home
                </button>
                {currentUser && (
                  <button onClick={handleResendVerification} className="btn btn-primary">
                    Resend email
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* =========================================================================
          PAGE: LANDING (Asymmetric Split with Hero Product Terminal)
          ========================================================================= */}
      {currentPage === 'landing' && (
        <main>
          {/* Hero Section */}
          <section className="hero-wrapper" id="shorten">
            <div className="hero-grid">
              {/* Left Column: Headline, Clear Benefit, and Primary Input */}
              <div className="hero-content">
                <div className="hero-brand-lockup">
                  <img src={logoImg} alt="" />
                  <span>LinkBee</span>
                </div>

                <h1 className="hero-title">
                  Make every link feel like it belongs.
                </h1>

                <p className="hero-description">
                  Create a simple, memorable URL for the things you send. Keep it organised, give it an ending people recognise, and see its private click history when you need it.
                </p>

                {/* Main Link Input Card */}
                {composerState === 'success' && createdResult ? (
                  <div className="hero-success-box">
                    <div className="hero-success-header">
                      <div>
                        <a 
                          href={createdResult.shortUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="hero-success-link"
                        >
                          {createdResult.shortUrl}
                        </a>
                        <div className="hero-success-dest">↳ {createdResult.originalUrl}</div>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(createdResult.shortUrl)} 
                        className="btn btn-primary"
                        aria-live="polite"
                      >
                        {copiedHero ? <Check size={16} /> : <Copy size={16} />}
                        <span>{copiedHero ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {!currentUser && (
                      <div className="hero-success-cta-strip">
                        <span>Want to see who clicks this? Create a free account.</span>
                        <button 
                          onClick={() => { setAuthMode('signup'); setCurrentPage('auth'); }} 
                          className="btn btn-secondary" 
                          style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem' }}
                        >
                          Sign up free
                        </button>
                      </div>
                    )}

                    <div style={{ marginTop: '12px', textAlign: 'right' }}>
                      <button 
                        onClick={resetComposer} 
                        className="btn-ghost" 
                        style={{ fontSize: '0.82rem', padding: '4px 8px', cursor: 'pointer' }}
                      >
                        Shorten another link →
                      </button>
                    </div>
                  </div>
                ) : composerState === 'quota_exceeded' ? (
                  <div className="hero-quota-box">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '6px' }}>
                      You have used your 1 free guest link
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: '#5E5B54', marginBottom: '16px', lineHeight: 1.5 }}>
                      Sign up for a free account to unlock 5 short links immediately, or verify your email for unlimited links and click analytics.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button onClick={() => { setAuthMode('signup'); setCurrentPage('auth'); }} className="btn btn-primary">
                        Sign up free
                      </button>
                      <button onClick={() => { setAuthMode('login'); setCurrentPage('auth'); }} className="btn btn-secondary">
                        Log in
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleShorten} className="hero-input-card">
                    <div className="hero-input-bar">
                      <input
                        type="url"
                        className="hero-input"
                        placeholder="Paste your long link here"
                        value={heroUrl}
                        onChange={(e) => setHeroUrl(e.target.value)}
                        disabled={composerLoading}
                        required
                      />
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={composerLoading}
                      >
                        {composerLoading ? 'Shortening...' : 'Shorten'}
                      </button>
                    </div>

                    <div className="hero-input-meta">
                      <span>
                        {currentUser 
                          ? (currentUser.isVerified ? 'Unlimited links with verified account' : `${5 - (currentUser.linkCount || 0)} of 5 free links remaining`)
                          : '1 free link without an account'}
                      </span>
                      <button
                        type="button"
                        className="options-toggle-btn"
                        onClick={() => setShowOptions(!showOptions)}
                        aria-expanded={showOptions}
                      >
                        <span>Custom ending or expiry</span>
                        <ChevronDown size={14} style={{ transform: showOptions ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                      </button>
                    </div>

                    {showOptions && (
                      <div className="options-drawer">
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
                          <label className="form-label">Expiry date</label>
                          <input
                            type="datetime-local"
                            className="form-input"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {composerError && (
                      <div className="error-banner" role="alert">
                        <AlertCircle size={16} />
                        <span>{composerError}</span>
                      </div>
                    )}
                  </form>
                )}
              </div>

              <div className="hero-product-card">
                <div className="product-card-chrome">
                  <div className="product-card-brand"><img src={logoImg} alt="" /> LinkBee</div>
                  <span>New short link</span>
                </div>
                <div className="product-card-body">
                  <div className="product-icon"><Link2 size={22} /></div>
                  <div>
                    <span className="product-label">A familiar link, simplified</span>
                    <strong>linkbee.co/your-link</strong>
                  </div>
                  <div className="product-route"><span>Destination</span><span className="route-line" /><span>Shared</span></div>
                </div>
                <div className="product-card-footer">
                  <span>Custom ending</span>
                  <span>Optional expiry</span>
                  <span>Private analytics</span>
                </div>
              </div>
            </div>
          </section>

          {/* Feature Tiles Section */}
          <section className="section-wrapper" id="features">
            <div className="section-head">
              <div className="section-eyebrow">What LinkBee does</div>
              <h2 className="section-heading">The useful parts of a link, without the clutter</h2>
            </div>

            <div className="features-grid">
              <div className="feature-tile">
                <div className="feature-icon"><Route size={21} /></div>
                <h3 className="feature-title">Shorten any link</h3>
                <p className="feature-desc">Paste a long link, get a clean short address you can share anywhere.</p>
                <a href="#top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="feature-action-link">
                  <span>Try it free</span>
                  <ArrowRight size={14} />
                </a>
              </div>

              <div className="feature-tile">
                <div className="feature-icon"><SlidersHorizontal size={21} /></div>
                <h3 className="feature-title">Choose your own ending</h3>
                <p className="feature-desc">Turn a messy destination into a short address people can recognise and trust.</p>
                <a href="#top" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setShowOptions(true); }} className="feature-action-link">
                  <span>Pick a back-half</span>
                  <ArrowRight size={14} />
                </a>
              </div>

              <div className="feature-tile">
                <div className="feature-icon"><MousePointer2 size={21} /></div>
                <h3 className="feature-title">See who clicks</h3>
                <p className="feature-desc">See each link’s click history and referrer information from your private dashboard.</p>
                <button onClick={() => { setAuthMode('signup'); setCurrentPage('auth'); }} className="feature-action-link">
                  <span>View click stats</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="feature-tile">
                <div className="feature-icon"><Clock3 size={21} /></div>
                <h3 className="feature-title">Set it to expire</h3>
                <p className="feature-desc">Pick a date and the link switches itself off. Good for offers and events.</p>
                <a href="#top" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setShowOptions(true); }} className="feature-action-link">
                  <span>Set an expiry date</span>
                  <ArrowRight size={14} />
                </a>
              </div>

              <div className="feature-tile">
                <div className="feature-icon"><LayoutDashboard size={21} /></div>
                <h3 className="feature-title">Keep it all in one place</h3>
                <p className="feature-desc">Search, copy and clean up every link from a single dashboard.</p>
                <button onClick={() => { setAuthMode('login'); setCurrentPage('auth'); }} className="feature-action-link">
                  <span>Open dashboard</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="feature-tile">
                <div className="feature-icon"><LockKeyhole size={21} /></div>
                <h3 className="feature-title">Privacy first</h3>
                <p className="feature-desc">We record click counts and sources without storing IP addresses or personal data.</p>
                <button onClick={() => setCurrentPage('privacy')} className="feature-action-link">
                  <span>Read privacy policy</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </section>

          {/* FAQ Accordion */}
          <section className="faq-container" id="questions">
            <div className="section-head" style={{ textAlign: 'center', margin: '0 auto 32px auto' }}>
              <div className="section-eyebrow">FAQ</div>
              <h2 className="section-heading">Frequently asked questions</h2>
            </div>

            <div className="faq-row">
              <button 
                className="faq-button" 
                onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}
                aria-expanded={openFaq === 1}
              >
                <span>How many short links can I create?</span>
                <ChevronDown size={18} style={{ transform: openFaq === 1 ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {openFaq === 1 && (
                <div className="faq-answer">
                  You can create 1 link without signing up. Creating a free account gives you 5 short links immediately. Verifying your email address unlocks unlimited short links.
                </div>
              )}
            </div>

            <div className="faq-row">
              <button 
                className="faq-button" 
                onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}
                aria-expanded={openFaq === 2}
              >
                <span>Do I need an account to create a link?</span>
                <ChevronDown size={18} style={{ transform: openFaq === 2 ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {openFaq === 2 && (
                <div className="faq-answer">
                  No, you can shorten one link immediately as a guest. To create more links and access click statistics, create a free account with your email and password.
                </div>
              )}
            </div>

            <div className="faq-row">
              <button 
                className="faq-button" 
                onClick={() => setOpenFaq(openFaq === 3 ? null : 3)}
                aria-expanded={openFaq === 3}
              >
                <span>How do I unlock unlimited short links?</span>
                <ChevronDown size={18} style={{ transform: openFaq === 3 ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {openFaq === 3 && (
                <div className="faq-answer">
                  When you sign up, we send a verification link to your email address. Click the link in your email to verify your account and unlock unlimited links.
                </div>
              )}
            </div>

            <div className="faq-row">
              <button 
                className="faq-button" 
                onClick={() => setOpenFaq(openFaq === 4 ? null : 4)}
                aria-expanded={openFaq === 4}
              >
                <span>Do my short links expire?</span>
                <ChevronDown size={18} style={{ transform: openFaq === 4 ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {openFaq === 4 && (
                <div className="faq-answer">
                  Links do not expire unless you set an expiration date when creating the link. If you choose an expiration date, the link switches off automatically after that time.
                </div>
              )}
            </div>

            <div className="faq-row">
              <button 
                className="faq-button" 
                onClick={() => setOpenFaq(openFaq === 5 ? null : 5)}
                aria-expanded={openFaq === 5}
              >
                <span>Can I change where a link redirects after creating it?</span>
                <ChevronDown size={18} style={{ transform: openFaq === 5 ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {openFaq === 5 && (
                <div className="faq-answer">
                  Destination URLs cannot be edited once created to protect visitors against destination swapping. You can delete the link and create a new one at any time.
                </div>
              )}
            </div>

            <div className="faq-row">
              <button 
                className="faq-button" 
                onClick={() => setOpenFaq(openFaq === 6 ? null : 6)}
                aria-expanded={openFaq === 6}
              >
                <span>Who can see my click statistics?</span>
                <ChevronDown size={18} style={{ transform: openFaq === 6 ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {openFaq === 6 && (
                <div className="faq-answer">
                  Only you can see your click statistics. Analytics are strictly private to the account that created the link.
                </div>
              )}
            </div>
          </section>

          {/* Action Band */}
          <section className="action-band">
            <div className="action-band-inner">
              <h2 className="action-band-title">Your next link, shorter.</h2>
              <p className="action-band-caption">
                Paste a long link and try LinkBee in one second. No credit card required.
              </p>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
                className="btn btn-primary"
                style={{ height: '40px', padding: '0 20px', fontSize: '0.92rem' }}
              >
                Shorten a link now
              </button>
            </div>
          </section>
        </main>
      )}

      {/* =========================================================================
          PAGE: DASHBOARD (Desktop Tool Proportions, Strict Alignments)
          ========================================================================= */}
      {currentPage === 'dashboard' && currentUser && (
        <div className="dashboard-shell">
          <aside className="dashboard-nav-sidebar">
            <div>
              <div className="dash-menu-label">Workspace</div>
              <div className="dash-menu-group">
                <button 
                  className={`dash-menu-item ${selectedLinkSlug === null ? 'active' : ''}`}
                  onClick={() => setSelectedLinkSlug(null)}
                >
                  <Link2 size={16} />
                  <span>All Links</span>
                </button>
                <button 
                  className="dash-menu-item"
                  onClick={() => setCurrentPage('account')}
                >
                  <User size={16} />
                  <span>Account</span>
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <img src={currentUser.avatarUrl} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1C1B19' }}>@{currentUser.username}</span>
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#8A857B' }}>
                {currentUser.isVerified ? '✓ Verified (Unlimited)' : `${currentUser.linkCount || userLinks.length} / 5 Links Used`}
              </div>
            </div>
          </aside>

          <main className="dashboard-body">
            <div className="dashboard-toolbar">
              <div>
                <h1 className="dashboard-title">Links</h1>
                <p style={{ fontSize: '0.85rem', color: '#5E5B54', marginTop: '2px' }}>
                  Manage short links created under your account.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search links..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ width: '180px', height: '36px' }}
                />
                <button 
                  onClick={() => setIsCreateDialogOpen(true)} 
                  className="btn btn-primary"
                >
                  Create link
                </button>
              </div>
            </div>

            {/* Links Table */}
            {userLinks.length === 0 ? (
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '56px 24px', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '6px' }}>No links yet</h3>
                <p style={{ fontSize: '0.88rem', color: '#5E5B54', marginBottom: '20px' }}>
                  Create your first link to start sharing and tracking clicks.
                </p>
                <button onClick={() => setIsCreateDialogOpen(true)} className="btn btn-primary">
                  Create your first link
                </button>
              </div>
            ) : (
              <div className="data-table-card">
                {filteredLinks.map((link) => (
                  <div key={link.id} className="data-table-row">
                    <div className="row-primary-cell">
                      <div className="row-avatar">
                        {link.shortCode.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <a 
                            href={link.shortUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="row-slug-text"
                          >
                            /{link.shortCode}
                          </a>
                          <button 
                            onClick={() => copyToClipboard(link.shortUrl)} 
                            className="btn-ghost" 
                            style={{ padding: '2px 4px', fontSize: '0.75rem', cursor: 'pointer', border: 'none' }}
                            title="Copy link"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                        <div className="row-destination-text" title={link.originalUrl}>
                          {link.originalUrl}
                        </div>
                      </div>
                    </div>

                    <div className="row-meta-cell">
                      <div className="row-count-badge">
                        {link.totalClicks || 0} {link.totalClicks === 1 ? 'click' : 'clicks'}
                      </div>
                      <button 
                        onClick={() => fetchAnalytics(link.shortCode)} 
                        className="btn btn-secondary"
                        style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem' }}
                      >
                        Stats
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmSlug(link.shortCode)} 
                        className="btn-ghost"
                        style={{ padding: '6px', color: '#DC2626', border: 'none', cursor: 'pointer' }}
                        title="Delete link"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* In-Line Analytics Details */}
            {selectedLinkSlug && analyticsData && (
              <div style={{ marginTop: '28px', background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Analytics for /{selectedLinkSlug}</h2>
                    <span style={{ fontSize: '0.8rem', color: '#5E5B54' }}>Destination: {analyticsData.originalUrl}</span>
                  </div>
                  <button onClick={() => setSelectedLinkSlug(null)} className="btn-ghost" style={{ padding: '4px', border: 'none', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                  <div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 600, fontFamily: 'monospace' }}>
                      {analyticsData.stats.totalClicks}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#5E5B54', fontWeight: 500 }}>Total visits recorded</div>
                    <div style={{ fontSize: '0.75rem', color: '#8A857B', marginTop: '4px' }}>Zero IP address storage</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#8A857B', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Top Referrers
                    </div>
                    {analyticsData.stats.topReferrers.length === 0 ? (
                      <div style={{ fontSize: '0.85rem', color: '#8A857B' }}>No visits yet. Share your link to see data.</div>
                    ) : (
                      analyticsData.stats.topReferrers.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-subtle)', fontSize: '0.84rem' }}>
                          <span style={{ fontWeight: 500 }}>{r.source}</span>
                          <span style={{ fontFamily: 'monospace', color: '#5E5B54' }}>{r.count}</span>
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
        <main style={{ maxWidth: '580px', margin: '48px auto', padding: '0 24px', flex: 1 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '6px' }}>Account Settings</h1>
          <p style={{ fontSize: '0.88rem', color: '#5E5B54', marginBottom: '28px' }}>
            Manage your personal profile and verification status.
          </p>

          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Username</label>
              <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>@{currentUser.username}</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Email Address</label>
              <div style={{ fontSize: '0.92rem', color: '#1C1B19' }}>{currentUser.email}</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Verification Status</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <span style={{ 
                  background: currentUser.isVerified ? '#F0FDF4' : '#FEF3C7', 
                  border: `1px solid ${currentUser.isVerified ? '#BBF7D0' : '#FDE68A'}`, 
                  color: currentUser.isVerified ? '#16A34A' : '#92400E', 
                  fontSize: '0.78rem', 
                  fontFamily: 'monospace',
                  padding: '3px 8px', 
                  borderRadius: '6px' 
                }}>
                  {currentUser.isVerified ? '✓ Verified Account (Unlimited links)' : 'Unverified (Max 5 links)'}
                </span>
                {!currentUser.isVerified && (
                  <button onClick={handleResendVerification} disabled={resendingEmail} className="btn btn-secondary" style={{ height: '28px', padding: '0 8px', fontSize: '0.78rem' }}>
                    {resendingEmail ? 'Sending...' : 'Resend Email'}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="form-label">Links Created</label>
              <div style={{ fontSize: '0.85rem', color: '#5E5B54' }}>
                {currentUser.isVerified 
                  ? `${currentUser.linkCount || userLinks.length} short links created (Unlimited plan)`
                  : `${currentUser.linkCount || userLinks.length} of 5 free short links used`}
              </div>
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#DC2626', marginBottom: '4px' }}>Sign Out</h3>
            <p style={{ fontSize: '0.85rem', color: '#5E5B54', marginBottom: '14px' }}>
              End your active session on this device.
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
        <main style={{ maxWidth: '440px', margin: '80px auto', padding: '0 24px', textAlign: 'center', flex: 1 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '8px' }}>This link has expired</h1>
          <p style={{ fontSize: '0.9rem', color: '#5E5B54', lineHeight: 1.5, marginBottom: '24px' }}>
            The creator set an expiration date for this short link, and it is no longer accepting visits.
          </p>
          <button onClick={() => setCurrentPage('landing')} className="btn btn-primary">
            Back to LinkBee home
          </button>
        </main>
      )}

      {currentPage === 'not-found' && (
        <main style={{ maxWidth: '440px', margin: '80px auto', padding: '0 24px', textAlign: 'center', flex: 1 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '8px' }}>Link not found</h1>
          <p style={{ fontSize: '0.9rem', color: '#5E5B54', lineHeight: 1.5, marginBottom: '24px' }}>
            Double-check the web address you entered, or the owner may have deleted this link.
          </p>
          <button onClick={() => setCurrentPage('landing')} className="btn btn-primary">
            Back to LinkBee home
          </button>
        </main>
      )}

      {/* =========================================================================
          PAGE: LEGAL & INFO
          ========================================================================= */}
      {(currentPage === 'terms' || currentPage === 'privacy' || currentPage === 'report') && (
        <main style={{ maxWidth: '640px', margin: '64px auto', padding: '0 24px', flex: 1 }}>
          {currentPage === 'terms' && (
            <article>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '8px' }}>Terms of Service</h1>
              <p style={{ fontSize: '0.82rem', color: '#8A857B', marginBottom: '28px' }}>Last updated: November 2026</p>
              <div style={{ fontSize: '0.92rem', color: '#5E5B54', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p>Welcome to LinkBee. By accessing our service, you agree to these terms.</p>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1C1B19' }}>1. Acceptable Use</h3>
                <p>LinkBee may only be used for lawful purposes. You agree not to shorten links leading to malware, credential phishing, illegal content, or unauthorized network scanning.</p>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1C1B19' }}>2. Account Plans & Fair Use</h3>
                <p>Guest users receive 1 trial short link. Registered users receive 5 short links on signup, and unlock unlimited short links upon verifying their email address.</p>
              </div>
            </article>
          )}

          {currentPage === 'privacy' && (
            <article>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '8px' }}>Privacy Policy</h1>
              <p style={{ fontSize: '0.82rem', color: '#8A857B', marginBottom: '28px' }}>Last updated: November 2026</p>
              <div style={{ fontSize: '0.92rem', color: '#5E5B54', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p>LinkBee is designed to respect visitor privacy.</p>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1C1B19' }}>Zero IP Address Storage</h3>
                <p>When someone clicks a short link, we record the timestamp, the referring website header (if provided), and the browser family. We do not store client IP addresses in our analytics database.</p>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1C1B19' }}>Account Information</h3>
                <p>When you register with username, email and password, passwords are cryptographically salted and hashed using bcrypt. Email addresses are used strictly for authentication and account verification.</p>
              </div>
            </article>
          )}

          {currentPage === 'report' && (
            <article>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '8px' }}>Report an Abusive Link</h1>
              <p style={{ fontSize: '0.88rem', color: '#5E5B54', marginBottom: '28px' }}>
                Tell us about a LinkBee link that may be unsafe. We review reports manually and do not store your IP address with this form.
              </p>
              <form onSubmit={handleReportSubmit} style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Suspect Short Link</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://linkbee.co/abc1234"
                    value={reportUrl}
                    onChange={(event) => setReportUrl(event.target.value)}
                    maxLength={2048}
                    required
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Reason for Report</label>
                  <select className="form-input" value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                    <option value="phishing">Phishing or credential theft</option>
                    <option value="malware">Malware or harmful download</option>
                    <option value="spam">Spam or deceptive promotion</option>
                    <option value="illegal-content">Illegal content</option>
                    <option value="other">Other safety concern</option>
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label">Additional details <span style={{ color: '#8A857B', fontWeight: 400 }}>(optional)</span></label>
                  <textarea
                    className="form-input"
                    rows={4}
                    style={{ height: 'auto', padding: '10px 12px', resize: 'vertical' }}
                    placeholder="What happened when you opened this link?"
                    value={reportDetails}
                    onChange={(event) => setReportDetails(event.target.value)}
                    maxLength={1000}
                  />
                </div>
                {reportError && <div className="error-banner" style={{ marginBottom: '16px' }} role="alert"><AlertCircle size={16} />{reportError}</div>}
                {reportSuccess && <div className="success-banner" role="status"><Check size={16} />Report received. Our team will review it.</div>}
                <button type="submit" className="btn btn-primary" disabled={reportSubmitting}>
                  {reportSubmitting ? 'Submitting…' : 'Submit report'}
                </button>
              </form>
            </article>
          )}

          <div style={{ marginTop: '36px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
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
        <div className="modal-overlay" onClick={() => setIsCreateDialogOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '4px' }}>Create a new short link</h2>
            <p style={{ fontSize: '0.85rem', color: '#5E5B54', marginBottom: '20px' }}>
              {currentUser && !currentUser.isVerified
                ? `You have used ${currentUser.linkCount || userLinks.length} of 5 free links. Verify your email for unlimited.`
                : 'Enter your destination web address and optional custom back-half.'}
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              await handleShorten();
              setIsCreateDialogOpen(false);
            }}>
              <div style={{ marginBottom: '14px' }}>
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

              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Custom back-half (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. newsletter-issue-12"
                  value={customAlias}
                  onChange={(e) => setCustomAlias(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">Expiry Date (Optional)</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
          MODAL: DELETE CONFIRMATION
          ========================================================================= */}
      {deleteConfirmSlug && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmSlug(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '6px' }}>Delete link /{deleteConfirmSlug}?</h2>
            <p style={{ fontSize: '0.88rem', color: '#5E5B54', marginBottom: '20px', lineHeight: 1.5 }}>
              Are you sure you want to delete this short link? It will stop redirecting immediately and its click analytics will be removed permanently.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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

      {/* Site Footer */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-brand">
            <a href="/" className="brand-anchor" onClick={(e) => { e.preventDefault(); setCurrentPage('landing'); }}>
              <img src={logoImg} alt="LinkBee" className="brand-mark" />
              <span className="brand-wordmark">LinkBee</span>
            </a>
            <p>Clear links for the things worth sharing</p>
            <span className="footer-copyright">© 2026 LinkBee</span>
            <span className="footer-meta">• Make long links short.</span>
          </div>

          <div className="footer-links">
            <button 
              onClick={() => setCurrentPage('terms')} 
              className="footer-link"
            >
              Terms
            </button>
            <button 
              onClick={() => setCurrentPage('privacy')} 
              className="footer-link"
            >
              Privacy
            </button>
            <button 
              onClick={() => setCurrentPage('report')} 
              className="footer-link"
            >
              Report a link
            </button>
            <span className="footer-meta">© 2026 LinkBee</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
