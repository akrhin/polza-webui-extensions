# Development Plan — Polza WebUI Extensions

## Repository Structure

```
polza-webui-extensions/
├── extensions/
│   ├── manifest.json              # Root manifest (all extensions)
│   └── polza-balance/             # Balance widget
│       ├── manifest.json          # Per-extension manifest
│       ├── polza-balance.js       # Extension JS
│       └── polza-balance.css      # Extension styles
├── docs/
│   ├── DEVELOPMENT.md             # This file
│   └── assets/                    # Flag icons for README
├── README.md                      # English
├── README_RU.md                   # Russian
├── .gitignore                     # Plans excluded
└── pyproject.toml                 # (future) build/publish tooling
```

## Development Plan

### Phase 1 — polza-balance widget ✅ (current)

- [x] Repository created (`akrhin/polza-webui-extensions`)
- [x] manifest.json with extension definition
- [x] Balance widget JS (fetch → display)
- [x] Balance widget CSS (dark theme, sidebar integration)
- [x] README / README_RU with installation guide
- [x] .gitignore (plans excluded)
- [ ] **Install and test locally**

### Phase 2 — Testing & polish

- [ ] Install on local Hermes WebUI
- [ ] Test with real Polza API key
- [ ] Fix sidebar detection for different WebUI themes
- [ ] Add auto-refresh interval (every 30s?)
- [ ] Add error states: network, invalid key, expired

### Phase 3 — Extended features

- [ ] **Usage stats widget**: show `GET /v1/history/generations` summary
- [ ] **Model usage breakdown**: cost per model / per day
- [ ] **Provider selection widget**: toggle between DeepSeek/GMICloud from UI
- [ ] **Notifications**: low balance warning

### Phase 4 — Publishing

- [ ] Add to WebUI extension gallery (if supported)
- [ ] Publish as Chrome/Firefox extension? (standalone)

## How Extensions Work

Hermes WebUI extensions are **client-side only**. They inject JS/CSS into the
app shell. They cannot:

- Register backend routes
- Modify agent behaviour
- Access Hermes config or credentials

They can:

- Call any API the browser can reach (including direct Polza API)
- Store data in localStorage
- Add UI elements to the sidebar / panels
- Communicate with localhost sidecars

See [WebUI EXTENSIONS.md](https://github.com/nesquena/hermes-webui/blob/master/docs/EXTENSIONS.md)
for the full reference.

## Security Notes

- API key is stored in **browser localStorage** — never sent to any server
  except `polza.ai/api/v1/balance`
- No third-party scripts or CDN dependencies
- Extension runs in the WebUI security context — same CSP as the app
