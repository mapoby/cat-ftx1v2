# Project State

## Project Reference
See: .planning/PROJECT.md (updated 2026-05-08)

**Core value:** A connected operator can control every aspect of their FTX-1 from a browser tab without touching the radio.
**Current focus:** Phase 3

## Current Phase
Phase 3 — Data Integrity — Memory Operations

## Status
Complete — all 3 plans delivered

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Testing Foundation + Bug Fixes | Complete |
| 2 | Browser Compatibility + Error Surface | Complete |
| 3 | Data Integrity — Memory Operations | Complete |
| 4 | Infrastructure Hardening | Not started |

## Performance Metrics

- Plans completed: 10
- Requirements delivered: 18/23
- Phases completed: 3/4

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
- Physical disconnect handler (_handlePhysicalDisconnect) self-unwires on first fire — prevents double-reset
- Tab lifecycle sends AI0 (disable auto-info) on entry to channels tab, AI1 on exit
- TX gate during scan via existing connected/clickable props — no new component props needed
- scanMemoryChannels disables AI mode (AI0) before bulk read and re-enables (AI1) in finally — BUG-04
- VFO frequency saved via _sendAndWait('FA') and restored in finally block — BUG-01
- readMemoryChannel parses CN resp.substring(4) directly, not from global state — BUG-02
- Slot 0 guard placed at composable entry (not call site) — defense-in-depth before CAT bus
- slotWriteResults cleared only at write start (not disconnect/tab switch) — preserves last result for user
- Wipe All modal backdrop click and X button removed — only Cancel and WIPE ALL close it (DATA-03)
- Delete Selected button opens disclosure modal; confirm handler sets dialog false before async deleteSelectedFromRadio (DATA-03)
- validateCsvRow placed immediately before onImportCsv — keeps validation and usage co-located (DATA-01)
- CSV modal uses Vue 3 ref auto-unwrap in template (no .value in @click handlers) (DATA-01)

### Blockers
None

### Key Todos
- Confirm CTCSS/DCS index bounds and clarifier range against CAT-FTX1.pdf before writing DATA-01 validation code (Phase 3)

## Session Continuity

Resume from: Phase 4, plan 01
Next action: /gsd-plan-phase 4

## Last Updated
2026-05-09 (Phase 3 complete — DATA-01 delivered via 03-03)
