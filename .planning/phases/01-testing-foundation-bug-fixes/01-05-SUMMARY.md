---
phase: 01-testing-foundation-bug-fixes
plan: 05
subsystem: ui
tags: [vue3, nuxt3, web-serial, cat-protocol, bug-fix]

# Dependency graph
requires: []
provides:
  - BUG-01 template fix: MOX badge and PresetButtons disabled during radioMemScanning
  - BUG-03 fix: toggleRfSql uses dedicated rfSqlBusy flag, null-safe sqlRfMode
  - BUG-05 fix: activeTab watcher sends AI0/AI1 on channel tab transitions
affects: [02-browser-compat, 03-data-integrity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedicated busy flag per async toggle function (rfSqlBusy pattern)"
    - "Tab-aware AI mode management via watch(activeTab, ...)"
    - "Scan-aware TX gate via :connected && !radioMemScanning"

key-files:
  created: []
  modified:
    - pages/index.vue

key-decisions:
  - "Use dedicated rfSqlBusy ref rather than reusing preAmpBusy — avoids cross-function lock contention"
  - "activeTab watcher placed immediately after ref declaration for discoverability"
  - "TX disable during scan implemented via existing connected/clickable props — no new props needed"

patterns-established:
  - "Each toggle function owns its own busy flag — no shared flags between unrelated toggles"
  - "Tab lifecycle sends AI0 (disable auto-info) on entry, AI1 (re-enable) on exit"

requirements-completed:
  - BUG-01
  - BUG-03
  - BUG-05

# Metrics
duration: 10min
completed: 2026-05-08
---

# Phase 1 Plan 05: Index.vue Bug Fixes (BUG-01, BUG-03, BUG-05) Summary

**Three index.vue bug fixes: rfSqlBusy dedicated flag with null-safe sqlRfMode, AI0/AI1 on channel tab switch, and TX controls disabled during memory scan**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-08T00:00:00Z
- **Completed:** 2026-05-08T00:10:00Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Fixed toggleRfSql to use its own rfSqlBusy flag — no longer incorrectly locked/unlocked by preAmpBusy, and no longer throws on null sqlRfMode
- Added activeTab watcher that sends AI0 when entering the channels tab and AI1 when leaving, preventing race conditions during channel reads
- MOX StatusBadge and PresetButtons are now non-interactive while radioMemScanning is true, preventing TX commands during a scan

## Task Commits

1. **Task 1: Fix toggleRfSql — dedicated busy flag and remove preAmpHf guard (BUG-03)** - `e054d6d` (fix)
2. **Task 2: Add activeTab watcher to send AI0/AI1 on tab switch (BUG-05)** - `3b68532` (fix)
3. **Task 3: Disable TX controls during memory scan (BUG-01 template portion)** - `426a05b` (fix)

## Files Created/Modified

- `pages/index.vue` — Added rfSqlBusy ref, fixed toggleRfSql, added activeTab watcher, patched MOX :clickable and PresetButton :connected bindings

## Decisions Made

- Used dedicated rfSqlBusy ref rather than reusing preAmpBusy to avoid cross-function lock contention between togglePreAmpHf and toggleRfSql
- activeTab watcher placed immediately after the activeTab declaration (line 1090) for discoverability
- TX gate implemented via existing props (clickable, connected) rather than adding new props — no component API changes needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `composables/useSerial.ts` (SerialPort type not found) appeared in tsc output but are unrelated to index.vue. No errors in index.vue in any task.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUG-01 template portion complete; BUG-01 has a script portion (scanRadioMemory finally block) that was handled in plan 04
- BUG-03 and BUG-05 fully resolved
- index.vue changes are independent of the catParser extraction (plans 01-04) and can coexist without merge conflicts

---
*Phase: 01-testing-foundation-bug-fixes*
*Completed: 2026-05-08*
