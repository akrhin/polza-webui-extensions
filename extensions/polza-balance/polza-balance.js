/**
 * Polza.ai Balance Widget — Hermes WebUI Extension
 *
 * Adds a small balance indicator to the WebUI sidebar.
 * API key is stored in localStorage, never sent anywhere
 * except directly to polza.ai/api/v1/balance.
 *
 * Security: key stays in the browser. No third-party scripts.
 * No innerHTML with external data — all dynamic content uses
 * safe DOM methods (textContent, createElement).
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'polza_balance_api_key';
  const BALANCE_URL = 'https://polza.ai/api/v1/balance';
  const TOPUP_URL = 'https://polza.ai/dashboard/billing';

  // ── State ─────────────────────────────────────────────
  let apiKey = localStorage.getItem(STORAGE_KEY) || '';
  let balance = null;
  let error = null;
  let loading = false;

  // ── DOM helpers ────────────────────���──────────────────
  function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') el.className = v;
      else if (k === 'style' && typeof v === 'object') { Object.assign(el.style, v); }
      else if (k.startsWith('data')) { el.setAttribute(k, v); }
      else { el.setAttribute(k, v); }
    }
    for (const child of children) {
      if (typeof child === 'string') { el.appendChild(document.createTextNode(child)); }
      else if (child instanceof Node) { el.appendChild(child); }
    }
    return el;
  }

  function $id(id) { return document.getElementById(id); }

  function clearNode(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  // ── API call ──────────────────────────────────────────
  async function fetchBalance() {
    if (!apiKey) return;
    loading = true;
    error = null;
    render();
    try {
      const resp = await fetch(BALANCE_URL, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        // body.error.message comes from polza.ai API — trusted source
        const msg = (body && body.error && body.error.message) || `HTTP ${resp.status}`;
        error = msg;
        balance = null;
      } else {
        const data = await resp.json();
        balance = parseFloat(data.amount);
        error = null;
      }
    } catch (e) {
      error = 'Network error: ' + e.message;
      balance = null;
    }
    loading = false;
    render();
  }

  // ── Save key ──────────────────────────────────────────
  function saveKey(key) {
    apiKey = key.trim();
    if (apiKey) {
      localStorage.setItem(STORAGE_KEY, apiKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      balance = null;
      error = null;
    }
    render();
    if (apiKey) fetchBalance();
  }

  // ── Render widget ─────────────────────────────────────
  function render() {
    const container = $id('polza-balance-widget');
    if (!container) return;

    const keySection = $id('polza-balance-key-section');
    const badge = $id('polza-balance-badge');
    if (!keySection || !badge) return;

    if (!apiKey) {
      // ── No key: show input ──
      keySection.style.display = 'block';
      badge.style.display = 'none';
      return;
    }

    // ── Key is set: show badge ──
    keySection.style.display = 'none';
    badge.style.display = 'flex';
    clearNode(badge);

    if (loading) {
      const spinner = createElement('span', { className: 'polza-balance-spinner' });
      badge.appendChild(spinner);
      badge.appendChild(document.createTextNode(' Loading...'));
    } else if (error) {
      badge.appendChild(createElement('span', { className: 'polza-balance-error' }, ['⚠']));
      badge.appendChild(document.createTextNode(' Error'));

      const tooltip = createElement('div', { className: 'polza-balance-tooltip' }, [error]);
      badge.appendChild(tooltip);

      const retry = createElement('button', { className: 'polza-balance-btn-small' }, ['↻']);
      retry.addEventListener('click', fetchBalance);
      badge.appendChild(retry);

      const reset = createElement('button', { className: 'polza-balance-btn-small' }, ['✕']);
      reset.addEventListener('click', () => saveKey(''));
      badge.appendChild(reset);
    } else if (balance !== null) {
      const formatted = balance.toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      badge.appendChild(createElement('span', { className: 'polza-balance-amount' }, [formatted]));
      badge.appendChild(createElement('span', { className: 'polza-balance-currency' }, ['₽']));

      const topup = createElement('a', {
        href: TOPUP_URL,
        target: '_blank',
        className: 'polza-balance-topup',
        title: 'Top up balance',
      }, ['+']);
      badge.appendChild(topup);

      const reset = createElement('button', {
        className: 'polza-balance-btn-small polza-balance-reset',
        title: 'Remove API key',
      }, ['✕']);
      reset.addEventListener('click', () => saveKey(''));
      badge.appendChild(reset);
    }
  }

  // ── Initialize ────────────────────────────────────────
  function init() {
    if ($id('polza-balance-widget')) return;

    // Find sidebar — try common Hermes WebUI selectors
    const sidebar = document.querySelector(
      '.sidebar, [class*="sidebar"], nav, [class*="nav"]'
    );
    if (!sidebar) {
      // UI might not be ready yet — retry
      setTimeout(init, 1000);
      return;
    }

    // Create widget container
    const widget = createElement('div', {
      id: 'polza-balance-widget',
      className: 'polza-balance-widget',
    });

    // Key input section
    const keySection = createElement('div', { id: 'polza-balance-key-section' });
    const label = createElement('div', { className: 'polza-balance-label' }, ['Polza.ai Balance']);
    const input = createElement('input', {
      type: 'password',
      id: 'polza-balance-key-input',
      className: 'polza-balance-input',
      placeholder: 'Enter Polza API key...',
    });
    const btn = createElement('button', {
      id: 'polza-balance-key-btn',
      className: 'polza-balance-btn',
    }, ['Save']);
    btn.addEventListener('click', () => {
      const inp = $id('polza-balance-key-input');
      if (inp) saveKey(inp.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const inp = $id('polza-balance-key-input');
        if (inp) saveKey(inp.value);
      }
    });
    keySection.appendChild(label);
    keySection.appendChild(input);
    keySection.appendChild(btn);

    // Badge
    const badge = createElement('div', { id: 'polza-balance-badge' });

    widget.appendChild(keySection);
    widget.appendChild(badge);
    sidebar.appendChild(widget);

    render();
    if (apiKey) fetchBalance();
  }

  // ── Boot ──────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
