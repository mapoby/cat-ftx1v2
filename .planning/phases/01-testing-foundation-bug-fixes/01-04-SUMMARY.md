---
phase: 01-testing-foundation-bug-fixes
plan: "04"
subsystem: composables
tags: [bug-fix, serial, race-condition, vfo-restore]
dependency_graph:
  requires: [01-01]
  provides: [BUG-01-fix, BUG-02-fix, BUG-04-fix]
  affects: [composables/useSerial.ts]
tech_stack:
  added: []
  patterns: [try/finally for resource restore, direct response parsing over global state reads]
key_files:
  created: []
  modified:
    - composables/useSerial.ts
decisions:
  - AI0 disable before VM011 and AI1 re-enable in finally — prevents unsolicited frames from resolving solicited queue entries during bulk scan
  - Parse CN response via resp.substring(4) directly rather than reading global state — eliminates CTCSS/DCS race condition
  - VFO save via _sendAndWait('FA') before scan, restored via VM000 + FA+origFreq in finally block — radio parked at original frequency after any scan outcome
metrics:
  duration: "~5m"
  completed: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 1
---

# Phase 1 Plan 04: Bug Fixes BUG-01, BUG-02, BUG-04 Summary

Three silent radio state corruption bugs fixed in `composables/useSerial.ts`: VFO not restored after memory scan (BUG-01), CTCSS/DCS tone index read from stale global state (BUG-02), AI unsolicited frames corrupting solicited queue responses during bulk read (BUG-04).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix scanMemoryChannels — VFO save/restore (BUG-01) and AI mode (BUG-04) | cb7d40c | composables/useSerial.ts |
| 2 | Fix readMemoryChannel — parse CN response directly (BUG-02) | 3463a14 | composables/useSerial.ts |

## What Was Built

**BUG-01 (VFO not restored after scan):** `scanMemoryChannels` now calls `_sendAndWait('FA', 1500)` before `VM011` to capture the current VFO frequency as `origFreq`. The for loop is wrapped in `try/finally`. The finally block sends `VM000` (return to VFO mode) then `FA` + `origFreq` (restore frequency), ensuring the radio returns to its pre-scan state regardless of whether the scan completes, errors, or is interrupted by disconnect.

**BUG-04 (AI unsolicited frames during bulk read):** `scanMemoryChannels` now calls `_sendAndWait('AI0', 1000)` before `VM011` to disable auto-info mode for the duration of the scan. AI mode is re-enabled via `_sendAndWait('AI1', 1000)` in the finally block after VFO restore. Each restore step is in its own inner try/catch so a failure in VM000/FA restore does not prevent AI1 from being sent.

**BUG-02 (Stale global state for CTCSS/DCS):** `readMemoryChannel` previously awaited `_sendAndWait('CN00'/'CN01')` then read `state.value.mainCtcssTone` / `state.value.mainDcsCode` — the AI unsolicited frame from the radio could overwrite those state fields in the microtask gap between the await resolve and the state read. Fixed by capturing the return value of `_sendAndWait` directly: `resp.substring(4)` extracts the 3-digit index string from the CN response (format: `'CN' + vfo(1) + type(1) + index(3)`), then `parseInt(..., 10)` with an `isNaN` guard writes the index.

## Deviations from Plan

None — plan executed exactly as written.

## TypeScript Status

`npx tsc --noEmit` produces the same 4 pre-existing errors as before this plan (SerialPort Web API type not in tsconfig lib, two null-narrowing issues on `_reader`). No new TypeScript errors introduced.

## Test Status

119/119 tests pass (`npm test` exit 0, no regressions).

## Known Stubs

None — these are bug fixes with no UI or data rendering changes.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. T-01-04 (AI1 re-enable failure leaves radio in AI0 mode) is mitigated by the best-effort try/catch in the finally block, as documented in the plan's threat register.

## Self-Check: PASSED

- composables/useSerial.ts modified: FOUND
- Commit cb7d40c (Task 1): FOUND
- Commit 3463a14 (Task 2): FOUND
- origFreqResp present in useSerial.ts: CONFIRMED (line 440)
- AI0 in scanMemoryChannels: CONFIRMED (line 443)
- AI1 in scanMemoryChannels finally: CONFIRMED (line 456)
- resp.substring(4) in readMemoryChannel: CONFIRMED (lines 418, 424)
- state.value.mainCtcssTone not in readMemoryChannel: CONFIRMED
- state.value.mainDcsCode not in readMemoryChannel: CONFIRMED
- npm test exits 0: CONFIRMED (119/119)
