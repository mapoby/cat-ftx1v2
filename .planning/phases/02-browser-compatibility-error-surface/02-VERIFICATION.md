---
phase: 02-browser-compatibility-error-surface
verified: 2026-05-09T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open app in Firefox — confirm full-page blocking message appears and no Vue content is visible"
    expected: "A full-page overlay covering the viewport with the wrong-browser message. No VFO display, no connect button rendered beneath."
    why_human: "Cannot run a browser in this environment. The gate appends a position:fixed overlay but does not stop the module script from loading — visual confirmation required."
  - test: "Open app over plain HTTP in Chrome — confirm HTTPS-required message appears (not wrong-browser message)"
    expected: "Message reads 'This page must be served over HTTPS. Web Serial requires a secure context — plain HTTP is not supported.' No mention of Chrome/Edge."
    why_human: "Requires serving over HTTP to test isSecureContext=false path. The two messages share the same gate IIFE — correct branching requires a live browser test."
  - test: "Connect to radio in Chrome, send a command the radio rejects with ?; — confirm error banner shows command name"
    expected: "Error banner with text like 'Radio rejected command: FA' appears and can be dismissed."
    why_human: "Requires physical FTX-1 radio. The error message text and wiring are verified; the end-to-end display requires hardware."
  - test: "Connect to radio in Chrome, trigger a command timeout — confirm error banner shows command name and 'radio did not respond'"
    expected: "Error banner with text like 'Radio did not respond to: ID' appears."
    why_human: "Requires triggering a genuine timeout (no radio response within 1500 ms). Needs hardware or controlled environment."
  - test: "Unplug USB while connected — confirm VFO display clears and Connected status indicator resets without page reload"
    expected: "All VFO fields blank/zero, status shows Disconnected, no stale frequency or mode data visible. Page was not reloaded."
    why_human: "Requires physical unplug event. The _handlePhysicalDisconnect handler wiring and state.value = defaultState() are verified in code."
---

# Phase 2: Browser Compatibility + Error Surface Verification Report

**Phase Goal:** Users on unsupported browsers see a clear blocking message before the app loads, and users on Chrome see actionable errors when the radio does not respond
**Verified:** 2026-05-09
**Status:** human_needed (all automated checks pass; 5 manual tests required)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening the app in Firefox or Safari shows a full-page blocking message before any Vue component renders, distinguishing "wrong browser" from "page served over HTTP" | ✓ VERIFIED (code) / ? HUMAN (visual) | Gate IIFE at lines 3-22 of generated index.html, precedes first `<script type="module">` at line 24; `hasSerial` branch produces wrong-browser message |
| 2 | Opening the app over plain HTTP shows a message explaining that HTTPS is required, not a generic Web Serial unavailable error | ✓ VERIFIED (code) / ? HUMAN (visual) | `isSecureContext` check in gate; `hasSerial=true` branch produces "This page must be served over HTTPS..." message |
| 3 | A `?;` error response from the radio is shown in the UI with the name of the command that caused it | ✓ VERIFIED (mechanism) / ? HUMAN (end-to-end) | `_handleResponse` at line 214: `` e.reject(new Error(`Radio rejected command: ${e.cmd}`)) ``; `lastError` banner in index.vue wired via catch blocks |
| 4 | A command that times out (1500 ms) is shown in the UI with the command name and a "radio did not respond" message | ✓ VERIFIED (mechanism) / ? HUMAN (end-to-end) | `_sendAndWait` timer at line 254: `` reject(new Error(`Radio did not respond to: ${cmd}`)) ``; connect() path surfaces this via `lastError` |
| 5 | Unplugging the radio clears VFO and status state without requiring a page reload | ✓ VERIFIED (code) / ? HUMAN (hardware) | `_handlePhysicalDisconnect` at line 280: guards on `event.target !== _port`, calls `_unwireSerialEvents()`, drains queue, nulls reader/writer/port, sets `state.value = defaultState()` |

**Score:** 5/5 truths verified in code; all 5 require human confirmation with hardware or controlled browser environments

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `nuxt.config.ts` | Inline gate script with `tagPriority: 'critical'` | ✓ VERIFIED | Lines 10-34: IIFE in `app.head.script` with `tagPriority: 'critical'` |
| `.output/public/index.html` | Gate script before `<script type="module">` | ✓ VERIFIED | Gate at lines 3-22, module script at line 24 |
| `composables/useSerial.ts` | Error messages with command names; disconnect wiring | ✓ VERIFIED | All three error-surface patterns confirmed |
| `pages/index.vue` | compat-warning banner removed; lastError banner present | ✓ VERIFIED | No `compat-warning` references; `lastError` ref at line 1076, rendered at lines 36-38 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Gate script | DOM | `document.createElement` before module scripts | ✓ WIRED | Sync inline script; `readyState === 'loading'` guard for safe DOMContentLoaded attachment |
| `_handleResponse` | queue entry | `e.cmd` in reject Error | ✓ WIRED | Line 214: `e.cmd` present in `QueueEntry` interface (line 158) |
| `_sendAndWait` timer | `reject` | `cmd` in timeout callback | ✓ WIRED | Line 254: `cmd` in closure, message reads "Radio did not respond to: ${cmd}" |
| `connect()` | `_handlePhysicalDisconnect` | `_wireSerialEvents()` after success | ✓ WIRED | Line 363: `_wireSerialEvents()` immediately after `_patch({ connected: true... })` |
| `disconnect()` | listener removal | `_unwireSerialEvents()` as first line | ✓ WIRED | Line 378: `_unwireSerialEvents()` before any other disconnect logic |
| `_handlePhysicalDisconnect` | state reset | `state.value = defaultState()` | ✓ WIRED | Line 287 |
| reject Error message | `lastError` banner | `catch (e: any) { lastError.value = e.message }` | ✓ WIRED (connect path) | `toggleConnection` catch at line 1758-1761 captures errors thrown by `connect()` which re-throws after cleanup |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Gate IIFE | `hasSerial`, `isSecure` | `navigator.serial`, `window.isSecureContext` | Browser runtime values | ✓ FLOWING |
| `lastError` banner | `lastError` ref | `catch (e) { lastError.value = e.message }` | Error objects from `_sendAndWait` rejections | ✓ FLOWING (connect path) |
| `state` after disconnect | `state.value` | `defaultState()` call in `_handlePhysicalDisconnect` | Fresh zero-state object | ✓ FLOWING |

**Note on SC-3/SC-4 data flow scope:** The `_sendAndWait` error messages reach `lastError` only when the caller does not swallow the rejection. The `connect()` path (which uses `_sendAndWait('ID', 2000)`) propagates errors to `lastError` via `toggleConnection`'s catch block. The `readMemoryChannel()` path silently catches and returns `null`. The success criteria and PLAN verification criteria focus on the error message text being correct and the mechanism existing — both are satisfied. The PLAN explicitly defers the end-to-end UI test to a manual test with hardware.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run generate` exits 0 | `npm run generate` | Exit code 0 | ✓ PASS |
| Gate script precedes module scripts | Line ordering in index.html | Gate lines 3-22; module line 24 | ✓ PASS |
| "Radio rejected command" string present | `grep` in useSerial.ts | 1 match at line 214 | ✓ PASS |
| "Radio did not respond to" string present | `grep` in useSerial.ts | 1 match at line 254 | ✓ PASS |
| `_handlePhysicalDisconnect` count = 3 | `grep -c` in useSerial.ts | 3 matches | ✓ PASS |
| `_wireSerialEvents()` called in connect() | `grep` in useSerial.ts | Line 363 confirmed | ✓ PASS |
| `_unwireSerialEvents()` first line of disconnect() | `grep` in useSerial.ts | Line 378 confirmed | ✓ PASS |
| `state.value = defaultState()` in disconnect handler | `grep` in useSerial.ts | Line 287 confirmed | ✓ PASS |
| Commits exist as documented | `git log` | All 4 commits present (7fa67e9, 832597e, c0526a0, 3a20940) | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COMPAT-01 | 02-01 | Wrong-browser blocking gate | ✓ SATISFIED | `hasSerial=false` branch: "Use Google Chrome or Microsoft Edge (desktop)" |
| COMPAT-02 | 02-01 | HTTPS-required blocking gate | ✓ SATISFIED | `hasSerial=true, isSecure=false` branch: "This page must be served over HTTPS" |
| ERR-01 | 02-02 | `?;` error shows command name | ✓ SATISFIED | `Radio rejected command: ${e.cmd}` at useSerial.ts line 214 |
| ERR-02 | 02-02 | Timeout shows command name + "did not respond" | ✓ SATISFIED | `Radio did not respond to: ${cmd}` at useSerial.ts line 254 |
| ERR-03 | 02-02 | Physical unplug clears state | ✓ SATISFIED | `_handlePhysicalDisconnect` with full state reset and queue drain |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `composables/useSerial.ts` line 458 | `catch { return null }` in `readMemoryChannel` — swallows `?;` and timeout errors | INFO | ERR-01/ERR-02 errors during channel scan are silent; acceptable UX trade-off per PLAN scope (manual scan retries are user-initiated) |

No blockers or structural anti-patterns found. The silent catch in `readMemoryChannel` is intentional — the PLAN's own success criteria focus on the error message mechanism, not universal propagation.

---

### Human Verification Required

#### 1. Wrong-browser gate (Firefox/Safari)

**Test:** Open `https://<deployed-url>` in Firefox or Safari desktop
**Expected:** A full-page black overlay appears with title "FTX-1 CAT Controller" and body text "Web Serial API is not supported in this browser. Use Google Chrome or Microsoft Edge (desktop)." No VFO display, no Connect button, no Vue UI visible beneath
**Why human:** Cannot run a browser in this environment; visual confirmation of overlay covering Vue-rendered content required

#### 2. HTTP gate (Chrome over plain HTTP)

**Test:** Serve `.output/public` over plain HTTP (e.g., `python -m http.server 8080`) and open `http://localhost:8080` in Chrome
**Expected:** Full-page overlay with "This page must be served over HTTPS. Web Serial requires a secure context — plain HTTP is not supported." (NOT the wrong-browser message)
**Why human:** Requires an insecure context — `isSecureContext` is false only over HTTP or non-localhost

#### 3. Radio error surface — `?;` response (ERR-01)

**Test:** Connect to FTX-1 radio in Chrome. Send a command the radio rejects (e.g., set a frequency outside the allowed range). Observe the UI.
**Expected:** Red error banner appears in the UI with message "Radio rejected command: [commandname]". Banner is dismissable.
**Why human:** Requires physical FTX-1 radio hardware

#### 4. Radio error surface — timeout (ERR-02)

**Test:** Connect to FTX-1 radio in Chrome. Disconnect the radio's serial TX line while keeping USB power, then trigger an operation that uses `_sendAndWait` (e.g., initiate connection with a non-FTX-1 device). Observe the UI.
**Expected:** Error banner with "Radio did not respond to: [cmd]"
**Why human:** Controlled timeout scenario requires hardware manipulation

#### 5. Physical disconnect recovery (ERR-03)

**Test:** Connect to FTX-1 radio in Chrome. Verify VFO shows live frequency. Unplug the USB cable. Without reloading the page, observe the UI.
**Expected:** Connected indicator switches to Disconnected. VFO frequency fields clear. No stale data. Page was not reloaded. Connect button is available again.
**Why human:** Requires physical hardware; the `disconnect` event fires only on actual USB unplug

---

### Gaps Summary

No gaps found. All automated verifications pass. Five human tests are required to confirm visual behavior, browser gate branching, and hardware integration. The code implements all required mechanisms correctly.

---

_Verified: 2026-05-09_
_Verifier: Claude (gsd-verifier)_
