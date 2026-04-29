---
name: punk-rock-ui
description: 'Visual design system for FatS3anMusic. Use when building or styling any UI component — defines the punk rock aesthetic, typography, color palette, component patterns, and brand identity rules for the app.'
---

# Punk Rock UI — FatS3anMusic Design System

## When to Use
- Building any component from scratch
- Making styling decisions (colors, fonts, spacing, texture)
- Reviewing a PR for visual consistency
- Creating new branded assets

## Brand Identity

**Name**: FatS3anMusic (rendered with a stylized `3` in place of the `e`)
**Tagline**: *"The station that never shuts up."*
**Tone**: Raw, loud, a little chaotic — but the UI itself is clean and usable. Punk aesthetic ≠ unusable. Think zine-meets-dashboard.

## Color Palette

```css
:root {
  --color-bg:          #0d0d0d;   /* near-black background */
  --color-surface:     #1a1a1a;   /* card/panel surface */
  --color-surface-2:   #242424;   /* elevated surface, hover states */
  --color-border:      #333333;   /* subtle dividers */
  --color-accent:      #e8ff00;   /* electric yellow — primary accent */
  --color-accent-2:    #ff2d55;   /* hot pink/red — secondary accent, alerts */
  --color-text:        #f0f0f0;   /* primary text */
  --color-text-muted:  #888888;   /* timestamps, metadata */
  --color-live:        #ff2d55;   /* live indicator dot */
}
```

## Typography

```css
/* Headlines — distressed/stencil feel */
@import url('https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Share+Tech+Mono&display=swap');

--font-display:  'Black Ops One', 'Impact', sans-serif;    /* logo, song titles */
--font-mono:     'Share Tech Mono', 'Courier New', mono;   /* timestamps, metadata */
--font-body:     system-ui, -apple-system, sans-serif;     /* body copy */

/* Scale */
--text-xs:   0.75rem;
--text-sm:   0.875rem;
--text-base: 1rem;
--text-lg:   1.25rem;
--text-xl:   1.5rem;
--text-2xl:  2rem;
--text-3xl:  3rem;
```

## Texture & Effects

- **Background noise**: Apply a subtle grain texture via SVG filter or CSS `backdrop-filter` on the body. Keep opacity at 3–6% — barely visible but adds grit.
- **Scanlines**: Optional CSS scanline overlay on the player area (`repeating-linear-gradient` with 2px black stripes at 10% opacity).
- **Accent glows**: Use `box-shadow: 0 0 12px var(--color-accent)` sparingly on active/live elements.
- **Borders**: Prefer `1px solid var(--color-border)` with occasional `2px solid var(--color-accent)` for selected states.

```css
/* Grain texture utility */
.grain::after {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* SVG noise */
  opacity: 0.04;
  pointer-events: none;
  z-index: 9999;
}
```

## Component Patterns

### Logo / Header
```
FatS3anMusic                          [⚙ Replacements]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
- Logo uses `--font-display` at `--text-2xl`
- The `3` in "S3an" rendered in `--color-accent`
- Full-width accent-colored `border-bottom` under header

### Now Playing Hero
```
● LIVE                                        [Historical]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PROPAGANDHI                         ▶ 2:34 / 3:58
  Potemkin City Limits
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
- Song title in `--font-display`, artist in `--font-mono` uppercase
- "● LIVE" badge: `--color-live` dot with CSS pulse animation
- Background: faint album art blurred + darkened as backdrop

### Playlist Row
```
▶  Potemkin City Limits   PROPAGANDHI   just now
   Last Ride In           NOFX          8 min ago
   ...
```
- Playing row: `--color-accent` left border `3px`, slightly brighter background
- Hover: `--color-surface-2` background, cursor pointer
- Timestamp: `--font-mono` `--text-xs` `--color-text-muted`
- No zebra stripes — use hover + active state only

### Buttons
```css
.btn-primary {
  background: var(--color-accent);
  color: #000;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.5rem 1.25rem;
  border: none;
  cursor: pointer;
}
.btn-primary:hover { filter: brightness(1.15); }

.btn-ghost {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}
```

### Live Pulse Animation
```css
@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
.live-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--color-live);
  animation: livePulse 1.5s ease-in-out infinite;
}
```

## Responsive Layout

- Mobile-first. Single column stack: Header → NowPlaying hero → Playlist.
- At `768px+`: Side-by-side: playlist (300px fixed) | now-playing (flex grow).
- No horizontal scroll. Playlist rows truncate with `text-overflow: ellipsis`.

## Accessibility

- Maintain WCAG AA contrast. `--color-accent` (#e8ff00) on `--color-bg` (#0d0d0d) passes AA large text.
- All interactive elements must have `:focus-visible` styles using `outline: 2px solid var(--color-accent)`.
- Playlist rows are `<button>` elements or `role="listitem"` with `tabindex="0"` + keyboard handlers.

## Procedure

1. Create `styles/design-tokens.css` with all CSS custom properties above
2. Create `styles/global.css` — reset, body background, font loading, grain texture
3. Create `styles/components/` — one CSS module per component
4. Import design tokens at the root of every component stylesheet
5. Review each component against this spec before PR
