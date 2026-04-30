# FatS3anPunk

A live punk-rock radio companion for [xmplaylist.com](https://xmplaylist.com) stations. Shows what's playing now, streams it via YouTube Music, and lets you swap out bands you're sick of with ones you actually like.

**One file. One dependency. No build step.**

```
├── server.js        ← poller, SSE, history API, YouTube Music resolver
├── public/
│   └── index.html   ← full punk-rock UI in vanilla JS
└── package.json     ← one dependency: express
```

## Features

- Live now-playing via SSE (Server-Sent Events), polled from xmplaylist.com
- 10-song history on load, up to 50 in memory
- Embedded YouTube Music player — no API key required
- Auto-advances to the next song when the current one ends
- Band replacement rules — swap Green Day → Propagandhi, stored in `localStorage`
- Semicolon-separated multi-band `To` field (e.g. `Propagandhi; Lagwagon; NOFX`)
- Random substitution: searches YouTube Music with multiple query variants, picks from a pool of up to 40 results so you hear different songs each time
- Video title updates live once the substituted track starts playing
- Prev/Next controls + return-to-live button
- Punk-rock UI: Black Ops One font, electric yellow on black, red accents
- Exponential backoff on API errors, SSE heartbeat for proxy compatibility

## Resource Footprint

| Metric | Value |
|--------|-------|
| Dependencies | 1 (`express`) |
| Build step | None |
| Node.js RAM (idle) | ~35–45 MB |
| Node.js RAM (active) | ~50–70 MB |
| CPU (idle) | ~0% |
| Startup time | <1s |

Runs on a Raspberry Pi Zero 2 W, cheap VPS, or any machine with Node 18+.

## Ubuntu Quickstart

```bash
# 1. Install Node.js 20 LTS (skip if already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Clone and install
git clone https://github.com/jollyassjerk/FatS3anPunk.git
cd FatS3anPunk
npm install

# 3. Run
node server.js
# → http://localhost:3000

# Run a different station
XMPLAYLIST_STATION=somestationslug node server.js
```

### Keep It Running (systemd — recommended)

```bash
# Create a service file
sudo tee /etc/systemd/system/fats3anpunk.service > /dev/null <<EOF
[Unit]
Description=FatS3anPunk
After=network.target

[Service]
WorkingDirectory=/home/$USER/FatS3anPunk
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=XMPLAYLIST_STATION=greendaysidiotnation
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now fats3anpunk
sudo systemctl status fats3anpunk
```

### Keep It Running (pm2)

```bash
npm install -g pm2
XMPLAYLIST_STATION=greendaysidiotnation pm2 start server.js --name fats3anpunk
pm2 save && pm2 startup
```

### Keep It Running (nohup)

```bash
XMPLAYLIST_STATION=greendaysidiotnation nohup node server.js > punk.log 2>&1 &
```

## Configuration

All config via environment variables — no config files needed:

| Variable | Default | Description |
|---|---|---|
| `XMPLAYLIST_STATION` | *(required)* | Station slug from xmplaylist.com |
| `PORT` | `3000` | HTTP port to listen on |
| `POLL_INTERVAL_MS` | `30000` | How often to poll xmplaylist (ms) |

## Finding Station Slugs

Go to [xmplaylist.com](https://xmplaylist.com), pick a station, and copy the slug from the URL:
```
https://xmplaylist.com/station/greendaysidiotnation
                                ^^^^^^^^^^^^^^^^^^  ← this is XMPLAYLIST_STATION
```
