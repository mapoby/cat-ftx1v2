# CAT FTX-1 — Claude Code Context

## What this project is
Browser-based CAT controller for the Yaesu FTX-1 transceiver. The app runs as a fully static SPA (Nuxt 3 + Vue 3) served from an nginx Docker container hosted on Azure App Service. Serial communication uses the **browser-native Web Serial API** — no backend process required.

## Architecture (v2.0)
- **Frontend**: Nuxt 3 (`ssr: false`), `nuxt generate` → static files in `.output/public`
- **Serial**: `composables/useSerial.ts` — singleton state via `shallowRef`, connects via `navigator.serial.requestPort()`, reads a continuous stream split on `;`, parses all CAT responses
- **Container**: multi-stage Docker build (node:22-alpine builder → nginx:1.27-alpine); nginx serves SPA with fallback to `index.html`
- **Hosting**: Azure App Service (Linux container, B1 SKU), image pulled from Azure Container Registry (Basic SKU)
- **CI/CD**: `.github/workflows/azure-deploy.yml` — triggers on push to `main`; authenticates via OIDC (no stored passwords); builds & pushes image tagged `:sha` + `:latest`; deploys `:sha` tag to Web App

## Pending: Azure infrastructure setup
Infrastructure has NOT been provisioned yet. The user needs to run `infra/setup.sh` from **Azure Cloud Shell** (https://shell.azure.com) — device code flow is blocked by tenant Conditional Access policy from headless environments.

```bash
# In Azure Cloud Shell (Bash):
git clone https://github.com/mapoby/cat-ftx1v2
cd cat-ftx1v2
APP_NAME=catftx1web LOCATION=uksouth GITHUB_REPO=mapoby/cat-ftx1v2 bash infra/setup.sh
```

After running, add the printed values to GitHub → Settings → Secrets and variables → Actions:

| Type | Name |
|------|------|
| Secret | `AZURE_CLIENT_ID` |
| Secret | `AZURE_TENANT_ID` |
| Secret | `AZURE_SUBSCRIPTION_ID` |
| Variable | `ACR_NAME` |
| Variable | `ACR_LOGIN_SERVER` |
| Variable | `AZURE_WEBAPP_NAME` |

The first push to `main` after secrets are configured will trigger a full build + deploy.

## Active development branch
`claude/azure-hosting-plan-MCXso`

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

## Phase 2 (not started)
Evaluate whether to migrate from Nuxt/Vue to plain HTML + JS or HTML + Python stack. Goal: lighter bundle, same UI styles and layout. No decision made yet.

## Local dev
```bash
npm install
npm run dev        # Nuxt dev server at http://localhost:3000
npm run generate   # Build static site → .output/public
docker build -t cat-ftx1 . && docker run -p 8080:80 cat-ftx1
```

Web Serial API requires HTTPS or localhost — the dev server satisfies this.
