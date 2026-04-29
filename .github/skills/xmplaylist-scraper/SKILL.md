---
name: xmplaylist-scraper
description: 'Polling strategy and parsing logic for xmplaylist.com now-playing data. Use when building or modifying the backend service that monitors https://xmplaylist.com/station/factionpunk and detects song changes.'
---

# XMPlaylist Scraper

## When to Use
- Building the polling service that fetches current song from xmplaylist.com
- Handling rate limits or detecting song changes
- Parsing station JSON to extract track + artist metadata

## Architecture

The scraper is a **server-side polling service** (Node.js/Cloudflare Worker/Vercel Edge Function). It must NOT run in the browser to avoid CORS errors and to centralize caching.

```
xmplaylist.com/station/factionpunk
  └─ polled every 30s by server
       └─ diffed against last known track
            └─ if changed → push to clients via SSE or WebSocket
```

## Polling Strategy

- **Interval**: 30 seconds. XM updates their "now playing" approximately every 3–5 minutes; 30s gives good freshness without hammering.
- **Jitter**: Add ±5s random jitter to avoid thundering herd if multiple instances run.
- **Backoff**: On HTTP 429 or 503, exponential backoff: 30s → 60s → 120s → 300s cap.
- **Caching**: Cache last known song server-side. Only broadcast to clients on a change.

## Parsing

XMPlaylist exposes a JSON API (not just HTML). The endpoint for Faction Punk is:

```
GET https://xmplaylist.com/api/station/factionpunk
```

Response shape (as of 2026):
```json
{
  "station": { "id": "factionpunk", "name": "Faction Punk" },
  "most_recent": [
    {
      "track": {
        "name": "Song Title",
        "artists": [{ "name": "Band Name" }],
        "album": "Album Name"
      },
      "start_time": "2026-04-21T14:32:00Z",
      "spotify_id": "...",
      "youtube_id": "..."
    }
  ]
}
```

Extract: `most_recent[0].track.name`, `most_recent[0].track.artists[0].name`, `most_recent[0].start_time`.

**Also fetch up to 50 items** from `most_recent` to seed the playlist history on page load.

## Change Detection

```js
function hasChanged(prev, next) {
  return prev?.track?.name !== next?.track?.name ||
         prev?.track?.artists?.[0]?.name !== next?.track?.artists?.[0]?.name;
}
```

## Server-Sent Events (SSE) Push

Expose an SSE endpoint `/api/live` that clients connect to. When a new song is detected, push:

```json
{ "type": "now_playing", "track": { "title": "...", "artist": "...", "startTime": "..." } }
```

Also push a heartbeat every 25s to keep connections alive through proxies:
```
: heartbeat\n\n
```

## Rate Limit Headers to Watch

| Header | Meaning |
|---|---|
| `X-RateLimit-Remaining` | Requests left in window |
| `Retry-After` | Seconds to wait on 429 |

## Procedure

1. Create `services/poller.js` — fetches xmplaylist API on interval
2. Create `services/sse.js` — manages SSE connections and broadcasts
3. In poller, compare new result to cached; broadcast only on change
4. Expose `GET /api/live` (SSE) and `GET /api/history` (last 50 songs as JSON)
5. Deploy as long-running Node process or Cloudflare Durable Object
