# Codebase Structure

**Analysis Date:** 2026-05-08

## Directory Layout

```
cat-ftx1v2/
├── app.vue                   # Nuxt root shell — contains only <NuxtPage />
├── nuxt.config.ts            # Nuxt config — SSR off, exposes appVersion + buildDate
├── package.json              # Dependencies: nuxt ^3.13, magic-regexp; devDeps: TS, vue-tsc
├── cat-presets.json          # Preset command definitions (user-editable)
├── tsconfig.json             # TypeScript config (Nuxt-managed)
│
├── pages/
│   └── index.vue             # Entire application UI and logic (~1400 lines)
│
├── composables/
│   └── useSerial.ts          # Web Serial singleton: state, CAT protocol, public API
│
├── components/
│   ├── SMeter.vue            # Signal strength bar (0–255 raw → S0–S9+60)
│   ├── LevelBar.vue          # Generic 0–255 progress bar with click/scroll interaction
│   ├── StatusBadge.vue       # Label+value badge with active state and toggle emit
│   ├── BandwidthDisplay.vue  # Passband visualizer; controls SH (bandwidth) and IS (shift)
│   └── PresetButton.vue      # Preset card button; executes command array via sendPreset()
│
├── docs/
│   ├── CAT-FTX1.pdf          # Yaesu FTX-1 CAT reference manual
│   ├── CAT-notes.md          # Developer notes on CAT protocol quirks
│   └── ui-screenshot.png     # UI screenshot
│
├── infra/
│   ├── main.bicep            # Azure IaC: ACR + App Service Plan + Web App
│   └── setup.sh              # One-time provisioning script (run from Azure Cloud Shell)
│
├── .github/
│   └── workflows/
│       └── azure-deploy.yml  # CI/CD: build Docker image, push to ACR, deploy to App Service
│
├── Dockerfile                # Multi-stage: node:22-alpine builder → nginx:1.27-alpine
├── nginx.conf                # SPA fallback, gzip, asset caching, /health endpoint
├── CLAUDE.md                 # Project context for Claude Code
│
└── .planning/
    └── codebase/             # Architecture documents (this directory)
```

## Key File Locations

**Entry Point:**
- `app.vue`: Nuxt root — a single `<NuxtPage />` passthrough. No layout logic here.
- `pages/index.vue`: The entire application. Nuxt auto-registers this as the `/` route.

**Serial / CAT Layer:**
- `composables/useSerial.ts`: All Web Serial API usage, CAT encode/decode, singleton state. This is the only file that talks to the hardware.

**Preset Data:**
- `cat-presets.json`: JSON array of preset objects. Structure:
  ```json
  { "id": "string", "label": "string", "color": "#hex", "description": "string", "commands": ["CMD1", "CMD2"] }
  ```
  Loaded via static import at the top of `pages/index.vue` script setup. Edit this file to add/modify presets.

**Build Config:**
- `nuxt.config.ts`: Minimal. SSR off. Exposes `APP_VERSION` env var and a build-time date string via `useRuntimeConfig().public`.
- `Dockerfile`: Multi-stage. Stage 1 runs `npm run generate` to produce `.output/public/`. Stage 2 copies that into nginx.
- `nginx.conf`: Serves `.output/public/`; all unmatched paths → `index.html` (SPA fallback).

**Infrastructure:**
- `infra/main.bicep`: Defines Azure Container Registry and App Service. Not applied automatically — requires manual `setup.sh` run.
- `.github/workflows/azure-deploy.yml`: Triggered on push to `main`. Authenticates via OIDC (no stored credentials). Tags image with both `:sha` and `:latest`.

## Routing

There is effectively no client-side routing. `app.vue` renders `<NuxtPage />`, and `pages/index.vue` is the only page. Nuxt generates a single `index.html` at `nuxt generate` time. The nginx `try_files` directive routes all paths back to `index.html`.

The two "tabs" (Dashboard / Channel List) inside `pages/index.vue` are controlled by a `ref<'dashboard' | 'channels'>` local variable (`activeTab`) with `v-show` — they are not separate routes.

## Component Hierarchy

```
app.vue
└── NuxtPage → pages/index.vue
    ├── <header>          connection bar (baud select, connect button, status)
    ├── <main> (v-if connected)
    │   ├── <nav>         tab bar (dashboard / channels)
    │   ├── div (dashboard tab, v-show)
    │   │   ├── .txbar          TX/RX indicator + FUNC KNOB buttons
    │   │   ├── .vfo-section
    │   │   │   ├── .vfo-card.sub-card
    │   │   │   │   ├── SMeter (subSmeter)
    │   │   │   │   ├── LevelBar × 2 (afGainSub, rfGainSub or sqSub)
    │   │   │   │   └── StatusBadge × 7 (AGC, NARROW, DNR, Tone SQL, CTCSS, DCS, SAVE CH)
    │   │   │   └── .vfo-card.main-card
    │   │   │       ├── SMeter (mainSmeter)
    │   │   │       ├── BandwidthDisplay (mainBandwidth, mainShift)
    │   │   │       ├── LevelBar × 2 (afGainMain, rfGainMain or sqMain)
    │   │   │       └── StatusBadge × 7
    │   │   ├── .status-section  StatusBadge × ~18 (RX MODE, SPLIT, MOX, LOCK, PWR, ...)
    │   │   ├── .bottom-panels
    │   │   │   ├── .scope-panel        Band Scope controls (span, speed, mode, color, marker)
    │   │   │   ├── .presets-section    PresetButton × N (from cat-presets.json)
    │   │   │   ├── .channels-panel     Saved Channels (localStorage)
    │   │   │   └── .channels-panel     Radio Memory (scan + recall)
    │   │   └── .cmd-section            Manual CAT command input
    │   └── div (channel list tab, v-show)
    │       └── .chlist-table-wrap      Editable table of EditableChannel rows
    ├── <footer>          firmware versions + last update time
    └── Teleport × 7      Modals (CTCSS picker, DCS picker, Mode picker, Band picker,
                          RSGB import, Repeater info, Wipe All confirmation)
```

## Naming Conventions

**Files:**
- Components: `PascalCase.vue` (e.g. `StatusBadge.vue`, `PresetButton.vue`)
- Composables: `camelCase.ts` prefixed with `use` (e.g. `useSerial.ts`)
- Data files: `kebab-case.json` (e.g. `cat-presets.json`)
- Config/infra: lowercase with extension (e.g. `nginx.conf`, `nuxt.config.ts`)

**TypeScript identifiers in `useSerial.ts`:**
- Private module-level variables: `_camelCase` (e.g. `_port`, `_writer`, `_queue`)
- Exported constants/functions: `camelCase`
- Exported interfaces: `PascalCase` (e.g. `TransceiverState`, `RadioChannel`)
- Decode maps: `UPPER_SNAKE_CASE` (e.g. `MODE_MAP`, `AGC_MAP`)

**CSS classes in components:**
- BEM-influenced kebab-case (e.g. `.badge--clickable`, `.level-track--clickable`)

## Where to Add New Code

**New CAT command support (decode a new opcode):**
- Add the `case 'XX':` block to `_parseResponse()` in `composables/useSerial.ts`
- Add the corresponding field(s) to the `TransceiverState` interface at the top of the same file
- Add to `defaultState()` with a sensible null/false default
- Query it in `_initialSync()` or `_initialSync2()` as appropriate

**New UI control (toggle/widget on dashboard):**
- Add the `StatusBadge` or `LevelBar` to the appropriate section in `pages/index.vue` template
- Add the handler function in `<script setup>` following existing patterns (async, try/catch, set `lastError`)

**New preset:**
- Edit `cat-presets.json` — no code changes required

**New display component:**
- Create `components/NewName.vue` with props-in / emits-out pattern
- Import and use in `pages/index.vue` (Nuxt auto-imports components)

**New modal/picker:**
- Add a `ref<boolean>` or `ref<string | null>` visibility flag in `pages/index.vue` script setup
- Add the modal markup inside a `<Teleport to="body">` block at the bottom of the template (follow the existing CTCSS/DCS/Mode/Band modal pattern)

## Special Directories

**`.nuxt/`:**
- Purpose: Nuxt generated types and virtual module files
- Generated: Yes (by `nuxt dev` / `nuxt prepare`)
- Committed: No (in `.gitignore`)

**`.output/`:**
- Purpose: Static build output (`nuxt generate` → `.output/public/`)
- Generated: Yes (by `nuxt generate` or Docker build)
- Committed: No

**`.planning/`:**
- Purpose: Architecture and planning documents for Claude Code
- Generated: No (manually maintained)
- Committed: Yes

**`docs/`:**
- Purpose: FTX-1 CAT reference manual, developer notes, UI screenshot
- Generated: No
- Committed: Yes

**`infra/`:**
- Purpose: Azure infrastructure-as-code and provisioning script
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-05-08*
