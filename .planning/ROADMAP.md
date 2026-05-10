# Roadmap: CAT FTX-1 Controller — Production Hardening

**Milestone:** v1 Production Hardening
**Granularity:** Coarse
**Requirements:** 23 v1 requirements
**Coverage:** 23/23 mapped

---

## Phases

- [x] **Phase 1: Testing Foundation + Bug Fixes** - Extract and test the CAT parser; fix the three silent data-corruption paths
- [x] **Phase 2: Browser Compatibility + Error Surface** - Gate unsupported browsers before the bundle loads; surface all command errors by name
- [x] **Phase 3: Data Integrity — Memory Operations** - Validate every write path and disclose protocol limitations to the user
- [x] **Phase 4: Infrastructure Hardening** - Lock the build, remove unused deps, add CSP, migrate ACR to managed identity
- [ ] **Phase 5: Launch Assets** - Create demo video, finalize repo metadata, and build the hamtools.cc catalog landing page
- [ ] **Phase 6: Ham Radio Communities** - Post to core ham radio forums and mailing lists where FTX-1 operators are active
- [ ] **Phase 7: Extended Reach** - Reach Yaesu Facebook groups, developer communities (Show HN, dev.to), and eham.net

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
- [x] 03-03-PLAN.md — CSV import validation with two-pass validate-then-confirm flow (DATA-01)

### Phase 4: Infrastructure Hardening
**Goal**: The build is fully reproducible, the container is secured with a Content Security Policy, and ACR pulls via managed identity rather than admin credentials
**Depends on**: Phase 3
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. `docker build` runs `npm ci` against a committed lockfile; the build fails if `package-lock.json` is absent or inconsistent
  2. `magic-regexp` is absent from `package.json` and `package-lock.json`
  3. Every response from the nginx server includes a `Content-Security-Policy` header covering `default-src`, `script-src`, and `connect-src`
  4. App Service pulls images from ACR using managed identity; `adminUserEnabled` is false in Bicep and no admin credential app settings exist

**Plans**: 4 plans

- [x] 04-01-PLAN.md — Remove magic-regexp, regenerate lockfile, switch Dockerfile to npm ci (INFRA-01, INFRA-02)
- [x] 04-02-PLAN.md — Add CSP header to nginx.conf server block (INFRA-03)
- [x] 04-03-PLAN.md — Bicep managed identity + DockerHub CI push (INFRA-04)
- [x] 04-04-PLAN.md — README local Docker + self-hosted Azure docs; setup.sh interactive mode (D-15, D-16, D-17)

### Phase 5: Launch Assets
**Goal**: Every promotion post links to a polished repo, a live demo video, and a hamtools.cc landing page — no user has to ask "what does it do?"
**Depends on**: Phase 4
**Requirements**: PROMO-01, PROMO-02, PROMO-03
**Success Criteria** (what must be TRUE):
  1. A 60–90 second YouTube demo video is published showing: connect → live frequency → preset → VFO change
  2. GitHub repo has topics: `ham-radio`, `cat-control`, `yaesu`, `yaesu-ftx1`, `web-serial`, `nuxt`, `vue`
  3. hamtools.cc is live on GitHub Pages — dark minimal HTML/CSS page with screenshot/video, description, features, browser warning, and two CTAs (Launch app + GitHub repo)

**Plans**: 4 plans

- [ ] 05-00-PLAN.md — Create YouTube channel `hamtools` (manual prerequisite — channel name, branding, playlist structure)
- [ ] 05-01-PLAN.md — Record and publish YouTube demo video
- [ ] 05-02-PLAN.md — Add GitHub topics + README video embed (cat-ftx1v2 repo)
- [ ] 05-03-PLAN.md — Build and deploy hamtools.cc landing page (new repo `mapoby/hamtools.cc`, GitHub Pages)

### Phase 6: Ham Radio Communities
**Goal**: Posts are live on the three highest-traffic ham radio text forums; early feedback is collected and responded to
**Depends on**: Phase 5
**Requirements**: PROMO-04, PROMO-05
**Success Criteria** (what must be TRUE):
  1. r/amateurradio post published (problem-first framing, video linked, callsign included)
  2. QRZ.com Software/Digital forum post published (Web Serial limitation addressed upfront)
  3. RSGB Community Forum post published
  4. Groups.io Yaesu list announcement sent
  5. r/hamradio cross-post published 3–5 days after r/amateurradio

**Plans**: 2 plans

- [ ] 06-01-PLAN.md — Draft Reddit posts (r/amateurradio + r/hamradio)
- [ ] 06-02-PLAN.md — Draft QRZ, RSGB, and Groups.io posts

### Phase 7: Extended Reach
**Goal**: App is discoverable by Yaesu Facebook group members, Hacker News readers, and frontend developers who are also hams
**Depends on**: Phase 6
**Requirements**: PROMO-06, PROMO-07
**Success Criteria** (what must be TRUE):
  1. Facebook "Yaesu Radio" group post published (video-forward)
  2. eham.net software listing submitted
  3. Show HN post published (Tue–Thu 9–11am ET)
  4. dev.to technical article published: "Building a browser-based ham radio controller with Web Serial API"

**Plans**: 3 plans

- [ ] 07-01-PLAN.md — Facebook Yaesu groups + eham.net listing
- [ ] 07-02-PLAN.md — Show HN post
- [ ] 07-03-PLAN.md — dev.to technical article

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Testing Foundation + Bug Fixes | 6/6 | Complete | 2026-05-08 |
| 2. Browser Compatibility + Error Surface | 2/2 | Complete | 2026-05-09 |
| 3. Data Integrity — Memory Operations | 3/3 | Complete | 2026-05-09 |
| 4. Infrastructure Hardening | 4/4 | Complete | 2026-05-09 |
| 5. Launch Assets | 0/4 | Not started | — |
| 6. Ham Radio Communities | 0/2 | Not started | — |
| 7. Extended Reach | 0/3 | Not started | — |

---
*Roadmap created: 2026-05-08*
