/**
 * Frontend Client Application
 * Pure Vanilla JavaScript: demonstrates clean DOM manipulation, fetch, and safe rendering (zero innerHTML).
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements: Shorten Form
  const shortenForm = document.getElementById('shorten-form');
  const originalUrlInput = document.getElementById('original-url');
  const customAliasInput = document.getElementById('custom-alias');
  const expiryDateInput = document.getElementById('expiry-date');
  const shortenBtn = document.getElementById('shorten-btn');
  const shortenError = document.getElementById('shorten-error');

  // Elements: Result Drawer
  const resultDrawer = document.getElementById('result-drawer');
  const shortUrlOutput = document.getElementById('short-url-output');
  const copyBtn = document.getElementById('copy-btn');
  const mgmtTokenOutput = document.getElementById('mgmt-token-output');
  const copyTokenBtn = document.getElementById('copy-token-btn');

  // Elements: Stats Inspector Form
  const statsForm = document.getElementById('stats-form');
  const statsCodeInput = document.getElementById('stats-code');
  const statsTokenInput = document.getElementById('stats-token');
  const statsBtn = document.getElementById('stats-btn');
  const statsError = document.getElementById('stats-error');
  const analyticsResults = document.getElementById('analytics-results');
  const statTotalClicks = document.getElementById('stat-total-clicks');
  const statLinkStatus = document.getElementById('stat-link-status');
  const statDestUrl = document.getElementById('stat-dest-url');
  const svgChartWrapper = document.getElementById('svg-chart-wrapper');
  const referrerListEl = document.getElementById('referrer-list-el');
  const deleteLinkBtn = document.getElementById('delete-link-btn');

  let activeInspectedCode = null;
  let activeInspectedToken = null;

  // Helper: Display Error Safely
  function showError(el, message) {
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function hideError(el) {
    el.textContent = '';
    el.classList.add('hidden');
  }

  // ========================================================================
  // 1. Shorten Form Submission
  // ========================================================================
  shortenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(shortenError);
    resultDrawer.classList.add('hidden');

    const originalUrl = originalUrlInput.value.trim();
    const customAlias = customAliasInput.value.trim() || undefined;
    const expiryRaw = expiryDateInput.value;
    const expiresAt = expiryRaw ? new Date(expiryRaw).toISOString() : undefined;

    shortenBtn.disabled = true;
    shortenBtn.textContent = 'Generating short link...';

    try {
      const response = await fetch('/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalUrl, customAlias, expiresAt }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Failed to shorten URL.');
      }

      // Safe rendering using textContent
      shortUrlOutput.textContent = payload.data.shortUrl;
      mgmtTokenOutput.textContent = payload.data.managementToken;

      resultDrawer.classList.remove('hidden');

      // Pre-fill stats form for user convenience
      statsCodeInput.value = payload.data.shortCode;
      statsTokenInput.value = payload.data.managementToken;
    } catch (err) {
      showError(shortenError, err.message);
    } finally {
      shortenBtn.disabled = false;
      shortenBtn.textContent = 'Shorten Link →';
    }
  });

  // Copy Buttons
  copyBtn.addEventListener('click', async () => {
    const text = shortUrlOutput.textContent;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
  });

  copyTokenBtn.addEventListener('click', async () => {
    const token = mgmtTokenOutput.textContent;
    if (!token) return;
    await navigator.clipboard.writeText(token);
    copyTokenBtn.textContent = 'Copied!';
    setTimeout(() => { copyTokenBtn.textContent = 'Copy Token'; }, 2000);
  });

  // ========================================================================
  // 2. Stats & Analytics Inspection
  // ========================================================================
  statsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(statsError);
    analyticsResults.classList.add('hidden');

    const code = statsCodeInput.value.trim();
    const token = statsTokenInput.value.trim();

    statsBtn.disabled = true;
    statsBtn.textContent = 'Loading stats...';

    try {
      const response = await fetch(`/api/v1/links/${encodeURIComponent(code)}`, {
        headers: {
          'X-Management-Token': token,
        },
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Failed to retrieve stats.');
      }

      activeInspectedCode = code;
      activeInspectedToken = token;

      renderAnalytics(payload.data);
      analyticsResults.classList.remove('hidden');
    } catch (err) {
      showError(statsError, err.message);
    } finally {
      statsBtn.disabled = false;
      statsBtn.textContent = 'Inspect Analytics 🔍';
    }
  });

  // Render Analytics Data using Pure Safe DOM APIs
  function renderAnalytics(data) {
    const { stats, originalUrl, isExpired } = data;

    statTotalClicks.textContent = stats.totalClicks.toLocaleString();
    statDestUrl.textContent = originalUrl;

    if (isExpired) {
      statLinkStatus.textContent = 'Expired';
      statLinkStatus.style.color = '#DC2626';
    } else {
      statLinkStatus.textContent = 'Active';
      statLinkStatus.style.color = '#059669';
    }

    // Render Top Referrers safely
    while (referrerListEl.firstChild) {
      referrerListEl.removeChild(referrerListEl.firstChild);
    }

    if (!stats.topReferrers || stats.topReferrers.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'referrer-item';
      emptyLi.textContent = 'No clicks recorded yet.';
      emptyLi.style.color = 'var(--text-muted)';
      referrerListEl.appendChild(emptyLi);
    } else {
      stats.topReferrers.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'referrer-item';

        const sourceSpan = document.createElement('span');
        sourceSpan.textContent = item.source;
        sourceSpan.style.fontWeight = '600';

        const countSpan = document.createElement('span');
        countSpan.textContent = `${item.count} clicks`;
        countSpan.style.fontFamily = 'var(--font-mono)';

        li.appendChild(sourceSpan);
        li.appendChild(countSpan);
        referrerListEl.appendChild(li);
      });
    }

    // Render Pure SVG Daily Trend Chart
    renderSvgDailyChart(stats.clicksByDay || []);
  }

  /**
   * Mathematically render an SVG bar chart without any external chart libraries.
   */
  function renderSvgDailyChart(dailyData) {
    while (svgChartWrapper.firstChild) {
      svgChartWrapper.removeChild(svgChartWrapper.firstChild);
    }

    if (dailyData.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.style.display = 'flex';
      placeholder.style.alignItems = 'center';
      placeholder.style.justifyContent = 'center';
      placeholder.style.height = '100%';
      placeholder.style.color = 'var(--text-muted)';
      placeholder.textContent = 'No daily click activity in the last 30 days.';
      svgChartWrapper.appendChild(placeholder);
      return;
    }

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 600 200');
    svg.setAttribute('preserveAspectRatio', 'none');

    const maxClicks = Math.max(...dailyData.map((d) => d.clicks), 1);
    const chartHeight = 150;
    const startY = 170;
    const barWidth = Math.max(10, Math.min(30, Math.floor(540 / dailyData.length) - 8));
    const stepX = 540 / dailyData.length;

    dailyData.forEach((day, index) => {
      const x = 30 + index * stepX + (stepX - barWidth) / 2;
      const barH = (day.clicks / maxClicks) * chartHeight;
      const y = startY - barH;

      // Create SVG Rect for bar
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barWidth);
      rect.setAttribute('height', Math.max(barH, 3));
      rect.setAttribute('fill', '#2563EB');
      rect.setAttribute('stroke', '#1C1917');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('rx', '2');

      // Title tooltip
      const title = document.createElementNS(svgNS, 'title');
      title.textContent = `${day.date}: ${day.clicks} clicks`;
      rect.appendChild(title);

      svg.appendChild(rect);
    });

    // Baseline horizontal axis line
    const axis = document.createElementNS(svgNS, 'line');
    axis.setAttribute('x1', '20');
    axis.setAttribute('y1', '172');
    axis.setAttribute('x2', '580');
    axis.setAttribute('y2', '172');
    axis.setAttribute('stroke', '#1C1917');
    axis.setAttribute('stroke-width', '2');
    svg.appendChild(axis);

    svgChartWrapper.appendChild(svg);
  }

  // ========================================================================
  // 3. Danger Zone: Delete Link
  // ========================================================================
  deleteLinkBtn.addEventListener('click', async () => {
    if (!activeInspectedCode || !activeInspectedToken) return;

    const confirmed = window.confirm(`Are you sure you want to permanently delete short code '${activeInspectedCode}'? This cannot be undone.`);
    if (!confirmed) return;

    deleteLinkBtn.disabled = true;
    deleteLinkBtn.textContent = 'Deleting...';

    try {
      const res = await fetch(`/api/v1/links/${encodeURIComponent(activeInspectedCode)}`, {
        method: 'DELETE',
        headers: { 'X-Management-Token': activeInspectedToken },
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error?.message || 'Failed to delete link.');
      }

      alert(`Short link '${activeInspectedCode}' has been permanently deleted.`);
      analyticsResults.classList.add('hidden');
      statsCodeInput.value = '';
      statsTokenInput.value = '';
    } catch (err) {
      alert(`Deletion error: ${err.message}`);
    } finally {
      deleteLinkBtn.disabled = false;
      deleteLinkBtn.textContent = 'Delete This Link';
    }
  });
});

