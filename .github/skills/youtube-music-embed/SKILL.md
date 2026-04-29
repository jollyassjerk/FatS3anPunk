---
name: youtube-music-embed
description: 'Embed and control YouTube Music playback silently within a SPA. Use when implementing song playback, suppressing beforeunload/navigation-guard dialogs from the YouTube IFrame, and transitioning between songs without visible reloads. This is the highest-risk skill in the FatS3anMusic app.'
---

# YouTube Music Embed

## When to Use
- Loading a YouTube video/song inside the FatS3anMusic player
- Switching songs without showing "Changes you made may not be saved" dialogs
- Suppressing any `beforeunload` event that YouTube's embed fires internally
- Ensuring autoplay works on first interaction and subsequent track changes

## The Core Problem

YouTube's IFrame embed internally uses `history.pushState` and registers `beforeunload` listeners. When you programmatically swap the `src` of an `<iframe>`, the browser's navigation model fires the guard dialog. This is the #1 UX bug to prevent.

## Solution: Never Swap `src`

**Do NOT** do this:
```js
iframeEl.src = newYouTubeUrl; // ❌ triggers beforeunload
```

**Do this instead — use the YouTube IFrame Player API to load a new video ID without destroying the iframe:**

```js
// Initialize once
const player = new YT.Player('player', {
  height: '0',
  width: '0',
  videoId: initialVideoId,
  playerVars: {
    autoplay: 1,
    controls: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    modestbranding: 1,
    rel: 0,
    origin: window.location.origin,
  },
  events: {
    onReady: onPlayerReady,
    onStateChange: onPlayerStateChange,
  },
});

// Switch songs — NO iframe reload, NO beforeunload
function playSong(videoId) {
  player.loadVideoById(videoId);
}
```

The `loadVideoById()` call replaces the playing video **within the same iframe context**, which does NOT trigger navigation guards.

## Suppressing Residual `beforeunload`

Even with the API approach, YouTube's embed occasionally registers its own `beforeunload` handler. Neutralize it:

```js
// After YT.Player is initialized, override the iframe's beforeunload
function suppressIframeBeforeUnload() {
  const iframeWindow = document.getElementById('player').contentWindow;
  try {
    iframeWindow.addEventListener('beforeunload', (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      delete e.returnValue;
    }, true); // capture phase — fires before YT's handler
  } catch {
    // cross-origin: can't access — use the postMessage approach below
  }
}
```

If cross-origin blocks direct access, use a **sandboxed proxy iframe**:
```html
<iframe
  id="player"
  sandbox="allow-scripts allow-same-origin allow-presentation"
  allow="autoplay; fullscreen"
></iframe>
```
The `sandbox` attribute prevents the embedded page from registering `beforeunload` on the top-level window.

## Autoplay Policy Handling

Browsers block autoplay until a user gesture. Strategy:
1. Show a "Click to tune in" splash on first load.
2. On click, call `player.playVideo()` — this counts as a user gesture.
3. All subsequent `loadVideoById()` calls inherit that gesture context.
4. If autoplay is blocked anyway, listen for `onStateChange` with state `-1` (unstarted) and retry `player.playVideo()` once.

```js
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.UNSTARTED) {
    setTimeout(() => player.playVideo(), 200);
  }
}
```

## Loading the IFrame API

```html
<!-- In index.html <head> -->
<script>
  window.onYouTubeIframeAPIReady = function() {
    window.__ytReady = true;
    window.dispatchEvent(new Event('yt-ready'));
  };
</script>
<script src="https://www.youtube.com/iframe_api" async></script>
```

In React, use a ref and listen for `yt-ready`:

```js
useEffect(() => {
  if (window.__ytReady) initPlayer();
  else window.addEventListener('yt-ready', initPlayer, { once: true });
  return () => player?.destroy();
}, []);
```

## Finding the YouTube Video ID

XMPlaylist sometimes provides a `youtube_id` directly. If missing, search via YouTube Data API v3:

```
GET https://www.googleapis.com/youtube/v3/search
  ?part=snippet
  &q={artist}+{title}+music.youtube.com
  &type=video
  &videoCategoryId=10
  &key={API_KEY}
```

Use the first result's `id.videoId`. Cache results in a Map keyed by `${artist}|${title}` to avoid repeat API calls.

## Procedure

1. Add `youtube-iframe-api` bootstrap to `index.html`
2. Create `hooks/useYouTubePlayer.js` — manages player lifecycle, exposes `playSong(videoId)`
3. Create `components/HiddenPlayer.jsx` — renders the zero-size iframe div
4. Implement `suppressIframeBeforeUnload()` in player init
5. Implement autoplay recovery via `onStateChange`
6. Create `services/youtubeSearch.js` — looks up video ID by artist+title with local cache
7. Test song transitions: confirm zero browser dialogs on swap
