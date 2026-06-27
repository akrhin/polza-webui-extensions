/**
 * Polza.ai Balance Widget — floating widget with auto-refresh
 * Phase 1b: Click balance → today's spending with tokens
 * Close popup on outside click.
 * Key + interval configurable via prompt().
 */
(() => {
  'use strict';
  const KEY = 'polza_balance_api_key';
  const INT_KEY = 'polza_balance_interval';
  const BALANCE_URL = 'https://polza.ai/api/v1/balance';
  const HISTORY_URL = 'https://polza.ai/api/v1/history/generations';
  const TOPUP_URL = 'https://polza.ai/dashboard/billing';

  let apiKey = (() => { try { return localStorage.getItem(KEY) || ''; } catch(e) { return ''; } })();
  let intervalSec = (() => {
    try {
      const v = parseInt(localStorage.getItem(INT_KEY), 10);
      return v > 0 && v <= 3600 ? v : 60;
    } catch(e) { return 60; }
  })();
  let balance = null, error = null, loading = false;
  let todayCost = null, todayCostLoading = false;
  let popupVisible = false;
  let timer = null;

  function cssVar(name, fallback) {
    try {
      return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
    } catch(e) { return fallback; }
  }

  function isDarkTheme() {
    const bg = cssVar('--bg-color', '') || cssVar('--background-color', '') || cssVar('background', '');
    if (!bg) {
      try {
        const bg2 = getComputedStyle(document.body).backgroundColor;
        if (bg2 && bg2 !== 'rgba(0, 0, 0, 0)') {
          const m = bg2.match(/\d+/g);
          if (m) {
            const lum = parseInt(m[0]) * 0.299 + parseInt(m[1]) * 0.587 + parseInt(m[2]) * 0.114;
            return lum < 128;
          }
        }
      } catch(e) {}
      return document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');
    }
    return bg.toLowerCase().includes('dark') || bg.toLowerCase().includes('black');
  }

  const dark = isDarkTheme();

  async function fetchBalance() {
    if (!apiKey) return;
    loading = true; error = null; render();
    try {
      const r = await fetch(BALANCE_URL, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        error = (b && b.error && b.error.message) || `HTTP ${r.status}`;
        balance = null;
      } else {
        const d = await r.json();
        balance = parseFloat(d.amount);
        error = null;
      }
    } catch(e) { error = e.message; balance = null; }
    loading = false; render();
  }

  async function fetchTodayCost() {
    if (!apiKey || todayCostLoading) return;
    todayCostLoading = true; render();
    try {
      const now = new Date();
      const mskOff = 3 * 3600000;
      const mskDate = new Date(now.getTime() + mskOff);
      const dateFrom = new Date(Date.UTC(mskDate.getUTCFullYear(), mskDate.getUTCMonth(), mskDate.getUTCDate()) - mskOff).toISOString();
      const dateTo = now.toISOString();

      let allItems = [], page = 1;
      let totalItems = 0;
      while (true) {
        const url = `${HISTORY_URL}?page=${page}&limit=100&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}&sortBy=createdAt&sortOrder=desc`;
        const r = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        if (!r.ok) {
          let errMsg = `HTTP ${r.status}`;
          try { const e = await r.json(); errMsg = (e.error && e.error.message) || errMsg; } catch(e2) {}
          todayCost = { error: errMsg, total: 0, count: 0, totalTokens: 0, breakdown: [] };
          todayCostLoading = false; render(); return;
        }
        const data = await r.json();
        const items = data.items || data.data || [];
        const metaTotal = (data.meta && data.meta.total) || data.total || 0;
        if (page === 1) totalItems = metaTotal;
        items.forEach(item => {
          const c = parseFloat(item.cost ?? item.clientCost);
          if (!isNaN(c) && c > 0) {
            const pt = item.usage?.prompt_tokens || 0;
            const ct = item.usage?.completion_tokens || 0;
            allItems.push({
              model: item.modelDisplayName || item.model || 'unknown',
              cost: c,
              promptTokens: pt,
              completionTokens: ct,
            });
          }
        });
        if (items.length === 0 || items.length < 100 || allItems.length >= metaTotal) break;
        page++;
      }

      const totalCost = allItems.reduce((s, i) => s + i.cost, 0);
      const totalIn = allItems.reduce((s, i) => s + i.promptTokens, 0);
      const totalOut = allItems.reduce((s, i) => s + i.completionTokens, 0);
      const byModel = {};
      allItems.forEach(i => {
        if (!byModel[i.model]) byModel[i.model] = { cost: 0, promptTokens: 0, completionTokens: 0 };
        byModel[i.model].cost += i.cost;
        byModel[i.model].promptTokens += i.promptTokens;
        byModel[i.model].completionTokens += i.completionTokens;
      });
      const top5 = Object.entries(byModel)
        .map(([model, stats]) => ({ model, ...stats }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);
      todayCost = { total: totalCost, count: totalItems, totalIn, totalOut, breakdown: top5 };
    } catch(e) { todayCost = { error: e.message, total: 0, count: 0, totalIn: 0, totalOut: 0, breakdown: [] }; }
    todayCostLoading = false; render();
  }

  function togglePopup() {
    if (popupVisible) { closePopup(); return; }
    popupVisible = true;
    render();
    if (todayCost === null && !todayCostLoading) fetchTodayCost();
  }

  function closePopup() {
    popupVisible = false;
    render();
  }

  function handleOutsideClick(e) {
    const popup = document.getElementById('pz-popup');
    const root = document.getElementById('pz-root');
    if (!popup) return;
    if (popup.contains(e.target) || root?.contains(e.target)) return;
    closePopup();
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    if (apiKey && intervalSec > 0) {
      timer = setInterval(fetchBalance, intervalSec * 1000);
    }
  }

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function setKey(k, intSec) {
    const v = (k || '').trim();
    apiKey = v;
    try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch(e) {}
    if (intSec !== undefined) {
      const n = parseInt(intSec, 10);
      if (n > 0 && n <= 3600) {
        intervalSec = n;
        try { localStorage.setItem(INT_KEY, String(n)); } catch(e) {}
      }
    }
    balance = null; error = null; todayCost = null; todayCostLoading = false; popupVisible = false;
    stopTimer();
    render();
    if (v) { fetchBalance(); startTimer(); }
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function fmtNum(n) {
    return n.toLocaleString('ru-RU', {minimumFractionDigits:2,maximumFractionDigits:2});
  }

  function fmtTokens(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function render() {
    const el = document.getElementById('pz-root');
    if (!el) return;

    const textColor = dark ? '#e0e0e0' : '#222';
    const dimColor = dark ? 'rgba(224,224,224,0.7)' : 'rgba(34,34,34,0.65)';
    const borderColor = dark ? 'rgba(128,128,128,0.3)' : 'rgba(128,128,128,0.2)';
    const popupBg = dark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)';

    if (!apiKey) {
      el.innerHTML = `<button id="pz-btn" style="padding:3px 10px;border:1px solid ${borderColor};border-radius:4px;background:var(--accent-color,#4a9eff);color:#fff;cursor:pointer;font-size:12px;white-space:nowrap;">🔑 Polza</button>`;
      document.getElementById('pz-btn')?.addEventListener('click', () => {
        const k = window.prompt('Enter Polza.ai API key:');
        if (k === null) return;
        const sec = window.prompt('Refresh interval in seconds (default 60, max 3600):', String(intervalSec));
        const n = sec !== null ? parseInt(sec, 10) : 60;
        setKey(k, n > 0 && n <= 3600 ? n : 60);
      });
      return;
    }

    if (loading) {
      el.innerHTML = `<span style="font-size:13px;color:${textColor};">⏳</span>`;
    } else if (error) {
      el.innerHTML = `<span style="font-size:13px;color:#ff6b6b;cursor:pointer;" title="${escHtml(error)}">⚠</span>`;
    } else if (balance !== null) {
      const f = fmtNum(balance);
      el.innerHTML = `
        <span id="pz-balance" style="font-size:14px;font-weight:700;color:${textColor};font-variant-numeric:tabular-nums;cursor:pointer;">${f}</span>
        <span style="font-size:12px;font-weight:600;color:${dimColor};">₽</span>
        <a href="${TOPUP_URL}" target="_blank" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--accent-color,#4a9eff);color:#fff;font-size:11px;font-weight:bold;text-decoration:none;" title="Top up">+</a>`;
      document.getElementById('pz-balance')?.addEventListener('click', togglePopup);
      document.getElementById('pz-balance')?.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const k = window.prompt('New Polza.ai API key:', apiKey);
        if (k === null) return;
        const sec = window.prompt('Refresh interval in seconds (default 60, max 3600):', String(intervalSec));
        const n = sec !== null ? parseInt(sec, 10) : 60;
        setKey(k, n > 0 && n <= 3600 ? n : 60);
      });
    }

    // Popup
    const existing = document.getElementById('pz-popup');
    if (existing) existing.remove();
    if (!popupVisible) return;

    const popup = document.createElement('div');
    popup.id = 'pz-popup';
    popup.style.cssText = `position:fixed;top:30px;right:80px;z-index:100000;background:${popupBg};border:1px solid ${borderColor};border-radius:8px;padding:12px;font-size:12px;color:${textColor};min-width:260px;max-width:320px;backdrop-filter:blur(8px);box-shadow:0 4px 12px rgba(0,0,0,0.2);`;

    if (todayCostLoading) {
      popup.textContent = '⏳ Loading today\'s spending\u2026';
    } else if (todayCost && todayCost.error) {
      popup.innerHTML = `<span style="color:#ff6b6b;">${escHtml(todayCost.error)}</span>
        <br><button id="pz-retry" style="margin-top:6px;padding:2px 8px;border:1px solid ${borderColor};border-radius:4px;background:transparent;color:${textColor};cursor:pointer;font-size:11px;">Retry</button>`;
      document.getElementById('pz-retry')?.addEventListener('click', () => { todayCost = null; fetchTodayCost(); });
    } else if (todayCost === null) {
      popup.innerHTML = `<span style="color:${dimColor};">Click to load</span>
        <br><button id="pz-retry" style="margin-top:6px;padding:2px 8px;border:1px solid ${borderColor};border-radius:4px;background:transparent;color:${textColor};cursor:pointer;font-size:11px;">Load</button>`;
      document.getElementById('pz-retry')?.addEventListener('click', () => { todayCost = null; fetchTodayCost(); });
    } else {
      const t = fmtNum(todayCost.total);
      let html = `<div style="font-weight:700;margin-bottom:4px;">Today — ${t} <span style="font-weight:400;">₽</span></div>`;
      html += `<div style="font-size:10px;color:${dimColor};margin-bottom:6px;">${todayCost.count} gen · ${fmtTokens(todayCost.totalIn)} in / ${fmtTokens(todayCost.totalOut)} out</div>`;
      html += `<div style="border-top:1px solid ${borderColor};margin-bottom:4px;"></div>`;
      todayCost.breakdown.forEach((m) => {
        const cf = fmtNum(m.cost);
        const inToks = fmtTokens(m.promptTokens);
        const outToks = fmtTokens(m.completionTokens);
        html += `<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:1;min-width:0;">${escHtml(m.model)}</span>
          <span style="white-space:nowrap;flex-shrink:0;font-variant-numeric:tabular-nums;">${cf} <span style="color:${dimColor};font-size:10px;">₽</span> <span style="color:${dimColor};font-size:10px;">${inToks}/${outToks}</span></span>
        </div>`;
      });
      popup.innerHTML = html;
    }

    document.body.appendChild(popup);

    // Outside-click listener — capture phase to close before other handlers
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);
  }

  // Cleanup listener when popup closes via other means
  const origClose = closePopup;
  closePopup = function() {
    origClose();
    document.removeEventListener('click', handleOutsideClick);
  };

  function init() {
    if (document.getElementById('pz-root')) return;
    const el = document.createElement('div');
    el.id = 'pz-root';
    const bg = dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.7)';
    el.style.cssText = `position:fixed;top:4px;right:80px;z-index:99999;display:inline-flex;align-items:center;gap:4px;padding:2px 6px;background:${bg};border-radius:6px;backdrop-filter:blur(4px);`;
    document.body.appendChild(el);
    render();
    if (apiKey) { fetchBalance(); startTimer(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
