# Polza WebUI Extensions

[![English version](docs/assets/en-flag.svg)](README.md)

> WebUI extensions for [Hermes WebUI](https://github.com/nesquena/hermes-webui) — 
> Polza.ai balance widget, usage stats, and more.

---

## Extensions

| Extension | Description | Status |
|-----------|-------------|--------|
| **polza-balance** | Polza.ai account balance widget | ✅ Available |
| *(more coming)* | | 🚧 |

### polza-balance

Shows your current Polza.ai balance directly in the Hermes WebUI sidebar.

**Features:**
- Real-time balance display (RUB)
- API key management (stored locally in browser)
- One-click link to top-up page
- Auto-refresh on page load
- Privacy-first: key never leaves your browser

**Installation:**

1. Copy `extensions/polza-balance/` to your WebUI extension directory:

```bash
# Option A — symlink (recommended, auto-updates on git pull)
mkdir -p ~/.hermes/webui/extensions
ln -sf "$(pwd)/extensions/polza-balance" ~/.hermes/webui/extensions/polza-balance

# Option B — copy
cp -r extensions/polza-balance ~/.hermes/webui/extensions/
```

2. Set environment variable for WebUI (if using custom dir):

```bash
# Add to WebUI .env or launch script:
export HERMES_WEBUI_EXTENSION_DIR="$HOME/.hermes/webui/extensions"
export HERMES_WEBUI_EXTENSION_MANIFEST="$HOME/.hermes/webui/extensions/manifest.json"
```

3. Restart WebUI:

```bash
cd ~/git/hermes-webui && ./ctl.sh restart
```

4. Navigate to **Settings → Extensions** in WebUI, find **polza-balance** and enable it.

5. Enter your Polza.ai API key in the widget. The key is stored in your browser's localStorage and never sent anywhere except directly to `polza.ai/api/v1/balance`.

---

## Development

### Structure

```
extensions/polza-balance/
├── manifest.json        # Extension manifest (scripts, stylesheets)
├── polza-balance.js     # Main extension JavaScript
└── polza-balance.css    # Widget styles

docs/
└── DEVELOPMENT.md       # Development guide and plan
```

### Adding a new extension

1. Create `extensions/<name>/` directory
2. Add `manifest.json`, `<name>.js`, `<name>.css`
3. Update root `manifest.json` to include it
4. Document in README

See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the roadmap.
