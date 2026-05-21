# Project State

## Project Reference
See: .planning/PROJECT.md (updated 2026-05-08)

**Core value:** A connected operator can control every aspect of their FTX-1 from a browser tab without touching the radio.
**Current focus:** Phase 3

## Current Phase
Phase 8 — Channel Lists

## Current Plan

Plan 2 — Complete (08-02-PLAN.md)

## Status
In progress — 08-01 and 08-02 complete, 08-03 pending

## Milestones

### v1 Production Hardening — Complete (2026-05-09)
| Phase | Name | Status |
|-------|------|--------|
| 1 | Testing Foundation + Bug Fixes | Complete |
| 2 | Browser Compatibility + Error Surface | Complete |
| 3 | Data Integrity — Memory Operations | Complete |
| 4 | Infrastructure Hardening | Complete |

### v2 Community Launch — In Progress
| Phase | Name | Status |
|-------|------|--------|
| 5 | Launch Assets | Not started |
| 6 | Ham Radio Communities | Not started |
| 7 | Extended Reach | Not started |

## Performance Metrics

- Plans completed: 14 (v1)
- Requirements delivered: 22/23 (v1)
- Phases completed: 4/4 (v1)

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
- useLists uses module-level singleton state (mirrors useSerial.ts pattern)
- validateChannelList is permissive on optional fields, strict on freq range and required string fields
- vitest.config.mts extended to include composables/**/*.test.ts; jsdom devDep added for @vitest-environment jsdom
- FT8 entries in iaru-r1-hf.json use mode=USB with descriptive tag (FT8 is not a native FTX-1 mode label)
- Import dialog reuses all rsgb-* CSS classes — no new styles needed
- initLists() called before loadPresets() in onMounted so lists are ready when dialog opens
- watch(listImportSelectedList) resets selection set on list switch

### Blockers
None

### Key Todos
- Confirm CTCSS/DCS index bounds and clarifier range against CAT-FTX1.pdf before writing DATA-01 validation code (Phase 3)

## Session Continuity

08-02-PLAN.md complete. Next: 08-03-PLAN.md — "Manage Lists" dialog (CRUD, remote URL, export, file import).

## Last Updated
2026-05-21 (Phase 8 plan 2 complete — Import from List dialog wired into index.vue)
