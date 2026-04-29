---
name: e2e-testing
description: 'End-to-end testing strategy for FatS3anMusic using Playwright. Use when writing or running E2E tests for playback transitions, beforeunload suppression, replacement rules, and the playlist UI.'
---

# E2E Testing — FatS3anMusic

## When to Use
- Writing Playwright tests for any user-facing feature
- Verifying the "no beforeunload dialog" guarantee after changes
- Testing localStorage seed/replacement logic
- Running the full regression suite before a deploy

## Stack

- **Playwright** (not Cypress) — required for `dialog` event interception and iframe access
- Tests live in `tests/e2e/`
- Run via `npm run test:e2e`
- CI: runs on every PR via GitHub Actions

## Setup

```bash
npm install -D @playwright/test
npx playwright install chromium firefox
```

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Test Suites

### 1. No `beforeunload` Dialog (Critical)

```ts
// tests/e2e/no-beforeunload.spec.ts
test('no beforeunload dialog fires during song transitions', async ({ page }) => {
  let dialogFired = false;
  page.on('dialog', () => { dialogFired = true; });

  await page.goto('/');
  await page.click('[data-testid="tune-in"]'); // first-click autoplay

  // Simulate 5 song transitions via the playlist
  for (let i = 1; i <= 5; i++) {
    await page.click(`[data-testid="playlist-row-${i}"]`);
    await page.waitForTimeout(500);
  }

  expect(dialogFired).toBe(false);
});
```

### 2. Default Replacements Seeded on First Visit

```ts
// tests/e2e/replacements.spec.ts
test('default replacement rules exist on first visit', async ({ page }) => {
  await page.goto('/');

  const rules = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('fatsean_replacements') || '[]')
  );

  expect(rules).toHaveLength(2);
  expect(rules[0].matchArtist.toLowerCase()).toBe('green day');
  expect(rules[0].searchArtist.toLowerCase()).toBe('propagandhi');
  expect(rules[1].matchArtist.toLowerCase()).toBe('rancid');
});
```

### 3. Replacement Rules Not Re-Seeded After Deletion

```ts
test('deleted rules are not re-seeded on revisit', async ({ page }) => {
  await page.goto('/');

  // Delete all rules via UI
  await page.click('[data-testid="settings-btn"]');
  const deleteButtons = page.locator('[data-testid="delete-rule"]');
  const count = await deleteButtons.count();
  for (let i = 0; i < count; i++) {
    await deleteButtons.first().click();
  }
  await page.reload();

  const rules = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('fatsean_replacements') || '[]')
  );
  expect(rules).toHaveLength(0);
});
```

### 4. Live Mode Transitions

```ts
// tests/e2e/playlist.spec.ts
test('clicking playlist row enters historical mode', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="tune-in"]');

  await page.click('[data-testid="playlist-row-2"]');
  await expect(page.locator('[data-testid="return-to-live-btn"]')).toBeVisible();
  await expect(page.locator('[data-testid="live-badge"]')).not.toBeVisible();
});

test('return to live button restores live mode', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="tune-in"]');
  await page.click('[data-testid="playlist-row-2"]');
  await page.click('[data-testid="return-to-live-btn"]');

  await expect(page.locator('[data-testid="live-badge"]')).toBeVisible();
});
```

### 5. No Network Requests Indicate Full Page Reload

```ts
test('song transition does not trigger full page reload', async ({ page }) => {
  let fullPageReload = false;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) fullPageReload = true;
  });

  await page.goto('/');
  await page.click('[data-testid="tune-in"]');
  await page.click('[data-testid="playlist-row-1"]');

  expect(fullPageReload).toBe(false);
});
```

## `data-testid` Contract

All E2E-targeted elements MUST have `data-testid` attributes. Do not test by CSS class or text content.

| Attribute | Element |
|---|---|
| `tune-in` | First-visit "Click to tune in" button |
| `live-badge` | "● LIVE" indicator |
| `return-to-live-btn` | "Return to Live" button |
| `playlist-row-{n}` | nth row in playlist (1-indexed) |
| `settings-btn` | Gear/settings icon |
| `delete-rule` | Delete button on each replacement rule row |
| `add-rule-btn` | Add rule button in replacements drawer |

## CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
```

## Procedure

1. `npm install -D @playwright/test`
2. Create `playwright.config.ts` as above
3. Create `tests/e2e/` directory with the test files
4. Add `data-testid` attributes to all target components
5. Add `"test:e2e": "playwright test"` to `package.json` scripts
6. Run `npx playwright test` locally; fix failures before PR
7. Add E2E step to GitHub Actions CI workflow
