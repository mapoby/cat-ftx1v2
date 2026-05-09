---
phase: 02-browser-compatibility-error-surface
plan: "02"
subsystem: serial-communication
tags: [error-surface, disconnect, cat-protocol, useSerial]
dependency_graph:
  requires: []
  provides: [ERR-01, ERR-02, ERR-03]
  affects: [composables/useSerial.ts]
tech_stack:
  added: []
  patterns: [event-listener-wiring, disconnect-recovery]
key_files:
  created: []
  modified:
    - composables/useSerial.ts
decisions:
  - "_wireSerialEvents / _unwireSerialEvents placed before _handlePhysicalDisconnect for forward-reference clarity (function hoisting makes order irrelevant at runtime, but declaration order communicates intent)"
  - "grep -c count for _wireSerialEvents is 2 (not 4 as plan estimated) — _unwireSerialEvents does not contain _wireSerialEvents as a substring; implementation is correct"
metrics:
  duration_minutes: 10
  completed_date: "2026-05-09"
  tasks_completed: 2
  files_modified: 1
---

# Phase 2 Plan 02: Error Surface Fixes Summary

Targeted three error-surfacing gaps in `composables/useSerial.ts`: actionable command names in `?;` error and timeout messages, plus physical disconnect recovery via the Web Serial `disconnect` event.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | ERR-01 + ERR-02: command name in error messages | c0526a0 |
| 2 | ERR-03: wire serial disconnect event | 3a20940 |

## Changes Made

**ERR-01** (`_handleResponse`): `'CAT error response'` → `` `Radio rejected command: ${e.cmd}` ``

**ERR-02** (`_sendAndWait` timer): `` `Timeout: ${cmd}` `` → `` `Radio did not respond to: ${cmd}` ``

**ERR-03** (new functions + wiring):
- Added `_wireSerialEvents()` — attaches `disconnect` listener on `navigator.serial`
- Added `_unwireSerialEvents()` — removes the listener
- Added `_handlePhysicalDisconnect(event)` — guards with `event.target !== _port`, calls `_unwireSerialEvents()`, drains queue with `'Serial port disconnected'`, releases reader/writer, nulls port, resets `state.value = defaultState()`
- Called `_wireSerialEvents()` at end of `connect()` success path
- Called `_unwireSerialEvents()` as first line of `disconnect()`

## Deviations from Plan

**1. [Rule 1 - Documentation] grep count for _wireSerialEvents**
- **Found during:** Task 2 verification
- **Issue:** Plan estimated `grep -c "_wireSerialEvents"` = 4, reasoning that `_unwireSerialEvents` contains `_wireSerialEvents` as a substring. It does not — the `_un` prefix breaks the match.
- **Fix:** Confirmed implementation is correct with 2 occurrences of `_wireSerialEvents` (function definition + `connect()` call). The critical verification — `grep -c "_handlePhysicalDisconnect"` = 3 — passes exactly.
- **Files modified:** none (documentation-only deviation)

## Self-Check: PASSED

- `composables/useSerial.ts` modified: confirmed
- Commit `c0526a0` exists: confirmed
- Commit `3a20940` exists: confirmed
- `grep -c "Radio rejected command" composables/useSerial.ts` = 1: confirmed
- `grep -c "Radio did not respond to" composables/useSerial.ts` = 1: confirmed
- `grep -c "_handlePhysicalDisconnect" composables/useSerial.ts` = 3: confirmed
- `npm run generate` exits 0: confirmed
