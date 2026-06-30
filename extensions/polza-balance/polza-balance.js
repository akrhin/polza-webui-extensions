/**
 * Polza.ai Balance Widget — floating widget with auto-refresh
 * UTC day boundary, dedup by id, provider breakdown, cache/reasoning stats
 * Close popup on outside click. Key + interval configurable via prompt().
 */
(() => {
  'use strict';
  const KEY = 'polza_balance_api_key';
  const INT_KEY = 'polza_balance_interval';
  const BALANCE_URL = 'https://polza.ai/api/v1/balance';
  const HISTORY_URL = 'https://polza.ai/api/v1/history/generations';
  const TOPUP_URL = 'https://polza.ai/dashboard/billing';

  function providerColor(name) {
    if (!name) return '#888';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 6) - hash);
    }
    // Золотое сечение → максимальная угловая дистанция между оттенками
    const hue = (((hash * 0.618033988749895) % 1) + 1) % 1;
    return `hsl(${Math.round(hue * 360)}, 55%, 50%)`;
  }

  let apiKey = (() => { try { return localStorage.getItem(KEY) || ''; } catch(e) { return ''; } })();
  let intervalSec = (() => {
    try {
      const v = parseInt(localStorage.getItem(INT_KEY), 10);
      return v > 0 && v <= 3600 ? v : 60;
    } catch(e) { return 60; }
  })();
  let balance = null, error = null, loading = false;
  let todayCost = null, todayCostLoading = false;
  let recentItems = null, recentLoading = false;
  let popupVisible = false;
  let popupTab = 'today';
  let timer = null;
  let totalSpent = null;

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
    loading = true; error = null; renderBalance();
    try {
      const r = await fetch(BALANCE_URL, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        error = (b && b.error && b.error.message) || `HTTP ${r.status}`;
        balance = null;
      } else {
        const d = await r.json();
        balance = parseFloat(d.amount);
        totalSpent = d.spentAmount ? parseFloat(d.spentAmount) : null;
        error = null;
      }
    } catch(e) { error = e.message; balance = null; }
    loading = false; renderBalance();
  }

  // ── History helpers ──────────────────────────────────────────

  function parseHistoryItem(item) {
    const pt = item.usage?.prompt_tokens || 0;
    const ct = item.usage?.completion_tokens || 0;
    const cached = item.usage?.prompt_tokens_details?.cached_tokens || 0;
    const reasoning = item.usage?.completion_tokens_details?.reasoning_tokens || 0;
    return {
      model: item.modelDisplayName || item.model || 'unknown',
      provider: item.provider || '',
      cost: parseFloat(item.cost ?? item.clientCost) || 0,
      promptTokens: pt,
      completionTokens: ct,
      cachedTokens: cached,
      reasoningTokens: reasoning,
      genTimeMs: item.generationTimeMs || 0,
      createdAt: item.createdAt || null,
    };
  }

  async function fetchHistory(params) {
    if (!apiKey) return { error: 'No API key' };
    const q = Object.entries(params).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const r = await fetch(`${HISTORY_URL}?${q}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!r.ok) {
      let errMsg = `HTTP ${r.status}`;
      try { const e = await r.json(); errMsg = (e.error && e.error.message) || errMsg; } catch(e2) {}
      return { error: errMsg };
    }
    const data = await r.json();
    return data;
  }

  async function fetchTodayCost() {
    if (!apiKey || todayCostLoading) return;
    todayCostLoading = true; renderPopup();
    try {
      // UTC day boundary — matches Polza LK / CSV export
      const now = new Date();
      const dateFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      const dateTo = now.toISOString();

      let allItems = [], seenIds = new Set(), page = 1;
      while (true) {
        const data = await fetchHistory({
          page, limit: 100,
          dateFrom, dateTo,
          sortBy: 'createdAt', sortOrder: 'desc'
        });
        if (data.error) { todayCost = { error: data.error, total: 0, count: 0, breakdown: [] }; break; }
        const items = data.items || data.data || [];
        items.forEach(item => {
          const id = item.id;
          if (id && seenIds.has(id)) return;          // deduplicate by id
          if (id) seenIds.add(id);
          const parsed = parseHistoryItem(item);
          if (parsed.cost > 0) allItems.push(parsed);
        });
        if (items.length < 100) break;                 // last page
        page++;
      }

      const totalCost = allItems.reduce((s, i) => s + i.cost, 0);
      const totalIn = allItems.reduce((s, i) => s + i.promptTokens, 0);
      const totalOut = allItems.reduce((s, i) => s + i.completionTokens, 0);
      const totalCached = allItems.reduce((s, i) => s + i.cachedTokens, 0);
      const totalReasoning = allItems.reduce((s, i) => s + i.reasoningTokens, 0);
      const byModel = {};
      const byProvider = {};
      allItems.forEach(i => {
        if (!byModel[i.model]) byModel[i.model] = { cost: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0 };
        byModel[i.model].cost += i.cost;
        byModel[i.model].promptTokens += i.promptTokens;
        byModel[i.model].completionTokens += i.completionTokens;
        byModel[i.model].cachedTokens += i.cachedTokens;
        const p = i.provider || 'unknown';
        if (!byProvider[p]) byProvider[p] = { cost: 0, count: 0 };
        byProvider[p].cost += i.cost;
        byProvider[p].count += 1;
      });
      const top5 = Object.entries(byModel)
        .map(([model, stats]) => ({ model, ...stats }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);
      const providerList = Object.entries(byProvider)
        .map(([provider, stats]) => ({ provider, ...stats }))
        .sort((a, b) => b.cost - a.cost);
      todayCost = {
        total: totalCost, count: allItems.length,    // real unique count
        totalIn, totalOut, totalCached, totalReasoning,
        breakdown: top5,
        providerBreakdown: providerList
      };
    } catch(e) { todayCost = { error: e.message, total: 0, count: 0, totalIn: 0, totalOut: 0, totalCached: 0, totalReasoning: 0, breakdown: [] }; }
    todayCostLoading = false; renderPopup();
  }

  async function fetchRecent() {
    if (!apiKey || recentLoading) return;
    recentLoading = true; renderPopup();
    try {
      const data = await fetchHistory({ page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
      if (data.error) { recentItems = { error: data.error, items: [] }; }
      else {
        const items = data.items || data.data || [];
        recentItems = { items: items.slice(0, 10).map(parseHistoryItem), error: null };
      }
    } catch(e) { recentItems = { error: e.message, items: [] }; }
    recentLoading = false; renderPopup();
  }

  function togglePopup() {
    if (popupVisible) { popupVisible = false; renderPopup(); }
    else { popupVisible = true; popupTab = 'today'; renderPopup(); }
    if (popupVisible) {
      if (todayCost === null && !todayCostLoading) fetchTodayCost();
      if (recentItems === null && !recentLoading) fetchRecent();
    }
  }

  function switchTab(tab) {
    popupTab = tab;
    renderPopup();
    if (tab === 'recent' && recentItems === null && !recentLoading) fetchRecent();
    if (tab === 'today' && todayCost === null && !todayCostLoading) fetchTodayCost();
  }

  function handleOutsideClick(e) {
    if (!popupVisible) return;
    const popup = document.getElementById('pz-popup');
    if (!popup) return;
    if (popup.contains(e.target) || e.target.closest('#pz-root')) return;
    popupVisible = false;
    renderPopup();
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
    balance = null; error = null; totalSpent = null;
    todayCost = null; todayCostLoading = false;
    recentItems = null; recentLoading = false; popupVisible = false;
    stopTimer();
    renderBalance();
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

  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtMs(ms) {
    if (!ms) return '';
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }

  function fmtPct(numer, denom) {
    if (!denom) return '';
    const raw = numer / denom * 100;
    return Math.min(raw, 100).toFixed(0) + '%';
  }

  // ── Renderers ────────────────────────────────────────────────

  function renderBalance() {
    const el = document.getElementById('pz-root');
    if (!el) return;

    const textColor = dark ? '#e0e0e0' : '#222';
    const dimColor = dark ? 'rgba(224,224,224,0.7)' : 'rgba(34,34,34,0.65)';
    const borderColor = dark ? 'rgba(128,128,128,0.3)' : 'rgba(128,128,128,0.2)';

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
  }

  function renderPopup() {
    const existing = document.getElementById('pz-popup');
    if (existing) existing.remove();
    if (!popupVisible) return;

    const textColor = dark ? '#e0e0e0' : '#222';
    const dimColor = dark ? 'rgba(224,224,224,0.7)' : 'rgba(34,34,34,0.65)';
    const borderColor = dark ? 'rgba(128,128,128,0.3)' : 'rgba(128,128,128,0.2)';
    const popupBg = dark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)';

    const popup = document.createElement('div');
    popup.id = 'pz-popup';
    popup.style.cssText = `position:fixed;top:30px;left:50%;transform:translateX(-50%);z-index:100000;background:${popupBg};border:1px solid ${borderColor};border-radius:8px;padding:8px;font-size:12px;color:${textColor};width:340px;max-width:calc(100vw - 24px);backdrop-filter:blur(8px);box-shadow:0 4px 12px rgba(0,0,0,0.2);`;
    popup.addEventListener('click', (e) => e.stopPropagation());

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `display:flex;gap:4px;margin-bottom:6px;border-bottom:1px solid ${borderColor};padding-bottom:4px;`;
    ['today', 'recent'].forEach(tab => {
      const btn = document.createElement('button');
      btn.textContent = tab === 'today' ? '📊 Today' : '🕐 Recent';
      btn.style.cssText = `flex:1;padding:3px 6px;border:1px solid transparent;border-radius:4px;background:${popupTab === tab ? 'var(--accent-color,#4a9eff)' : 'transparent'};color:${popupTab === tab ? '#fff' : textColor};cursor:pointer;font-size:11px;font-weight:${popupTab === tab ? '600' : '400'};`;
      btn.addEventListener('click', (e) => { e.stopPropagation(); switchTab(tab); });
      tabBar.appendChild(btn);
    });

    // Refresh button
    const rbtn = document.createElement('button');
    rbtn.textContent = '↻';
    rbtn.title = 'Refresh';
    const rbg = dark ? 'rgba(128,128,128,0.15)' : 'rgba(128,128,128,0.08)';
    rbtn.style.cssText = `padding:3px 8px;margin-left:4px;border:1px solid ${borderColor};border-radius:4px;background:${rbg};color:${textColor};cursor:pointer;font-size:12px;white-space:nowrap;`;
    rbtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Reload active tab from scratch
      if (popupTab === 'today') { todayCost = null; fetchTodayCost(); }
      else { recentItems = null; fetchRecent(); }
    });
    tabBar.appendChild(rbtn);

    popup.appendChild(tabBar);

    // Tab content
    const content = document.createElement('div');

    if (popupTab === 'today') {
      renderTodayTab(content, borderColor, textColor, dimColor);
    } else {
      renderRecentTab(content, borderColor, textColor, dimColor);
    }

    popup.appendChild(content);
    document.body.appendChild(popup);
  }

  function renderTodayTab(container, borderColor, textColor, dimColor) {
    if (todayCostLoading) {
      container.textContent = '⏳ Loading today\u2019s spending\u2026';
    } else if (todayCost && todayCost.error) {
      container.innerHTML = `<span style="color:#ff6b6b;">${escHtml(todayCost.error)}</span>
        <br><button id="pz-retry" style="margin-top:6px;padding:2px 8px;border:1px solid ${borderColor};border-radius:4px;background:transparent;color:${textColor};cursor:pointer;font-size:11px;">Retry</button>`;
      document.getElementById('pz-retry')?.addEventListener('click', () => { todayCost = null; fetchTodayCost(); });
    } else if (todayCost === null) {
      container.innerHTML = `<span style="color:${dimColor};">No data</span>
        <br><button id="pz-retry" style="margin-top:6px;padding:2px 8px;border:1px solid ${borderColor};border-radius:4px;background:transparent;color:${textColor};cursor:pointer;font-size:11px;">Load</button>`;
      document.getElementById('pz-retry')?.addEventListener('click', () => { todayCost = null; fetchTodayCost(); });
    } else {
      const t = fmtNum(todayCost.total);
      let html = `<div style="font-weight:700;margin-bottom:4px;">Today — ${t} <span style="font-weight:400;">₽</span></div>`;
      html += `<div style="font-size:10px;color:${dimColor};margin-bottom:2px;">${todayCost.count} gen · ${fmtTokens(todayCost.totalIn)} in / ${fmtTokens(todayCost.totalOut)} out</div>`;
      // Cache + reasoning on line 2
      let stats2 = [];
      if (todayCost.totalCached > 0) {
        stats2.push(`🗄 ${fmtPct(todayCost.totalCached, todayCost.totalIn)} cached`);
      }
      if (todayCost.totalReasoning > 0) {
        stats2.push(`🧠 ${fmtTokens(todayCost.totalReasoning)} thinking`);
      }
      if (stats2.length > 0) {
        html += `<div style="font-size:10px;color:${dimColor};margin-bottom:6px;">${stats2.join(' · ')}</div>`;
      }
      html += `<div style="border-top:1px solid ${borderColor};margin-bottom:4px;"></div>`;
      todayCost.breakdown.forEach((m) => {
        const cf = fmtNum(m.cost);
        const inToks = fmtTokens(m.promptTokens);
        const outToks = fmtTokens(m.completionTokens);
        let cacheBadge = '';
        if (m.cachedTokens > 0) {
          cacheBadge = `<span style="font-size:9px;color:#4a9eff;margin-left:4px;">🗄${fmtPct(m.cachedTokens, m.promptTokens)}</span>`;
        }
        html += `<div style="padding:2px 0;">
          <div style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(m.model)}">${escHtml(m.model)}${cacheBadge}</div>
          <div style="display:flex;gap:6px;font-size:10px;color:${dimColor};">
            <span>${inToks}/${outToks}</span>
            <span style="font-weight:600;color:${textColor};">${cf} ₽</span>
          </div>
        </div>`;
      });
      // Provider breakdown
      if (todayCost.providerBreakdown && todayCost.providerBreakdown.length > 1) {
        html += `<div style="border-top:1px solid ${borderColor};margin-top:4px;padding-top:4px;font-size:10px;color:${dimColor};margin-bottom:4px;">⛁ Providers</div>`;
        todayCost.providerBreakdown.forEach((p) => {
          const pcf = fmtNum(p.cost);
          const pColor = providerColor(p.provider);
          const badge = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${pColor};margin-right:4px;vertical-align:middle;"></span>`;
          const avgP = (p.cost / p.count).toFixed(2);
          html += `<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:10px;">
            <span>${badge}${p.provider} <span style="color:${dimColor};">(${p.count})</span></span>
            <span style="font-weight:600;color:${textColor};">${pcf} ₽ <span style="font-weight:400;color:${dimColor};font-size:9px;">avg ${avgP}</span></span>
          </div>`;
        });
      }
      // Total spent lifetime
      if (totalSpent !== null) {
        html += `<div style="border-top:1px solid ${borderColor};margin-top:6px;padding-top:4px;font-size:10px;color:${dimColor};">
          💰 Total spent all time: <span style="color:${textColor};font-weight:600;">${fmtNum(totalSpent)} ₽</span>
        </div>`;
      }
      container.innerHTML = html;
    }
  }

  function renderRecentTab(container, borderColor, textColor, dimColor) {
    if (recentLoading) {
      container.textContent = '⏳ Loading recent\u2026';
    } else if (recentItems && recentItems.error) {
      container.innerHTML = `<span style="color:#ff6b6b;">${escHtml(recentItems.error)}</span>
        <br><button id="pz-recent-retry" style="margin-top:6px;padding:2px 8px;border:1px solid ${borderColor};border-radius:4px;background:transparent;color:${textColor};cursor:pointer;font-size:11px;">Retry</button>`;
      document.getElementById('pz-recent-retry')?.addEventListener('click', () => { recentItems = null; fetchRecent(); });
    } else if (!recentItems || recentItems.items.length === 0) {
      container.innerHTML = `<span style="color:${dimColor};">No recent requests</span>
        <br><button id="pz-recent-retry" style="margin-top:6px;padding:2px 8px;border:1px solid ${borderColor};border-radius:4px;background:transparent;color:${textColor};cursor:pointer;font-size:11px;">Load</button>`;
      document.getElementById('pz-recent-retry')?.addEventListener('click', () => { recentItems = null; fetchRecent(); });
    } else {
      let html = `<div style="font-weight:600;margin-bottom:4px;">Recent 10</div>`;
      html += `<div style="border-top:1px solid ${borderColor};margin-bottom:4px;"></div>`;
      recentItems.items.forEach((item) => {
        const cf = fmtNum(item.cost);
        const inToks = fmtTokens(item.promptTokens);
        const outToks = fmtTokens(item.completionTokens);
        const time = item.createdAt ? fmtTime(item.createdAt) : '';
        const genTime = item.genTimeMs ? fmtMs(item.genTimeMs) : '';
        // Provider badge
        const pColor = providerColor(item.provider);
        const badge = item.provider
          ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${pColor};margin-right:4px;vertical-align:middle;" title="${escHtml(item.provider)}"></span>`
          : '';
        // Cache badge
        let cacheStr = '';
        if (item.cachedTokens > 0) {
          cacheStr = ` 🗄${fmtPct(item.cachedTokens, item.promptTokens)}`;
        }
        // Reasoning badge
        let reasonStr = '';
        if (item.reasoningTokens > 0) {
          reasonStr = ` 🧠${fmtTokens(item.reasoningTokens)}`;
        }
        html += `<div style="padding:3px 0;border-bottom:1px solid ${borderColor};">
          <div style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(item.model)}">${badge}${escHtml(item.model)}</div>
          <div style="display:flex;gap:6px;font-size:10px;color:${dimColor};">
            <span>${inToks}/${outToks}</span>
            <span style="font-weight:600;color:${textColor};">${cf} ₽</span>
            ${genTime ? `<span>⏱${genTime}</span>` : ''}
            ${cacheStr ? `<span style="color:#4a9eff;">${cacheStr}</span>` : ''}
            ${reasonStr ? `<span style="color:#d97757;">${reasonStr}</span>` : ''}
            ${time ? `<span style="margin-left:auto;">${time}</span>` : ''}
          </div>
        </div>`;
      });
      container.innerHTML = html;
    }
  }

  function init() {
    if (document.getElementById('pz-root')) return;

    // Single permanent outside-click listener
    document.addEventListener('click', handleOutsideClick);

    const el = document.createElement('div');
    el.id = 'pz-root';
    const bg = dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.7)';
    el.style.cssText = `position:fixed;top:4px;right:80px;z-index:99999;display:inline-flex;align-items:center;gap:4px;padding:2px 6px;background:${bg};border-radius:6px;backdrop-filter:blur(4px);`;
    document.body.appendChild(el);
    renderBalance();
    if (apiKey) { fetchBalance(); startTimer(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
