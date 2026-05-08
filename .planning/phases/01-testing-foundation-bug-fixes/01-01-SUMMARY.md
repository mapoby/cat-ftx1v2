---
phase: 01-testing-foundation-bug-fixes
plan: "01"
subsystem: composables
tags: [refactor, parser, testability]
dependency_graph:
  requires: []
  provides: [catParser.ts, defaultState export]
  affects: [composables/useSerial.ts, composables/catParser.ts]
tech_stack:
  added: []
  patterns: [pure-function extraction, module-level state isolation]
key_files:
  created:
    - composables/catParser.ts
  modified:
    - composables/useSerial.ts
decisions:
  - Import MODE_CODE in useSerial.ts in addition to parseResponse — writeMemoryChannel uses it
  - Use delta != null guard (not !== undefined) to narrow number | null to number for _fireScopeRequery parameter
metrics:
  duration: "5m 6s"
  completed: "2026-05-08T17:00:05Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 1 Plan 01: CAT Parser Extraction Summary

Pure CAT response parser extracted from useSerial.ts into composables/catParser.ts — zero Vue or Web Serial dependencies, enabling Node-environment unit testing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create composables/catParser.ts | 8767d0a | composables/catParser.ts (created) |
| 2 | Update useSerial.ts — import catParser, remove _parseResponse, export defaultState, add _fireScopeRequery | 0f6454c | composables/useSerial.ts (modified) |

## What Was Built

`composables/catParser.ts` is a pure TypeScript module with a single type import from `./useSerial`. It exports:
- `parseResponse(cmd, params, current, sourceCmd?)` — the extracted CAT decoder, pure function returning `Partial<TransceiverState>`
- `MODE_MAP`, `MODE_CODE`, `AGC_MAP`, `FUNC_KNOB` — four decode maps used by the parser and by `writeMemoryChannel`

`composables/useSerial.ts` changes:
- Removed 300+ lines: `_parseResponse` function and all four decode maps
- Added import of `parseResponse` and `MODE_CODE` from `./catParser`
- `defaultState` is now exported (required for test fixtures)
- `_handleResponse` delegates to `parseResponse` via `const delta = parseResponse(...)` then `_patch(delta)`
- `_fireScopeRequery(side: number)` added — handles the serial side-effect that was previously inlined in the FD case

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] MODE_CODE import added to useSerial.ts**
- **Found during:** Task 2 verification (TypeScript compile)
- **Issue:** Plan's Edit 1 only mentioned importing `parseResponse`, but `writeMemoryChannel` at line 442 uses `MODE_CODE` which was also removed from useSerial.ts
- **Fix:** Added `MODE_CODE` to the import: `import { parseResponse, MODE_CODE } from './catParser'`
- **Files modified:** composables/useSerial.ts
- **Commit:** 0f6454c

**2. [Rule 1 - Bug] Null guard narrowing fix for _fireScopeRequery**
- **Found during:** Task 2 TypeScript compile
- **Issue:** Plan used `delta.scopeSide !== undefined` but `scopeSide: number | null` — TypeScript still sees `number | null` after that check, causing TS2345 on the `_fireScopeRequery(number)` call
- **Fix:** Changed to `delta.scopeSide != null` which narrows `number | null` to `number`
- **Files modified:** composables/useSerial.ts
- **Commit:** 0f6454c

## TypeScript Status

Pre-existing errors (4) remain in useSerial.ts — all are about `SerialPort` Web API type not being in the project's tsconfig lib, and two null-narrowing issues on `_reader`. These were present before this plan and are not regressions. No new TypeScript errors introduced.

## Known Stubs

None — this plan is a pure refactor with no UI or data rendering.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- composables/catParser.ts: FOUND
- composables/useSerial.ts modified: FOUND
- Commit 8767d0a: FOUND
- Commit 0f6454c: FOUND
- No Vue imports in catParser.ts: CONFIRMED (grep returns 0)
- _parseResponse removed: CONFIRMED
- defaultState exported: CONFIRMED
- parseResponse exported: CONFIRMED
