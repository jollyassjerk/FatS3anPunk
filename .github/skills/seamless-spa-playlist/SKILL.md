---
name: seamless-spa-playlist
description: 'State machine and UX patterns for the FatS3anMusic faux playlist. Use when implementing live-to-history navigation, the 50-song playlist, back/forward controls, return-to-live, and preventing any visible page reload or postback during song transitions.'
---

# Seamless SPA Playlist

## When to Use
- Building the playlist UI and navigation controls
- Implementing live vs. historical playback modes
- Managing browser history so back/forward buttons don't break the app
- Ensuring zero visible reloads between song changes

## State Machine

The app has exactly two modes:

```
LIVE ──── user clicks history song ───► HISTORICAL
  ▲                                          │
  └──────── user clicks "Return to Live" ────┘
```

State shape (in a React context or Zustand store):

```ts
type PlayerState = {
  mode: 'live' | 'historical';
  currentSong: Song | null;
  history: Song[];          // last 50, newest first
  historicalIndex: number;  // index in history[] when mode === 'historical'
  isLoading: boolean;
};

type Song = {
  title: string;
  artist: string;
  startTime: string;        // ISO 8601
  youtubeVideoId: string;
  artworkUrl?: string;
};
```

## Transitions

### Live → Historical
```js
function playSongFromHistory(index) {
  dispatch({ type: 'PLAY_HISTORICAL', index });
  player.playSong(history[index].youtubeVideoId);
  // Do NOT use window.location or router.push — no URL change needed
}
```

### Historical → Previous / Next
```js
function prev() {
  if (historicalIndex < history.length - 1) {
    dispatch({ type: 'PLAY_HISTORICAL', index: historicalIndex + 1 });
  }
}
function next() {
  if (historicalIndex > 0) {
    dispatch({ type: 'PLAY_HISTORICAL', index: historicalIndex - 1 });
  } else {
    returnToLive();
  }
}
```

### Return to Live
```js
function returnToLive() {
  dispatch({ type: 'SET_LIVE' });
  // Player will pick up next SSE event automatically
  // Or immediately load history[0] if SSE hasn't fired yet
  player.playSong(history[0].youtubeVideoId);
}
```

## Preventing Visible Reloads

- **Never** use `<a href>`, `router.push()`, or `window.location` for song changes — these trigger navigation.
- All transitions are **pure state updates** + `player.loadVideoById()` calls.
- Use `React.startTransition` or `useTransition` to batch state updates during song switches to prevent flash-of-empty.

## Receiving Live Updates (SSE)

```js
useEffect(() => {
  const es = new EventSource('/api/live');
  es.addEventListener('now_playing', (e) => {
    const song = JSON.parse(e.data);
    dispatch({ type: 'NEW_LIVE_SONG', song });
    if (mode === 'live') player.playSong(song.youtubeVideoId);
  });
  return () => es.close();
}, []);
```

When a new live song arrives:
1. Prepend it to `history[]`, trimming to 50 items.
2. If `mode === 'live'`, immediately call `player.playSong()`.
3. If `mode === 'historical'`, only update history — don't interrupt playback.

## Playlist UI

```
[ ▶ NOW LIVE ] Song Title — Artist          [← LIVE]
──────────────────────────────────────────────────────
  1. [playing] Song Title — Artist     4:32 ago
  2.           Song Title — Artist    11:07 ago
  3.           Song Title — Artist    18:45 ago
  ...
 50.           Song Title — Artist   2h 34m ago
```

- Clicking any row calls `playSongFromHistory(index)`.
- Currently-playing row has a visual "now playing" indicator (animated bars).
- "NOW LIVE" button pulses to indicate live mode; disabled/ghost when already live.
- Times shown as relative (e.g., "4 min ago") via a 1-minute interval ticker.

## No Postback Guarantee

Checklist before each PR:
- [ ] Song change does NOT cause `window.location` change
- [ ] Song change does NOT unmount/remount the `<HiddenPlayer>` component
- [ ] Browser DevTools Network tab shows zero full-page requests on song switch
- [ ] `beforeunload` fires 0 times during a 5-song transition test

## Procedure

1. Create `store/playerStore.js` (Zustand) with the state shape above
2. Create `hooks/useLiveStream.js` — manages SSE connection, dispatches to store
3. Create `components/Playlist.jsx` — renders 50-song list, handles clicks
4. Create `components/PlayerControls.jsx` — prev/next/live buttons
5. Create `components/NowPlaying.jsx` — hero display for current song
6. Wire `player.playSong()` into store actions via a ref passed through context
