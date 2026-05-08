---
phase: 01-testing-foundation-bug-fixes
verified: 2026-05-08T23:07:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 1: Testing Foundation + Bug Fixes — Verification Report

**Phase Goal:** The CAT parsing logic is reliably tested in CI and the three production bugs that corrupt radio state are fixed
**Verified:** 2026-05-08T23:07:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm test` runs 30+ Vitest assertions covering all CAT opcodes and passes clean in a Node environment with no serial hardware | VERIFIED | Live run: 119/119 tests pass, 44 describe blocks covering all 40 opcodes + maps sanity |
| 2 | CI fails the Docker build if any test fails; a coverage artifact is attached to each CI run | VERIFIED | `Run tests` step at line 35 precedes `Build and push Docker image` at line 58; `upload-artifact@v4` with `if-no-files-found: warn` present |
| 3 | Memory channel scan completes and the radio VFO is left on the frequency it had before the scan started, even if the scan errors mid-run | VERIFIED | `scanMemoryChannels` saves `origFreq` via `_sendAndWait('FA', 1500)` before `VM011`; for-loop wrapped in `try/finally`; finally block sends `VM000` then `FA+origFreq` (guarded by `if (origFreq)`), then `AI1` |
| 4 | `toggleRfSql()` executes without throwing and does not require `preAmpHf` to be non-null | VERIFIED | `toggleRfSql` guards on `rfSqlBusy.value` only, uses `sqlRfMode ?? 0`, both sends under single `try/finally` with `rfSqlBusy.value = false` |
| 5 | `readMemoryChannel()` reads CTCSS/DCS tone from the command response, not from stale global state | VERIFIED | Uses `const resp = await _sendAndWait('CN00', 1000)` then `parseInt(resp.substring(4), 10)`; no occurrences of `state.value.mainCtcssTone` or `state.value.mainDcsCode` in `readMemoryChannel` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `composables/catParser.ts` | Pure CAT response parser, no Vue/serial imports | VERIFIED | Single import: `import type { TransceiverState } from './useSerial'`; exports `parseResponse`, `MODE_MAP`, `MODE_CODE`, `AGC_MAP`, `FUNC_KNOB`; no Vue or Web Serial imports |
| `composables/useSerial.ts` | Delegates parsing to catParser, exports defaultState | VERIFIED | `export function defaultState()` at line 121; `import { parseResponse, MODE_CODE } from './catParser'` at line 6; `_parseResponse` absent; `_patch(parseResponse(...))` pattern at lines 224-225 and 232-233 |
| `vitest.config.mts` | Vitest config: node environment, test/unit include pattern | VERIFIED | Contains `environment: 'node'`, `include: ['test/unit/**/*.{test,spec}.ts']`, `provider: 'v8'`, `include: ['composables/catParser.ts']` for coverage |
| `package.json` | Test scripts and vitest devDependencies | VERIFIED | `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`; `"vitest": "^4.1.5"`, `"@vitest/coverage-v8": "^4.1.5"`, `"@types/w3c-web-serial": "^1.0.8"` |
| `test/unit/catParser.test.ts` | Full opcode coverage test suite, 300+ lines | VERIFIED | 779 lines; 44 describe blocks; 119 test cases; imports `parseResponse` from catParser and `defaultState` from useSerial |
| `.github/workflows/azure-deploy.yml` | CI pipeline with test gate before build | VERIFIED | `Run tests` (line 35) with `run: npm test` precedes `Build and push Docker image` (line 58); `actions/setup-node@v4` and `actions/upload-artifact@v4` present |
| `pages/index.vue` | Bug-fixed UI component | VERIFIED | `rfSqlBusy` ref declared at line 1079; `watch(activeTab, ...)` at line 1084 with AI0/AI1; `:clickable="!radioMemScanning"` on MOX badge (line 298); `:connected="state.connected && !radioMemScanning"` on PresetButton (line 416) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useSerial.ts` | `catParser.ts` | `import { parseResponse, MODE_CODE } from './catParser'` | WIRED | Line 6 of useSerial.ts |
| `_handleResponse` | `parseResponse` | `const delta = parseResponse(prefix, ...)` then `_patch(delta)` | WIRED | Lines 224-226 (solicited) and 232-234 (unsolicited) |
| `scanMemoryChannels` | VFO restore | `finally` block with `VM000`, `FA+origFreq`, `AI1` | WIRED | Lines 458-464 of useSerial.ts |
| `readMemoryChannel` | CN response | `resp.substring(4)` — direct parse of return value | WIRED | Lines 421-424 and 427-430 of useSerial.ts |
| `activeTab watcher` | `send('AI0')` / `send('AI1')` | `watch(activeTab, async (newTab, oldTab) => ...)` | WIRED | Lines 1084-1091 of index.vue |
| `toggleRfSql` | `rfSqlBusy` | `if (rfSqlBusy.value) return` / `rfSqlBusy.value = true/false` | WIRED | Lines 1844-1853 of index.vue |
| MOX StatusBadge | `radioMemScanning` | `:clickable="!radioMemScanning"` | WIRED | Line 298 of index.vue |
| PresetButton | `radioMemScanning` | `:connected="state.connected && !radioMemScanning"` | WIRED | Line 416 of index.vue |
| `package.json scripts.test` | `vitest run` | `"test": "vitest run"` | WIRED | package.json line 13 |
| CI `Run tests` step | Docker build step | Sequential step ordering — test failure halts job | WIRED | Run tests at line 35, Build at line 58 |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces a pure-function module (catParser.ts) and bug fixes to serial command logic. No components rendering dynamic data from a database or API were modified.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm test` runs 30+ assertions, exits 0 | `npm test` | 119 passed (119), exit 0 | PASS |
| `catParser.ts` importable in Node without errors | Confirmed by test run importing the module | Tests pass with 0 import errors | PASS |
| `useSerial.ts` exports `defaultState` | `grep "export function defaultState" composables/useSerial.ts` | Found at line 121 | PASS |
| `_parseResponse` removed from `useSerial.ts` | `grep "function _parseResponse" composables/useSerial.ts` | No matches | PASS |
| `state.value.mainCtcssTone` absent from `readMemoryChannel` | `grep "state\.value\.mainCtcssTone" composables/useSerial.ts` | No matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TEST-01 | 01-01 | catParser.ts extracted as pure function module with no Vue or Web Serial dependencies | SATISFIED | `composables/catParser.ts` exists; only import is `import type { TransceiverState } from './useSerial'`; no vue or serial imports |
| TEST-02 | 01-03 | `parseResponse()` unit tested with Vitest covering all 30+ CAT opcodes | SATISFIED | 119 passing tests across 44 describe blocks covering all 40 opcodes; FD isolation, MR merge, VE spread contracts locked |
| TEST-03 | 01-01 | `defaultState()` exported from `useSerial.ts` | SATISFIED | `export function defaultState()` at line 121 of useSerial.ts; used as test fixture factory in catParser.test.ts |
| TEST-04 | 01-02, 01-06 | Vitest runs in CI before Docker build; build fails on test failure | SATISFIED | `Run tests` step (line 35) with `npm test` precedes Docker build step (line 58); sequential ordering guarantees failure halts job |
| TEST-05 | 01-02, 01-06 | Coverage report generated and available in CI artifacts | SATISFIED | `actions/upload-artifact@v4` with `name: coverage-${{ github.sha }}`, `path: coverage/`, `if-no-files-found: warn` |
| BUG-01 | 01-04, 01-05 | scanMemoryChannels saves VFO before scan, restores in finally; TX controls disabled during scan | SATISFIED | `origFreq` saved before scan; `try/finally` restores via `VM000` + `FA+origFreq`; MOX `:clickable="!radioMemScanning"` and PresetButton `:connected="state.connected && !radioMemScanning"` |
| BUG-02 | 01-04 | readMemoryChannel reads CTCSS/DCS from _sendAndWait return value, not global state | SATISFIED | `resp.substring(4)` used directly; `state.value.mainCtcssTone` / `state.value.mainDcsCode` absent from readMemoryChannel |
| BUG-03 | 01-05 | toggleRfSql uses dedicated rfSqlBusy flag; preAmpHf guard removed | SATISFIED | `if (rfSqlBusy.value) return`, `rfSqlBusy.value = true`, `sqlRfMode ?? 0`; no preAmpHf check in function |
| BUG-04 | 01-04 | Memory scan disables AI0 before bulk reads, re-enables AI1 after | SATISFIED | `_sendAndWait('AI0', 1000)` before VM011; `_sendAndWait('AI1', 1000)` in finally block |
| BUG-05 | 01-05 | Channel List tab switch sends AI0 on entry, AI1 on exit | SATISFIED | `watch(activeTab, ...)` at line 1084; sends `AI0` when `newTab === 'channels'`, `AI1` when `oldTab === 'channels'` |

**Note:** REQUIREMENTS.md traceability table still shows TEST-01, TEST-03, and BUG-01 through BUG-05 as unchecked (Pending). This is a documentation artifact — the checkbox status in REQUIREMENTS.md was not updated as part of the phase work. The code satisfies all requirements. The REQUIREMENTS.md checkboxes should be updated separately.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, empty handlers, or stub implementations found in the modified files. `toggleRfSql` no longer has the split try/finally pattern. All handlers use real logic.

### Human Verification Required

None. All phase success criteria are programmatically verifiable and confirmed.

### Gaps Summary

None. All 5 ROADMAP success criteria are VERIFIED. All 10 requirement IDs (TEST-01 through TEST-05, BUG-01 through BUG-05) are satisfied by code evidence. `npm test` exits 0 with 119 passing assertions. The phase goal — "CAT parsing logic reliably tested in CI and three production bugs that corrupt radio state are fixed" — is achieved.

---

_Verified: 2026-05-08T23:07:00Z_
_Verifier: Claude (gsd-verifier)_
