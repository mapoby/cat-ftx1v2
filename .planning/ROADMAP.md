# Roadmap: CAT FTX-1 Controller — Production Hardening

**Milestone:** v1 Production Hardening
**Granularity:** Coarse
**Requirements:** 23 v1 requirements
**Coverage:** 23/23 mapped

---

## Phases

- [x] **Phase 1: Testing Foundation + Bug Fixes** - Extract and test the CAT parser; fix the three silent data-corruption paths
- [x] **Phase 2: Browser Compatibility + Error Surface** - Gate unsupported browsers before the bundle loads; surface all command errors by name
- [ ] **Phase 3: Data Integrity — Memory Operations** - Validate every write path and disclose protocol limitations to the user
- [ ] **Phase 4: Infrastructure Hardening** - Lock the build, remove unused deps, add CSP, migrate ACR to managed identity

---

## Phase Details

### Phase 1: Testing Foundation + Bug Fixes
**Goal**: The CAT parsing logic is reliably tested in CI and the three production bugs that corrupt radio state are fixed
**Depends on**: Nothing
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, BUG-01, BUG-02, BUG-03, BUG-04, BUG-05
**Success Criteria** (what must be TRUE):
  1. `npm test` runs 30+ Vitest assertions covering all CAT opcodes and passes clean in a Node environment with no serial hardware
  2. CI fails the Docker build if any test fails; a coverage artifact is attached to each CI run
  3. Memory channel scan completes and the radio VFO is left on the frequency it had before the scan started, even if the scan errors mid-run
  4. `toggleRfSql()` executes without throwing and does not require `preAmpHf` to be non-null
  5. `readMemoryChannel()` reads CTCSS/DCS tone from the command response, not from stale global state

**Plans:** 6 plans

- [x] 01-01-PLAN.md — Extract catParser.ts + export defaultState (TEST-01, TEST-03)
- [x] 01-02-PLAN.md — Install Vitest, create vitest.config.mts, add npm test scripts (TEST-04 infra, TEST-05 infra)
- [x] 01-03-PLAN.md — Write 40+ opcode tests in catParser.test.ts (TEST-02)
- [x] 01-04-PLAN.md — Fix BUG-01 (VFO save/restore), BUG-02 (stale CN state), BUG-04 (AI mode in scan)
- [x] 01-05-PLAN.md — Fix BUG-03 (toggleRfSql busy flag), BUG-05 (tab switch AI mode)
- [x] 01-06-PLAN.md — Wire CI test gate + coverage artifact (TEST-04, TEST-05)

### Phase 2: Browser Compatibility + Error Surface
**Goal**: Users on unsupported browsers see a clear blocking message before the app loads, and users on Chrome see actionable errors when the radio does not respond
**Depends on**: Phase 1
**Requirements**: COMPAT-01, COMPAT-02, ERR-01, ERR-02, ERR-03
**Success Criteria** (what must be TRUE):
  1. Opening the app in Firefox or Safari shows a full-page blocking message before any Vue component renders, distinguishing "wrong browser" from "page served over HTTP"
  2. Opening the app over plain HTTP shows a message explaining that HTTPS is required, not a generic Web Serial unavailable error
  3. A `?;` error response from the radio is shown in the UI with the name of the command that caused it
  4. A command that times out (1500 ms) is shown in the UI with the command name and a "radio did not respond" message
  5. Unplugging the radio clears VFO and status state without requiring a page reload

**Plans**: 2 plans

- [x] 02-01-PLAN.md — Browser compatibility gate: inline script + remove old banner (COMPAT-01, COMPAT-02)
- [ ] 02-02-PLAN.md — Error surface: ?; and timeout messages + disconnect event (ERR-01, ERR-02, ERR-03)

### Phase 3: Data Integrity — Memory Operations
**Goal**: Every write to the radio produces visible per-slot feedback, every import is validated before any data changes, and protocol limitations are disclosed to the user
**Depends on**: Phase 2
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. Importing a CSV with invalid rows shows a per-row error summary and writes nothing until the user confirms; a fully invalid file writes nothing at all
  2. Writing memory channels shows "Channel N written" or "Channel N failed" for each slot in the UI
  3. Delete and Wipe All operations display a persistent disclosure that the slot is overwritten with blank values and the slot number is not removed from the radio
  4. No code path in the app accepts slot 0 as a write or delete target

**Plans**: 3 plans

- [x] 03-01-PLAN.md — Slot 0 guard in useSerial.ts + per-slot write feedback in writeAllToRadio (DATA-04, DATA-02)
- [x] 03-02-PLAN.md — Delete Selected confirmation modal + harden Wipe All modal (DATA-03)
- [ ] 03-03-PLAN.md — CSV import validation with two-pass validate-then-confirm flow (DATA-01)

### Phase 4: Infrastructure Hardening
**Goal**: The build is fully reproducible, the container is secured with a Content Security Policy, and ACR pulls via managed identity rather than admin credentials
**Depends on**: Phase 3
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. `docker build` runs `npm ci` against a committed lockfile; the build fails if `package-lock.json` is absent or inconsistent
  2. `magic-regexp` is absent from `package.json` and `package-lock.json`
  3. Every response from the nginx server includes a `Content-Security-Policy` header covering `default-src`, `script-src`, and `connect-src`
  4. App Service pulls images from ACR using managed identity; `adminUserEnabled` is false in Bicep and no admin credential app settings exist

**Plans**: TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Testing Foundation + Bug Fixes | 6/6 | Complete | 2026-05-08 |
| 2. Browser Compatibility + Error Surface | 2/2 | Complete | 2026-05-09 |
| 3. Data Integrity — Memory Operations | 2/3 | In progress | - |
| 4. Infrastructure Hardening | 0/? | Not started | - |

---
*Roadmap created: 2026-05-08*
