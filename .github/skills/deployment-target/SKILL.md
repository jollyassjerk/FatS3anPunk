---
name: deployment-target
description: 'Deployment architecture for FatS3anMusic. Use when configuring hosting, CI/CD pipeline targets, environment variables, domain setup, and cache headers. Defines the split between static frontend (Vercel/Netlify) and the SSE polling server (Railway/Fly.io/Render).'
---

# Deployment Target — FatS3anMusic

## When to Use
- Configuring GitHub Actions CI/CD to deploy the app
- Setting up hosting for frontend and/or backend
- Configuring environment variables per environment
- Setting cache headers for assets
- Setting up the production domain

## Architecture Split

The app has two deployable units:

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND  (static SPA)                                  │
│  React build → Vercel (free tier)                        │
│  Domain: fatsean.music (or fats3an.com)                  │
└─────────────────────────────────────────────────────────┘
                        │
                        │ SSE /api/live
                        │ REST /api/history
                        ▼
┌─────────────────────────────────────────────────────────┐
│  BACKEND  (long-running Node process)                    │
│  Express + SSE → Railway.app (free tier viable)          │
│  Internal: api.fatsean.music  -or-  /api/* proxy         │
└─────────────────────────────────────────────────────────┘
```

**Why not serverless for backend?** SSE requires persistent connections. Vercel/Netlify serverless functions max out at 10–30s. Use Railway, Fly.io, or Render for the backend.

## Recommended Stack

| Layer | Service | Why |
|---|---|---|
| Frontend | Vercel | Zero-config React deploy, instant CDN, preview deploys on PR |
| Backend | Railway | Persistent Node process, free tier, simple env var UI |
| DNS | Cloudflare | Free, fast, proxies HTTPS |
| YouTube API key | Vercel env vars | Never in source code |

## Monorepo Structure

```
FatSeanMusic/
├── frontend/          # React app (Vite)
├── backend/           # Node/Express SSE server
├── .github/
│   └── workflows/
│       ├── ci.yml     # lint + test on every PR
│       └── deploy.yml # deploy on merge to main
└── package.json       # root workspace scripts
```

## Environment Variables

### Frontend (`frontend/.env.production`)
```
VITE_API_BASE_URL=https://api.fatsean.music
VITE_YOUTUBE_API_KEY=<from Vercel dashboard — never commit>
```

### Backend (Railway dashboard)
```
XMPLAYLIST_STATION=greendaysidiotnation
POLL_INTERVAL_MS=30000
PORT=3001
```

**Never commit `.env` files.** Add to `.gitignore`.

## GitHub Actions: CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:e2e
        env:
          CI: true
```

## GitHub Actions: Deploy Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build --workspace=frontend
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: frontend

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bervProject/railway-deploy@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
          service: fatsean-backend
```

## Cache Headers

Configure in `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
    }
  ]
}
```

## Git Commit Convention

Every revision deployed should be a tagged commit:

```
feat: add seamless playlist with 50-song history
fix: suppress beforeunload dialog on youtube embed swap
feat: seed default replacement rules on first visit
style: punk rock UI design system and branding
test: add playwright e2e suite for core flows
ci: add github actions ci/cd pipeline
```

Use conventional commits. Each logical feature = one PR = one squash commit to `main` = one deploy.

## Procedure

1. Create monorepo `package.json` with workspaces
2. Init `frontend/` with `npm create vite@latest`
3. Init `backend/` with Express + SSE server
4. Add `.github/workflows/ci.yml` and `deploy.yml`
5. Set secrets in GitHub repo: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RAILWAY_TOKEN`
6. Push to `main` and verify first deploy
7. Configure custom domain in Vercel dashboard and Cloudflare DNS
