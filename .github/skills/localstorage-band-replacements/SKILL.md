---
name: localstorage-band-replacements
description: 'localStorage schema, default seeding, and matching logic for the FatS3anMusic band replacement rules feature. Use when building the replacements UI, the rule-matching engine, or the first-visit default setup (Green Day → Propagandhi, Rancid → Propagandhi).'
---

# LocalStorage Band Replacements

## When to Use
- Building the "Replacements" settings UI
- Implementing the artist-matching rule engine that fires before YouTube search
- Seeding default rules on first visit
- Testing replacement logic

## localStorage Schema

Key: `fatsean_replacements`

Value: JSON array of replacement rules:

```ts
type ReplacementRule = {
  id: string;           // uuid, for stable React keys and deletion
  matchArtist: string;  // case-insensitive match against incoming artist name
  searchArtist: string; // artist to search YouTube for instead
  mode: 'random';       // always 'random' for now (random song by that artist)
};
```

Example stored value:
```json
[
  { "id": "default-1", "matchArtist": "Green Day", "searchArtist": "Propagandhi", "mode": "random" },
  { "id": "default-2", "matchArtist": "Rancid", "searchArtist": "Propagandhi", "mode": "random" }
]
```

## First-Visit Seeding

Run once, keyed by a separate flag so user deletions are not re-seeded:

```js
const SEEDED_KEY = 'fatsean_defaults_seeded';
const RULES_KEY = 'fatsean_replacements';

export function seedDefaultsIfNeeded() {
  if (localStorage.getItem(SEEDED_KEY)) return;

  const defaults = [
    { id: 'default-1', matchArtist: 'Green Day',  searchArtist: 'Propagandhi', mode: 'random' },
    { id: 'default-2', matchArtist: 'Rancid',     searchArtist: 'Propagandhi', mode: 'random' },
  ];

  localStorage.setItem(RULES_KEY, JSON.stringify(defaults));
  localStorage.setItem(SEEDED_KEY, '1');
}
```

Call `seedDefaultsIfNeeded()` at app startup, before first song load.

## Rule Matching Engine

```js
export function applyReplacements(artistName, rules) {
  const normalized = artistName.trim().toLowerCase();
  const match = rules.find(r => r.matchArtist.trim().toLowerCase() === normalized);
  if (!match) return { replaced: false, artist: artistName };
  return { replaced: true, artist: match.searchArtist, mode: match.mode };
}
```

Matching is **exact after normalization** (trimmed, lowercased). Do not use fuzzy matching — it causes surprising false positives. If the user wants fuzzy, they can add multiple rules.

## Integration Point

In `services/youtubeSearch.js`, before searching for a video ID:

```js
export async function resolveVideoId(artist, title) {
  const rules = loadRules();
  const { replaced, artist: resolvedArtist, mode } = applyReplacements(artist, rules);

  if (replaced && mode === 'random') {
    return searchRandomSongByArtist(resolvedArtist);
  }
  return searchExactSong(resolvedArtist, title);
}
```

`searchRandomSongByArtist` queries YouTube with just the artist name and picks a random result from the top 5.

## CRUD Helpers

```js
export function loadRules() {
  try {
    return JSON.parse(localStorage.getItem(RULES_KEY) || '[]');
  } catch { return []; }
}

export function saveRules(rules) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

export function addRule(matchArtist, searchArtist) {
  const rules = loadRules();
  rules.push({ id: crypto.randomUUID(), matchArtist, searchArtist, mode: 'random' });
  saveRules(rules);
}

export function deleteRule(id) {
  saveRules(loadRules().filter(r => r.id !== id));
}
```

## UI Spec

A slide-in drawer or modal accessible from a gear/settings icon in the app header.

```
┌─ Band Replacements ──────────────────────── [×] ─┐
│ When this artist plays:   Replace with:           │
│ [Green Day            ]   [Propagandhi     ] [×]  │
│ [Rancid               ]   [Propagandhi     ] [×]  │
│ [_____________________]   [_______________] [Add] │
│                                                    │
│ Tip: Replacements play a random song by the        │
│ replacement artist instead.                        │
└────────────────────────────────────────────────────┘
```

- Delete (×) removes the rule immediately from localStorage.
- Add validates both fields are non-empty before adding.
- Changes take effect on the **next** song change (not retroactively).

## Procedure

1. Create `services/replacements.js` — all CRUD helpers + `applyReplacements()`
2. Call `seedDefaultsIfNeeded()` in `App.jsx` on mount
3. Create `hooks/useReplacements.js` — React state synced to localStorage
4. Create `components/ReplacementsDrawer.jsx` — the settings UI
5. Wire `applyReplacements()` into `resolveVideoId()` in `youtubeSearch.js`
6. Test: add a rule for "Test Artist", verify next song with that artist plays replacement
