/**
 * FatS3anPunk — Thin Edition
 * One file. One dependency. Zero build step.
 * Node 18+ required (uses built-in fetch).
 *
 * Usage:
 *   XMPLAYLIST_STATION=factionpunk node server.js
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STATION    = process.env.XMPLAYLIST_STATION  || 'greendaysidiotnation';
const POLL_MS    = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10);
const PORT       = parseInt(process.env.PORT         || '3000', 10);
const MAX_HIST   = 50;
const BOOT_SONGS = 10;
const videoSearchCache = new Map();

// ─── In-memory state ─────────────────────────────────────────────────────────

let history   = [];   // newest first
let lastSong  = null;
const clients = new Set();

// ─── Song normaliser (handles both xmplaylist schema versions) ────────────────

function extractVideoId(entry) {
  if (entry.youtube_id) return entry.youtube_id;
  if (Array.isArray(entry.links)) {
    const yt = entry.links.find(l => l.site === 'youtube' || l.site === 'youtubeMusic');
    if (yt?.url) {
      try {
        const u = new URL(yt.url);
        return u.searchParams.get('v') || u.pathname.split('/').pop() || undefined;
      } catch { /* skip */ }
    }
  }
  return undefined;
}

function normalise(entry) {
  const track   = entry.track || {};
  const title   = track.title || track.name || 'Unknown';
  const artists = Array.isArray(track.artists) ? track.artists : [];
  const artist  = artists[0]?.name || (typeof artists[0] === 'string' ? artists[0] : 'Unknown');
  const playedAt = entry.timestamp || entry.start_time || new Date().toISOString();
  const videoId  = extractVideoId(entry);
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title, artist, playedAt, videoId };
}

function isSameSong(a, b) {
  return a && b && a.title === b.title && a.artist === b.artist;
}

async function fetchYouTubeMusicIds(query, headers) {
  // Try the YouTube Music internal search API first — it returns JSON with video IDs.
  try {
    const apiRes = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'X-Youtube-Client-Name': '67',
        'X-Youtube-Client-Version': '1.20240101.01.00',
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/',
      },
      body: JSON.stringify({
        query,
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240101.01.00',
            hl: 'en',
          },
        },
        params: 'EgWKAQIIAWoKEAMQBBAJEAoQBQ%3D%3D', // filter: songs
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (apiRes.ok) {
      const json = await apiRes.json();
      const text = JSON.stringify(json);
      const ids = Array.from(text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map(m => m[1]);
      if (ids.length) return ids;
    }
  } catch { /* fall through to HTML scrape */ }

  // Fallback: scrape the HTML search page.
  const q = encodeURIComponent(query);
  const url = `https://music.youtube.com/search?q=${q}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const html = await res.text();
  return Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map(m => m[1]);
}

async function fetchYouTubeWebIds(query, headers) {
  const q = encodeURIComponent(query);
  const url = `https://www.youtube.com/results?search_query=${q}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const html = await res.text();
  return Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map(m => m[1]);
}

async function resolveVideoIdByArtist(artist, title = '') {
  const artistKey = String(artist || '').trim().toLowerCase();
  const titleKey = String(title || '').trim().toLowerCase();
  if (!artistKey) return null;

  const key = `${artistKey}|${titleKey}`;

  const cached = videoSearchCache.get(key);
  if (cached && Array.isArray(cached.videoIds) && cached.videoIds.length && Date.now() - cached.ts < 6 * 60 * 60 * 1000) {
    return cached.videoIds[Math.floor(Math.random() * cached.videoIds.length)];
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  const allIds = [];
  const exactQuery = titleKey ? `${artist} ${title}` : artist;
  try {
    allIds.push(...await fetchYouTubeMusicIds(exactQuery, headers));
  } catch {
    // Try fallback sources below.
  }

  // music.youtube.com often omits inline video IDs; fallback to youtube.com HTML.
  if (!allIds.length) {
    try {
      allIds.push(...await fetchYouTubeWebIds(exactQuery, headers));
    } catch {
      // Try fallback query below.
    }
  }

  // If artist+title has no hits, fall back to artist-only.
  if (!allIds.length && titleKey) {
    try {
      allIds.push(...await fetchYouTubeMusicIds(artist, headers));
    } catch {
      // Continue to web fallback below.
    }
    if (!allIds.length) {
      try {
        allIds.push(...await fetchYouTubeWebIds(artist, headers));
      } catch {
        // Return null below.
      }
    }
  }

  const uniq = [...new Set(allIds)].slice(0, 40);
  if (!uniq.length) return null;

  videoSearchCache.set(key, { videoIds: uniq, ts: Date.now() });
  const videoId = uniq[Math.floor(Math.random() * uniq.length)];
  return videoId;
}

// ─── SSE broadcast ───────────────────────────────────────────────────────────

function broadcast(obj) {
  const msg = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of clients) {
    try { res.write(msg); } catch { clients.delete(res); }
  }
}

// ─── Poller ──────────────────────────────────────────────────────────────────

async function fetchStation() {
  const res = await fetch(`https://xmplaylist.com/api/station/${STATION}`, {
    headers: { 'User-Agent': 'FatS3anPunk/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

let backoffMs = POLL_MS;

async function poll() {
  try {
    const data    = await fetchStation();
    const entries = data.most_recent ?? data.results ?? [];
    if (!entries.length) return;

    const song = normalise(entries[0]);
    if (!isSameSong(lastSong, song)) {
      song.id  = `${Date.now()}-${Math.random().toString(36).slice(2)}`; // unique per play
      lastSong = song;
      history  = [song, ...history].slice(0, MAX_HIST);
      broadcast({ type: 'now_playing', song });
      console.log(`[poller] ▶ ${song.artist} — ${song.title}`);
    }
    backoffMs = POLL_MS; // reset backoff on success
  } catch (err) {
    backoffMs = Math.min(backoffMs * 2, 300_000);
    console.warn(`[poller] Error (retry in ${backoffMs / 1000}s):`, err.message);
    return new Promise(r => setTimeout(r, backoffMs));
  }
}

async function bootstrap() {
  try {
    const data    = await fetchStation();
    const entries = (data.most_recent ?? data.results ?? []).slice(0, BOOT_SONGS);
    history  = entries.map(normalise);
    lastSong = history[0] ?? null;
    console.log(`[server] Bootstrapped ${history.length} songs from "${STATION}"`);
  } catch (err) {
    console.warn('[server] Bootstrap failed:', err.message);
  }
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();

// SSE — live updates
app.get('/api/live', (req, res) => {
  res.writeHead(200, {
    'Content-Type' : 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection'   : 'keep-alive',
    'X-Accel-Buffering': 'no',   // tell nginx not to buffer SSE
  });
  res.write(': connected\n\n');
  clients.add(res);

  // Send current song immediately so the page isn't blank
  if (lastSong) res.write(`data: ${JSON.stringify({ type: 'now_playing', song: lastSong })}\n\n`);

  // Heartbeat every 25s to keep connection alive through proxies
  const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch { /* ignore */ } }, 25_000);

  req.on('close', () => { clients.delete(res); clearInterval(hb); });
});

// History — bootstrap for the browser
app.get('/api/history', (_req, res) => {
  res.json({ songs: history });
});

// Resolve a playable videoId by artist for replacement fallback.
app.get('/api/resolve-video', async (req, res) => {
  try {
    const artist = String(req.query.artist || '').trim();
    const title = String(req.query.title || '').trim();
    if (!artist) return res.status(400).json({ error: 'artist query param required' });

    const videoId = await resolveVideoIdByArtist(artist, title);
    if (!videoId) return res.status(404).json({ error: 'no video found' });

    res.json({ artist, title, videoId });
  } catch (err) {
    res.status(502).json({ error: 'resolve failed', detail: err.message });
  }
});

// Everything else → single-page UI
app.use(express.static(join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));

// ─── Start ───────────────────────────────────────────────────────────────────

await bootstrap();
const pollTimer = setInterval(poll, POLL_MS + Math.random() * 5_000);
pollTimer.unref(); // don't keep process alive just for polling

app.listen(PORT, () => {
  console.log(`[FatS3anPunk] http://localhost:${PORT}  station=${STATION}`);
});
