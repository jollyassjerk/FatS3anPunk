# FatS3anPunk — Thin Edition

**Same functionality. One file. One dependency. No build step.**

```
thin/
├── server.js          ← everything: poller, SSE, history, static serve (~150 lines)
├── public/
│   └── index.html     ← full punk-rock UI in vanilla JS (~350 lines)
└── package.json       ← one dependency: express
```

## Resource Footprint

| Metric | Value |
|--------|-------|
| Dependencies | 1 (`express`) |
| Build step | None |
| Node.js RAM (idle) | ~35–45 MB |
| Node.js RAM (active) | ~50–70 MB |
| CPU (idle between polls) | ~0% |
| Startup time | <1s |

Works on Raspberry Pi Zero 2 W, cheap VPS, Docker, bare metal — anything with Node 18+.

## Quick Start

```bash
cd thin
npm install   # installs express only
node server.js
# → http://localhost:3000
```

## Configuration

All config is via environment variables — no config files needed:

```bash
# Pick your station (from xmplaylist.com)
XMPLAYLIST_STATION=factionpunk node server.js

# Custom port
PORT=8080 node server.js

# Adjust polling interval (default 30s)
POLL_INTERVAL_MS=60000 node server.js
```

## Features

- ✅ Live now-playing via SSE (Server-Sent Events)
- ✅ 10-song history on load, up to 50 in memory
- ✅ YouTube playback via hidden IFrame (no API key required)
- ✅ Trailing live: historical songs auto-advance through the playlist
- ✅ Return-to-live button
- ✅ Prev/Next controls
- ✅ Band replacement rules (stored in localStorage)
- ✅ Punk-rock UI (Black Ops One, electric yellow, dark theme)
- ✅ Exponential backoff on API errors
- ✅ Heartbeat keeps SSE alive through proxies

## Keep It Running (Raspberry Pi)

```bash
# Option A: pm2
npm install -g pm2
XMPLAYLIST_STATION=factionpunk pm2 start server.js --name fats3anpunk
pm2 save && pm2 startup

# Option B: nohup (dead simple)
XMPLAYLIST_STATION=factionpunk nohup node server.js > punk.log 2>&1 &

# Option C: screen
screen -dmS punk bash -c 'XMPLAYLIST_STATION=factionpunk node server.js'
```

## What Was Cut vs Full Version

| Feature | Full | Thin |
|---------|------|------|
| TypeScript | ✅ | ❌ (plain JS) |
| React + Zustand | ✅ | ❌ (vanilla JS) |
| Vite build | ✅ | ❌ (no build) |
| Playwright tests | ✅ | ❌ |
| GitHub Actions CI | ✅ | ❌ |
| Docker | ✅ | ❌ |
| Monorepo | ✅ | ❌ (single file) |
| Dependencies | ~70+ | 1 |
| RAM | ~120-200 MB | ~40-70 MB |
| **Same UX** | ✅ | ✅ |
