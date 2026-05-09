# Yaesu FTX-1 radio WEB based remote control v2

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
| Testing | Vitest — CAT parser unit tests, CI-gated |

### Container

| | |
| --- | --- |
| Builder image | `node:22-alpine` — installs deps via `npm ci`, runs `nuxt generate` |
| Serve image | `nginx:1.27-alpine` — serves static files, ~20 MB final image |
| Web server | nginx with SPA fallback, gzip, asset caching, security headers, CSP, `/health` endpoint |

### Cloud Infrastructure (Azure)

| Resource | Details |
| --- | --- |
| Container Registry | Azure Container Registry — Basic SKU (`catftx1webacr.azurecr.io`), admin credentials disabled |
| App Service Plan | Linux B1 SKU (`catftx1web-plan`) |
| Web App | Linux container, HTTPS-only (`catftx1web-app.azurewebsites.net`), pulls from ACR via managed identity |
| Resource group | `ev-catftx1web-rg` — UK South region |
| IaC | Bicep (`infra/main.bicep`) |

### CI/CD (GitHub Actions)

| | |
| --- | --- |
| Trigger | Push to `main`, or manual `workflow_dispatch` |
| Auth | OIDC — no stored passwords; short-lived token minted per run |
| Steps | Checkout → test gate → Azure login → ACR login → DockerHub login → Docker build & push → Web App deploy |
| Image tags | `:sha` (immutable, used for deploy) + `:latest` |
| Registries | Azure Container Registry + DockerHub (`mapoby/cat-ftx1`) |
| Workflow | `.github/workflows/azure-deploy.yml` |

---

## Browser Requirements

Web Serial API requires **Chrome or Edge** (desktop). Safari and Firefox are not supported.

The app shows a blocking message before loading if the browser or connection is unsupported.

---

## Local Development

> Web Serial API requires HTTPS or `localhost` — the Nuxt dev server satisfies this.

```bash
npm install
npm run dev          # dev server at http://localhost:3000
npm run generate     # build static site → .output/public
npm test             # run Vitest unit tests
```

Run with Docker (build from source):

```bash
docker build -t cat-ftx1 .
docker run -p 8080:80 cat-ftx1
# open http://localhost:8080
```

Run with Docker (pull pre-built image from DockerHub):

```bash
docker pull mapoby/cat-ftx1:latest
docker run -p 8080:80 mapoby/cat-ftx1:latest
# open http://localhost:8080
```

> The `localhost` origin satisfies the HTTPS requirement, so plain HTTP on port 8080 works for local testing.

---

## Self-hosted on Azure

You can deploy your own instance to Azure App Service in about 10 minutes.

### Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and authenticated (`az login`)
- Docker (for local builds — not needed if only deploying via CI/CD)
- A GitHub account with a fork of this repository

### Provision infrastructure

```bash
bash infra/setup.sh
```

The script prompts whether to use default values or configure interactively. It creates:

1. Resource group
2. Azure Container Registry + App Service Plan + Web App (via Bicep)
3. Entra ID app registration and service principal
4. OIDC federated credential bound to `refs/heads/main`
5. Contributor + Role Based Access Control Administrator roles on the resource group

### Configure GitHub Actions

After the script completes, add these values to **GitHub → Settings → Secrets and variables → Actions**:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `AZURE_CLIENT_ID` | Printed by setup.sh |
| Secret | `AZURE_TENANT_ID` | Printed by setup.sh |
| Secret | `AZURE_SUBSCRIPTION_ID` | Printed by setup.sh |
| Secret | `DOCKERHUB_USERNAME` | Your DockerHub username |
| Secret | `DOCKERHUB_TOKEN` | DockerHub access token (Account Settings → Security → Access Tokens) |
| Secret | `WEB3FORMS_KEY` | [web3forms.com](https://web3forms.com) access key for the feedback form |
| Variable | `ACR_NAME` | Printed by setup.sh |
| Variable | `ACR_LOGIN_SERVER` | Printed by setup.sh |
| Variable | `AZURE_WEBAPP_NAME` | Printed by setup.sh |

The first push to `main` builds the image, pushes to both ACR and DockerHub, and deploys to your Web App.

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
- Memory channel read, edit, write, delete, wipe, CSV import/export
- Dashboard visible (dimmed) before connecting — shows UI layout before radio is plugged in
- Feedback button — report bugs or request features via email form or GitHub issue

---

## Key Files

| File | Purpose |
| --- | --- |
| `composables/useSerial.ts` | All Web Serial logic and CAT protocol parsing |
| `composables/catParser.ts` | Pure CAT response parser — unit tested |
| `pages/index.vue` | Main UI |
| `components/` | BandwidthDisplay, LevelBar, SMeter, StatusBadge, PresetButton |
| `cat-presets.json` | Preset command definitions |
| `nuxt.config.ts` | SSR off, devtools off, runtimeConfig |
| `Dockerfile` | Multi-stage build (node builder → nginx) |
| `nginx.conf` | SPA fallback, gzip, asset caching, security headers, CSP |
| `infra/main.bicep` | Azure IaC — ACR + App Service Plan + Web App (managed identity) |
| `infra/setup.sh` | One-time provisioning script (interactive mode) |
| `.github/workflows/azure-deploy.yml` | CI/CD pipeline (ACR + DockerHub push) |

---

## License

[PolyForm Noncommercial License 1.0.0](LICENSE) — free for non-commercial use. Contact [info@narmico.com](mailto:info@narmico.com) for commercial licensing.

---

## Credits

| | |
| --- | --- |
| Original author | [SP9AX — Radosław Żochowski](https://github.com/rzochowski/cat-ftx1) |
| Forked and developed | 2E0MIK — Michael N |
