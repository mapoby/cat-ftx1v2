# CAT FTX-1 v2

Browser-based remote control for the Yaesu FTX-1 transceiver using the CAT (Computer Aided Transceiver) protocol over USB serial.

The app eliminates navigating transceiver menus by exposing all controls graphically in a web browser. Once connected, auto-information mode activates and streams all parameter changes in real time.

![FTX-1 Console Screenshot](https://github.com/rzochowski/cat-ftx1/blob/main/docs/ui-screenshot.png)

---

## Tech Stack

### Frontend

| | |
| --- | --- |
| Framework | [Nuxt 3](https://nuxt.com) v3.13 (Vue 3, SSR disabled — pure SPA) |
| Build output | Static files via `nuxt generate` → `.output/public` |
| Language | TypeScript 5, Vue 3 Composition API |
| Serial | Browser-native [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) — no backend required |
| Pattern matching | [magic-regexp](https://github.com/danielroe/magic-regexp) v0.11 for CAT response parsing |

### Container

| | |
| --- | --- |
| Builder image | `node:22-alpine` — installs deps, runs `nuxt generate` |
| Serve image | `nginx:1.27-alpine` — serves static files, ~20 MB final image |
| Web server | nginx with SPA fallback, gzip, asset caching, `/health` endpoint |

### Cloud Infrastructure (Azure)

| Resource | Details |
| --- | --- |
| Container Registry | Azure Container Registry — Basic SKU (`catftx1webacr.azurecr.io`) |
| App Service Plan | Linux B1 SKU (`catftx1web-plan`) |
| Web App | Linux container, HTTPS-only (`catftx1web-app.azurewebsites.net`) |
| Resource group | `ev-catftx1web-rg` — UK South region |
| IaC | Bicep (`infra/main.bicep`) |

### CI/CD (GitHub Actions)

| | |
| --- | --- |
| Trigger | Push to `main`, or manual `workflow_dispatch` |
| Auth | OIDC — no stored passwords; short-lived token minted per run |
| Steps | Checkout → Azure login → ACR login → Docker build & push → Web App deploy |
| Image tags | `:sha` (immutable, used for deploy) + `:latest` (for ACR UI) |
| Workflow | `.github/workflows/azure-deploy.yml` |

---

## Local Development

> Web Serial API requires HTTPS or `localhost` — the Nuxt dev server satisfies this.

```bash
npm install
npm run dev          # dev server at http://localhost:3000
npm run generate     # build static site → .output/public
```

Run with Docker locally:

```bash
docker build -t cat-ftx1 .
docker run -p 8080:80 cat-ftx1
# open http://localhost:8080
```

---

## One-time Azure Setup

Infrastructure is provisioned by a single script. Run it from a machine already authenticated with `az login`:

```bash
APP_NAME=catftx1web RG=ev-catftx1web-rg LOCATION=uksouth GITHUB_REPO=mapoby/cat-ftx1v2 bash infra/setup.sh
```

The script creates:

1. Resource group
2. ACR + App Service Plan + Web App (via Bicep)
3. Entra ID app registration + service principal
4. OIDC federated credential bound to `refs/heads/main`
5. Contributor role on the resource group + Reader on the subscription

After running, add the printed values to **GitHub → Settings → Secrets and variables → Actions**:

| Type | Name |
| --- | --- |
| Secret | `AZURE_CLIENT_ID` |
| Secret | `AZURE_TENANT_ID` |
| Secret | `AZURE_SUBSCRIPTION_ID` |
| Variable | `ACR_NAME` |
| Variable | `ACR_LOGIN_SERVER` |
| Variable | `AZURE_WEBAPP_NAME` |

The first push to `main` triggers a full build and deploy.

---

## Connection

The app works on all three CAT interfaces (CAT-1, CAT-2, CAT-3). Set the baud rate in the transceiver's Operation settings to match your computer:

- **Recommended:** 115200 bps for best performance
- CAT-3 is reserved for the SPA-1 (Optima) amplifier — do not change its parameters if an Optima is connected

---

## Features

- Active VFO selection (click RX button or inactive panel)
- UP/DN buttons (equivalent to microphone buttons)
- Received bandwidth display and adjustment, including ±1200 Hz offset (Main VFO only)
- Narrow mode quick-switch
- SQL / RF / SQL-only-for-FM mode display, with RF gain and squelch sliders per VFO
- ATT, AMP and AGC mode switching
- Antenna selection for HF when an Optima amplifier is detected
- Last-used port and baud rate remembered across sessions
- Mouse scroll wheel for numerical values (frequency, DNR, PWR, MIC GAIN, AMC, PROC LEVEL, VOX GAIN)
- Band, modulation mode, CTCSS and DCS tone selectors
- Volume, squelch, and RF gain via mouse click
- Band scope settings with Main / Sub VFO distinction
- Transceiver firmware version display
- Frequency save/recall via browser local storage (not FTX-1 internal memory)

---

## Key Files

| File | Purpose |
| --- | --- |
| `composables/useSerial.ts` | All Web Serial logic and CAT protocol parsing |
| `pages/index.vue` | Main UI |
| `components/` | BandwidthDisplay, LevelBar, SMeter, StatusBadge, PresetButton |
| `cat-presets.json` | Preset command definitions |
| `nuxt.config.ts` | SSR off, devtools off |
| `Dockerfile` | Multi-stage build (node builder → nginx) |
| `nginx.conf` | SPA fallback, gzip, asset caching, `/health` |
| `infra/main.bicep` | Azure IaC — ACR + App Service Plan + Web App |
| `infra/setup.sh` | One-time provisioning script |
| `.github/workflows/azure-deploy.yml` | CI/CD pipeline |

---

## Credits

| | |
| --- | --- |
| Original author | [SP9AX — Radosław Żochowski](https://github.com/rzochowski/cat-ftx1) |
| Forked and developed | 2E0MIK — Michael N |
