# Project State

## Project Reference
See: .planning/PROJECT.md (updated 2026-05-08)

**Core value:** A connected operator can control every aspect of their FTX-1 from a browser tab without touching the radio.
**Current focus:** Phase 2

## Current Phase
Phase 2 — Browser Compatibility + Error Surface

## Status
In progress — Plan 01 complete

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Testing Foundation + Bug Fixes | Complete |
| 2 | Browser Compatibility + Error Surface | Not started |
| 3 | Data Integrity — Memory Operations | Not started |
| 4 | Infrastructure Hardening | Not started |

## Performance Metrics

- Plans completed: 7
- Requirements delivered: 12/23
- Phases completed: 1/4

## Accumulated Context

### Decisions
- Extract `_parseResponse` into `composables/catParser.ts` with pure function signature before writing any tests
- Use Vitest (not Jest) — ships with Nuxt 3 / Vite ecosystem
- `package.json` needs `"type": "module"` or vitest config must be named `.mts`
- MODE_CODE must be imported alongside parseResponse in useSerial.ts (writeMemoryChannel uses it)
- Use `!= null` (not `!== undefined`) to narrow `number | null` to `number` for _fireScopeRequery
- Each toggle function owns its own busy flag — no shared flags between unrelated toggles
- Browser gate uses tagPriority:critical IIFE in app.head.script — runs before Nuxt module bundle
- Two distinct gate messages: HTTPS-required (COMPAT-02) vs wrong-browser (COMPAT-01)
- Tab lifecycle sends AI0 (disable auto-info) on entry to channels tab, AI1 on exit
- TX gate during scan via existing connected/clickable props — no new component props needed
- scanMemoryChannels disables AI mode (AI0) before bulk read and re-enables (AI1) in finally — BUG-04
- VFO frequency saved via _sendAndWait('FA') and restored in finally block — BUG-01
- readMemoryChannel parses CN resp.substring(4) directly, not from global state — BUG-02

### Blockers
None

### Key Todos
- Confirm CTCSS/DCS index bounds and clarifier range against CAT-FTX1.pdf before writing DATA-01 validation code (Phase 3)

## Session Continuity

Resume from: Phase 2, Plan 02 (02-01 complete — browser gate + compat-warning removal)
Next action: Execute 02-02 (error surface)

## Last Updated
2026-05-09 (02-01 complete — COMPAT-01 and COMPAT-02 delivered)
