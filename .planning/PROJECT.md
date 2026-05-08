# CAT FTX-1 Controller

## What This Is

A browser-based CAT (Computer Aided Transceiver) controller for the Yaesu FTX-1 HF transceiver. It runs as a fully static SPA (Nuxt 3 + Vue 3) served from nginx on Azure App Service, using the browser-native Web Serial API to communicate directly with the radio over USB serial — no backend required. Targeted at any FTX-1 operator who wants a web-based rig controller.

## Core Value

A connected operator can control every aspect of their FTX-1 from a browser tab without touching the radio.

## Requirements

### Validated

- ✓ Serial connection to FTX-1 via Web Serial API (connect/disconnect, baud select, auto-info mode) — existing
- ✓ Live VFO display — main and sub frequencies, mode, TX state — existing
- ✓ S-meter and signal level display — existing
- ✓ Band scope controls — span, speed, mode, level — existing
- ✓ Preset button execution (multi-command sequences with status overlay) — existing
- ✓ Saved channels (localStorage) with add/edit/delete and write-to-radio — existing
- ✓ Radio memory channel scan, display, and write-back — existing
- ✓ Multi-select and delete-selected channels from radio memory — existing
- ✓ Wipe all memory with confirmation dialog — existing
- ✓ RSGB repeater API integration (search by band/callsign/locator, import to channel list) — existing
- ✓ CSV import/export for channel lists — existing
- ✓ Azure hosting (App Service + ACR, CI/CD via GitHub Actions) — existing

### Active

- [ ] CAT protocol parsing extracted and unit tested
- [ ] Production bugs identified and fixed (toggleRfSql guard, CTCSS race, memory scan VFO restore)
- [ ] Input validation for CSV import and channel writes
- [ ] Unsupported browser experience improved (blocking overlay before bundle loads)
- [ ] Known protocol limitations documented in UI (delete = overwrite, not erase)
- [ ] Lockfile committed and Dockerfile switched to `npm ci`
- [ ] ACR managed identity replacing admin credentials
- [ ] Content Security Policy header added to nginx

### Out of Scope

- Refactoring `index.vue` into sub-composables — high effort, zero user-facing benefit for this milestone
- Mobile browser support — Web Serial API not available on any mobile browser
- Multi-radio support — app is purpose-built for FTX-1 only
- Real-time multi-user sessions — single operator, single port

## Context

- The codebase map (`.planning/codebase/`) contains detailed findings from an audit run 2026-05-08
- The app is targeting public release — strangers will use it, so silent failures and data corruption are unacceptable
- `_parseResponse()` in `composables/useSerial.ts` contains 30+ CAT decoders — the highest-value test target
- `index.vue` is ~4000 lines but refactoring it is explicitly out of scope for this milestone
- Azure infra is provisioned; pushes to `main` deploy automatically

## Constraints

- **Browser**: Chrome/Edge only — Web Serial API is Chromium-exclusive; no polyfill exists
- **Protocol**: FTX-1 CAT has no delete command; "delete" overwrites with sentinel values
- **Test environment**: Web Serial API unavailable in Node.js; serial-dependent code requires extraction before it can be unit tested
- **Stack**: Nuxt 3 + Vue 3 — no migration away from this stack in this milestone

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Extract `_parseResponse` logic for unit testing | Pure decoding logic can be tested in isolation without serial hardware | — Pending |
| Use Vitest for unit tests | Ships with Nuxt 3 / Vite ecosystem; no extra config needed | — Pending |
| Fix bugs found during testing rather than deferring | Public release means silent failures are unacceptable | — Pending |
| Keep `index.vue` monolith intact | Refactoring is out of scope; testing milestone is the priority | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-08 after initialization*
