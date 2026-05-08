# External Integrations

**Analysis Date:** 2026-05-08

## Hardware Interface — Web Serial API

**Interface:** Browser-native `navigator.serial` (Web Serial API)
- No backend, no Node.js serial server
- Implemented in: `composables/useSerial.ts`
- Connection: `navigator.serial.requestPort()` — triggers browser port picker dialog
- Protocol: Yaesu CAT (ASCII commands terminated with `;`, responses split on `;`)
- Baud rate: 38400 (default), 8N1
- Radio identification: `ID` command must return `0840` (FTX-1 device ID)
- Auto-info mode (`AI1`) enabled on connect for unsolicited state push from radio
- Browser requirement: Chrome or Edge (Firefox does not support Web Serial API)
- Origin requirement: HTTPS or `localhost`

**Supported CAT Commands (parsed):**
- Frequency: `FA`, `FB`, `IF`, `OI`
- Mode: `MD`
- S-meter: `SM`, `RM`
- TX/RX state: `TX`, `MX`, `ST`, `FR`, `FT`
- AGC, RF/AF gain, squelch: `GT`, `RG`, `AG`, `SQ`
- Power, audio, DSP: `PC`, `AO`, `MG`, `PR`, `PL`, `VX`, `VG`, `RL`, `RA`, `PA`, `NA`, `SH`, `IS`
- Memory channels: `MR`, `MZ`, `MT`
- Scope: `SS`, `FD`
- Firmware: `VE`
- CTCSS/DCS: `CT`, `CN`
- Misc: `LK`, `SF`, `AI`, `EX`, `RI`

## Container

**Docker:**
- Multi-stage build defined in `Dockerfile`
- Stage 1: `node:22-alpine` — runs `npm install` + `npm run generate`
- Stage 2: `nginx:1.27-alpine` — copies `.output/public` and `nginx.conf`
- Exposed port: 80
- Health check: `GET /health` → `200 ok` (nginx `return 200` directive, no file required)
- Local compose: `docker-compose.yml` — maps host `8080` → container `80`
- `APP_VERSION` build arg baked into static bundle at build time

**nginx (`nginx.conf`):**
- SPA fallback: all routes → `index.html`
- Static asset caching: 1 year, `Cache-Control: public, immutable` for JS/CSS/fonts/images
- HTML: not cached (enables SPA updates without cache busting)
- Gzip: enabled for JS, CSS, JSON, SVG, plain text (min 1024 bytes)
- Security headers: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`

## Cloud Hosting — Azure

**Platform:** Azure App Service (Linux container)
- SKU: B1 (~$13/month minimum for Linux containers)
- `alwaysOn: true` — container kept warm
- `httpsOnly: true` — HTTP redirected to HTTPS (required for Web Serial API)
- Default URL: `<appName>-app.azurewebsites.net`
- IaC: `infra/main.bicep`

**Azure Container Registry (ACR):**
- SKU: Basic (~$0.17/day)
- Used as private registry for Docker images
- Admin user enabled (required for App Service pull)
- Image name: `cat-ftx1`
- Tags pushed: `:<git-sha>` (immutable, used for deployment) and `:latest`

**Azure Entra ID (formerly AAD):**
- App registration + service principal created by `infra/setup.sh`
- Used for OIDC authentication from GitHub Actions (no stored passwords)
- Federated credential subject: `repo:<owner>/<repo>:ref:refs/heads/main`
- Role: Contributor on the resource group only

**Infrastructure Provisioning:**
- Script: `infra/setup.sh` — one-time, run from Azure Cloud Shell
- Template: `infra/main.bicep` — deploys ACR + App Service Plan + Web App
- Outputs: `acrName`, `acrLoginServer`, `webAppName`, `webAppUrl`
- Note: Device code auth is blocked by tenant Conditional Access; must run from Azure Cloud Shell

## CI/CD Pipeline

**Provider:** GitHub Actions
- Workflow file: `.github/workflows/azure-deploy.yml`
- Trigger: push to `main` branch, or manual `workflow_dispatch`
- Runner: `ubuntu-latest`

**Pipeline Steps:**
1. `actions/checkout@v4` — checkout source
2. `azure/login@v2` — OIDC login (no stored secrets, token minted per-run)
3. `az acr login` — authenticate Docker to ACR using Azure token
4. `docker/build-push-action@v6` — build image with `APP_VERSION=v1.<run_number>`, push `:sha` + `:latest` tags
5. `azure/webapps-deploy@v3` — deploy `:sha`-tagged image to Web App and restart

**GitHub Secrets (required):**
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

**GitHub Variables (non-sensitive):**
- `ACR_NAME`
- `ACR_LOGIN_SERVER`
- `AZURE_WEBAPP_NAME`

## Authentication & Identity

**App auth:** None — the app is a fully public static site; no user authentication
**Azure auth:** OIDC via GitHub Actions federated credential (no long-lived secrets)

## Data Storage

**Databases:** None
**File Storage:** None — stateless container (`WEBSITES_ENABLE_APP_SERVICE_STORAGE=false`)
**Caching:** Browser cache only (nginx cache headers)
**Persistent state:** None — all transceiver state is in-memory Vue reactive state (`shallowRef` in `composables/useSerial.ts`); lost on page reload

## Monitoring & Observability

**Error Tracking:** None configured
**Logs:** Browser `console` only; nginx access logs to stdout (captured by Azure App Service log stream)
**Health Check:** Docker `HEALTHCHECK` polls `GET /health` every 30s

## Webhooks & Callbacks

**Incoming:** None
**Outgoing:** None

---

*Integration audit: 2026-05-08*
