# Polza WebUI Extensions — Polza.ai Balance Widget

**English** · [**Русский**](README.md)

Floating widget for [Hermes WebUI](https://github.com/nesquena/hermes-webui) that shows your Polza.ai account balance. Click the balance to see today's spending breakdown by model with input/output token counts.

## Features

| | |
|---|---|
| 💰 | Current balance — auto-refresh (configurable, default 60s) |
| 📊 | Click → daily stats: spend, generation count, tokens (in / out) |
| 🏆 | Top-5 models by today's cost |
| 🔄 | Paginated history — all today's generations summed |
| 🔑 | Change API key via right-click / long-press on balance |
| 🌗 | Auto-detects dark / light WebUI theme |

## Repository Structure

```
├── README.md            ← this file (English)
├── README.ru.md         ← Russian version
├── extensions/
│   └── polza-balance/
│       ├── manifest.json      ← WebUI extension manifest
│       ├── polza-balance.js   ← widget: logic, layout, theme (single file)
│       └── polza-balance.css  ← styles
```

One JS file — no external CSS, no npm, no build step. Styles are inlined via JS to skip an extra HTTP request.

## Installation

### Via gallery (recommended)

Open **Settings → Extensions** in Hermes WebUI, find **Polza.ai Balance**, click **Install**. Refresh the page (Ctrl+Shift+R).

### Manual

Add to WebUI `.env`:

```bash
HERMES_WEBUI_CSP_CONNECT_EXTRA=https://polza.ai
HERMES_WEBUI_EXTENSION_SCRIPT_URLS=/extensions/polza-balance/polza-balance.js
HERMES_WEBUI_EXTENSION_STYLESHEET_URLS=/extensions/polza-balance/polza-balance.css
```

Copy the `extensions/polza-balance/` folder to your WebUI extension directory:

```bash
cp -r extensions/polza-balance/ ~/.hermes/webui/extensions/polza-balance/
```

Restart WebUI and hard-reload the browser (Ctrl+Shift+R).

## Usage

| Action | Result |
|--------|--------|
| **Click** on balance | Toggle daily stats popup |
| **Right-click / long-press** on balance | Change API key and refresh interval |
| **🔑 Polza** button (first run) | Enter API key |

API key is stored in browser `localStorage` — persists across sessions.

### Popup example

```
Today — 63.75 ₽
383 gen · 8.2K in / 4.3K out
────────────────────────────
DeepSeek V4 Flash   63.75 ₽
                    8.2K/4.3K
```

## Architecture

```
Browser                    Hermes WebUI /extensions/     Polza.ai API
  │                              │                         │
  │  load page with              │                         │
  │  <script src="/extensions/   │                         │
  │  polza-balance.js">          │                         │
  │ ────────────────────────────→│                         │
  │ ← JS file + cookie ─────────│                         │
  │                              │                         │
  │  fetch('https://polza.ai/    │                         │
  │  api/v1/balance')            │                         │
  │ ──────────────────────────────────────────────────────→│
  │ ← JSON ───────────────────────────────────────────────│
  │                              │                         │
  │  render floating widget      │                         │
```

The extension JS talks directly to Polza.ai API — WebUI only serves the file and adds the CSP exception.

**CSP:** `HERMES_WEBUI_CSP_CONNECT_EXTRA=https://polza.ai` permits the browser to `fetch()` the Polza API. Without it the browser blocks the request.

## Adding to WebUI Gallery

Hermes WebUI has a built-in extension gallery at **Settings → Extensions**.
The gallery reads from `https://hermes-webui.github.io/hermes-webui-extensions/registry.json`,
published from [`github.com/hermes-webui/hermes-webui-extensions`](https://github.com/hermes-webui/hermes-webui-extensions).

To submit this extension:

1. **Fork** `hermes-webui/hermes-webui-extensions`
2. **Create an extension directory** with the following structure:

```
extensions/polza-balance/
├── manifest.json          ← extension metadata (scripts, styles, permissions)
├── polza-balance.js       ← widget code
├── polza-balance.css      ← styles
├── preview.png            ← 800×600 screenshot of the extension in action
└── README.md              ← documentation
```

3. **Update `extensions.toml`** (or the registry config) to register the extension
4. **Open a PR** — a GitHub Action generates `registry.json` and publishes it automatically on merge

The `manifest.json` for this extension:

```json
{
  "id": "polza-balance",
  "name": "Polza.ai Balance",
  "version": "1.0.0",
  "author": "akrhin",
  "description": "Floating widget showing Polza.ai account balance and daily spending breakdown by model with input/output token counts.",
  "scripts": ["polza-balance.js"],
  "stylesheets": ["polza-balance.css"],
  "csp_connect_extra": "https://polza.ai"
}
```

The `csp_connect_extra` field tells the gallery that installing this extension
requires adding `https://polza.ai` to `HERMES_WEBUI_CSP_CONNECT_EXTRA` — the
WebUI will prompt the user during installation.

## Adapting for Another Provider

This extension is a **ready-made template** for any provider with a REST API balance endpoint.

### Minimal changes

1. Fork this repo or copy `polza-balance.js`
2. Replace the API URLs and response field names
3. Change `HERMES_WEBUI_CSP_CONNECT_EXTRA` to your provider's origin
4. Deploy and restart

### Template variables

| Variable | Location in `polza-balance.js` | What to change |
|----------|-------------------------------|----------------|
| `BALANCE_URL` | line ~11 | Provider balance endpoint |
| `HISTORY_URL` | line ~12 | Provider history endpoint |
| Response field | `fetchBalance()` | `d.amount` → your provider's balance field |
| Cost field | `fetchTodayCost()` | `item.cost` → your provider's cost field |
| Token fields | `fetchTodayCost()` | `item.usage.prompt_tokens` → your provider's token fields |
| CSP origin | `.env` | `https://polza.ai` → your provider's API origin |

### Response structures of common providers

<details>
<summary>DeepSeek</summary>

```javascript
// GET https://api.deepseek.com/user/balance
// { "balance": "9.28", "is_available": true }
balance = parseFloat(d.balance);

// CSP: https://api.deepseek.com
```

</details>

<details>
<summary>OpenAI</summary>

```javascript
// GET https://api.openai.com/v1/dashboard/billing/credit_grants
// { "total_remaining": 12.58, ... }
balance = d.total_remaining;

// CSP: https://api.openai.com
```

</details>

<details>
<summary>Anthropic</summary>

```javascript
// GET https://api.anthropic.com/v1/organizations/{org_id}/billing
// { "credits_remaining": 25.00 }
balance = d.credits_remaining;

// CSP: https://api.anthropic.com
```

</details>

### Checklist

- [ ] Balance URL updated
- [ ] History URL updated (or removed if not available)
- [ ] Response field names updated
- [ ] CSP origin added to `.env`
- [ ] Extension ID changed (to avoid conflicts)
- [ ] WebUI restarted, browser hard-reloaded

## FAQ

**Q:** Why `localStorage` for the API key?
**A:** The key should never leave the browser. No server-side storage, no cookie that leaks to WebUI. Simple and secure enough for self-hosted.

**Q:** Why does the popup show 0 generations?
**A:** The API key in the browser doesn't match the one used for generation. Right-click the balance and enter the correct key.

**Q:** How to change the refresh interval?
**A:** Right-click the balance → second prompt asks for seconds (default 60, max 3600).

**Q:** How to uninstall?
**A:** Remove from gallery (Settings → Extensions) or delete the files from `HERMES_WEBUI_EXTENSION_DIR` and remove CSP var from `.env`. Restart WebUI.

---

## License

MIT. Lives in [github.com/akrhin/polza-webui-extensions](https://github.com/akrhin/polza-webui-extensions).
