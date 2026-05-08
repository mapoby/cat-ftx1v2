# Project State

## Project Reference
See: .planning/PROJECT.md (updated 2026-05-08)

**Core value:** A connected operator can control every aspect of their FTX-1 from a browser tab without touching the radio.
**Current focus:** Phase 1

## Current Phase
Phase 1 — Testing Foundation + Bug Fixes

## Status
Phase 1 complete — all 6 plans executed

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Testing Foundation + Bug Fixes | Not started |
| 2 | Browser Compatibility + Error Surface | Not started |
| 3 | Data Integrity — Memory Operations | Not started |
| 4 | Infrastructure Hardening | Not started |

## Performance Metrics

- Plans completed: 6
- Requirements delivered: 0/23
- Phases completed: 0/4

## Accumulated Context

### Decisions
- Extract `_parseResponse` into `composables/catParser.ts` with pure function signature before writing any tests
- Use Vitest (not Jest) — ships with Nuxt 3 / Vite ecosystem
- `package.json` needs `"type": "module"` or vitest config must be named `.mts`
- MODE_CODE must be imported alongside parseResponse in useSerial.ts (writeMemoryChannel uses it)
- Use `!= null` (not `!== undefined`) to narrow `number | null` to `number` for _fireScopeRequery
- Each toggle function owns its own busy flag — no shared flags between unrelated toggles
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

Resume from: Phase 2 (Phase 1 complete — all 6 plans executed)
Next action: Run /gsd-plan-phase 2 or /gsd-transition

## Last Updated
2026-05-08 (Plan 06 complete — Phase 1 done)
