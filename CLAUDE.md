# CAT FTX-1 — Claude Code Context

## What this project is
Browser-based CAT controller for the Yaesu FTX-1 transceiver. The app runs as a fully static SPA (Nuxt 3 + Vue 3) served from an nginx Docker container hosted on Azure App Service. Serial communication uses the **browser-native Web Serial API** — no backend process required.

## Architecture (v2.0)
- **Frontend**: Nuxt 3 (`ssr: false`), `nuxt generate` → static files in `.output/public`
- **Serial**: `composables/useSerial.ts` — singleton state via `shallowRef`, connects via `navigator.serial.requestPort()`, reads a continuous stream split on `;`, parses all CAT responses
- **Container**: multi-stage Docker build (node:22-alpine builder → nginx:1.27-alpine); nginx serves SPA with fallback to `index.html`
- **Hosting**: Azure App Service (Linux container, B1 SKU), image pulled from Azure Container Registry (Basic SKU)
- **CI/CD**: `.github/workflows/azure-deploy.yml` — triggers on push to `main`; authenticates via OIDC (no stored passwords); builds & pushes image tagged `:sha` + `:latest`; deploys `:sha` tag to Web App

## Infrastructure status

Azure infrastructure is provisioned. CI/CD is live — pushes to `main` trigger automatic build and deploy via GitHub Actions.

## Key files
| File | Purpose |
|------|---------|
| `composables/useSerial.ts` | All Web Serial logic + CAT protocol parsing |
| `pages/index.vue` | Main UI — uses `useSerial()` composable |
| `components/PresetButton.vue` | Preset execution via `sendPreset()` |
| `cat-presets.json` | Preset command definitions |
| `nuxt.config.ts` | Minimal config — SSR off, devtools off |
| `Dockerfile` | Multi-stage build |
| `nginx.conf` | SPA fallback, gzip, asset caching, `/health` endpoint |
| `infra/main.bicep` | Azure IaC — ACR + App Service Plan + Web App |
| `infra/setup.sh` | One-time provisioning script |
| `.github/workflows/azure-deploy.yml` | CI/CD pipeline |

## GSD workflow

This project uses GSD for planning and execution. Planning artifacts live in `.planning/`.

| File | Purpose |
|------|---------|
| `.planning/PROJECT.md` | Vision, requirements, key decisions |
| `.planning/ROADMAP.md` | 4-phase production-hardening roadmap |
| `.planning/REQUIREMENTS.md` | 23 v1 requirements with REQ-IDs |
| `.planning/STATE.md` | Current phase and progress |
| `.planning/config.json` | Workflow mode: yolo, coarse, sequential |
| `.planning/codebase/` | Codebase map (architecture, concerns, stack, etc.) |
| `.planning/research/` | Domain research (test stack, features, pitfalls) |

**Current milestone:** Production Hardening — testing, bug fixes, browser compat, data integrity, infra security.

**Phase 1 is next:** Extract `_parseResponse` into `composables/catParser.ts`, wire Vitest, fix BUG-01 through BUG-05.

Run `/gsd-plan-phase 1` to start.

## Local dev
```bash
npm install
npm run dev        # Nuxt dev server at http://localhost:3000
npm run generate   # Build static site → .output/public
docker build -t cat-ftx1 . && docker run -p 8080:80 cat-ftx1
```

Web Serial API requires HTTPS or localhost — the dev server satisfies this.
