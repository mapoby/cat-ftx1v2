# Production-Ready CAT Controller Features

**Domain:** Browser-based hardware serial CAT controller (single-radio, public-facing web app)
**Researched:** 2026-05-08
**Scope:** Yaesu FTX-1, Web Serial API, Chromium-only, no backend

---

## Table Stakes (must-haves for public release)

These are the features a stranger landing on the app expects to work correctly.
Missing any of these leaves users with a broken or unsafe experience.

### 1. Hard browser-compatibility gate before any UI loads

**What:** A full-page blocking message (not a dismissable banner) that fires before the Nuxt bundle renders, directing users to Chrome or Edge.

**Why table stakes:** Firefox and Safari users will see a blank/broken app and blame the software. A passive banner that appears after the page loads is insufficient — the bundle downloads, Vue initialises, components render, then the warning shows. A Chromium-only tool must gate at `<noscript>` or a tiny pre-bundle `<script>` in `index.html`.

**Current state:** Passive warning banner only. Fails the public-release bar.

**Accepted implementation pattern:**
```html
<!-- in index.html, before bundle script tag -->
<script>
  if (!('serial' in navigator)) {
    document.body.innerHTML = '<div class="unsupported">...Chrome/Edge required...</div>';
    throw new Error('Web Serial not supported');
  }
</script>
```

**Confidence:** HIGH — Chrome team docs and WICG spec both confirm the API is Chromium-only with no polyfill path.

---

### 2. Visible, non-silent error surface for every radio command

**What:** When the radio returns `?;` (error) or a command times out, the user sees a clearly attributed error message. The message names the operation that failed (e.g., "RF/SQL toggle failed — radio returned error") not just a generic "error".

**Why table stakes:** The app writes to radio hardware. Silent failures corrupt memory channels, leave the radio in an unknown state, and destroy user trust. Amateur radio operators are technically literate — they will notice discrepancies and will lose confidence in the tool if it says "done" when the radio rejected the command.

**Current state:** Fire-and-forget `send()` silently drops `?;` for non-queued commands. `toggleRfSql()` has a wrong guard (`preAmpHf === null` blocks RF/SQL operations). Some callers in `index.vue` do surface errors via `lastError`, but the composable layer doesn't propagate failures from the most common code path.

**Confidence:** HIGH — directly supported by the CONCERNS.md audit and WICG spec error taxonomy (`NetworkError`, `InvalidStateError`, framing errors).

---

### 3. Clean disconnect/reconnect without page reload

**What:** After an unexpected disconnect (USB cable pulled, radio powered off), the app:
- immediately clears stale VFO/status state (no stale frequency reading displayed)
- shows a clear "Disconnected" state
- allows re-connecting without a page reload
- drains the command queue without leaving orphaned timeout timers

**Why table stakes:** Serial devices disconnect routinely — radio powered off, cable wobble, sleep. Any tool that requires a page reload on disconnect is not suitable for real operating sessions. The Chrome Serial Terminal (reference implementation) and all production serial tools handle this gracefully.

**Current state:** The composable calls `_drainQueue()` on disconnect, which is correct. The `connect`/`disconnect` event listeners from `navigator.serial` are not wired. VFO state is not zeroed on disconnect. Reconnect works but relies on the user clicking Connect again with no prompting.

**Confidence:** HIGH — Chrome official docs explicitly call out `connect`/`disconnect` event listeners as a required pattern.

---

### 4. Memory write confirmation with success/failure per slot

**What:** When writing a channel to radio memory, the user receives explicit per-write feedback: "Channel 42 written" or "Channel 42 failed — timeout". Not a spinner that disappears.

**Why table stakes:** Memory writes are destructive. The FTX-1 has no read-back-and-verify path; if a write silently fails halfway through (e.g., `AM` succeeds, `MZ` fails), the slot exists with incomplete data. Users need to know whether to trust the radio's memory state.

**Current state:** `writeChannelToRadio` uses `send()` (fire-and-forget) for all sub-commands. The composable has no partial-completion recovery. Callers wrap in try/catch but only surface a generic error, not which step failed.

**Confidence:** HIGH — directly derived from the CONCERNS.md findings on `writeMemoryChannel()` and the hardware limitation that delete = overwrite.

---

### 5. CSV import validation with per-row error summary

**What:** Importing a CSV file validates each row before writing anything: frequency range (100 kHz – 60 MHz for HF), mode codes against the FTX-1 mode list, slot number 1–999, non-empty required fields. An error summary ("3 rows skipped: rows 4, 17, 22 — reason") is shown before any rows are applied.

**Why table stakes:** A malformed CSV that silently overwrites memory slots with invalid data is a data integrity failure. Users export from other tools, hand-edit CSVs, or import from community-shared files. Garbage in must not reach the radio.

**Current state:** No schema validation exists. Malformed CSV rows reach the channel list and produce `?;` when written.

**Confidence:** HIGH — audit finding, standard expectation for any data import feature.

---

### 6. Prominent protocol-limitation disclosure in the UI

**What:** The Channel List UI contains a persistent, non-dismissable indicator (badge, tooltip, or help text) on Delete and Wipe controls explaining that "Delete overwrites with blank values — the slot number is not removed from radio memory."

**Why table stakes:** The FTX-1 has no delete command. Users who perform a delete and then look at the radio panel or export via another tool will see 29 MHz / USB placeholder entries and conclude the app is broken. This misconception must be prevented at the interaction point, not buried in release notes.

**Current state:** Documented in a code comment and in the wipe confirmation dialog only. Not shown on the delete controls.

**Confidence:** HIGH — audit finding. Hardware limitation confirmed by the `?;` response to `MW` with `P7=0`/`P7=4`.

---

### 7. Memory scan VFO restore and safe-state after error

**What:** `scanMemoryChannels()` saves the pre-scan VFO frequency at the start and restores it when the scan completes normally or on any error/disconnect. TX controls are disabled during scan. The operator's operating frequency is not permanently replaced by the last scanned channel.

**Why table stakes:** Scanning 99 channels currently cycles the radio through 99 frequencies and leaves it on channel 99 at the end. If the operator was transmitting a net frequency, the scan silently moved them off it. For an HF transceiver this is a safety and operating concern.

**Current state:** No save/restore. No TX disable during scan. No try/finally in scan loop.

**Confidence:** HIGH — audit finding, confirmed in CONCERNS.md under "readMemoryChannel() mutates live VFO state".

---

### 8. HTTP vs HTTPS detection with actionable error

**What:** When the page is served over plain HTTP on a non-localhost origin, display an actionable message: "Web Serial requires HTTPS. This page is being served over HTTP — serial connections will not work." Do not wait for the user to click Connect and receive a browser error.

**Why table stakes:** Docker users running `docker run -p 8080:80` from a non-local host will get a non-functional app with no explanation. The browser silently refuses to expose `navigator.serial` (or sets it to `undefined`) on non-secure origins.

**Current state:** Not implemented. The `isSupported` flag checks `'serial' in navigator` but does not distinguish the HTTPS-missing case from the Firefox case.

**Confidence:** HIGH — WICG spec requires secure context; Chrome docs confirm.

---

## Differentiators (nice to have for public release, valued by operators)

### 1. Auto-reconnect after USB reconnect

Listen for `navigator.serial` `connect` events. If the reconnected port matches a previously-used port (check `getPorts()`), offer a one-click reconnect or reconnect automatically. Significantly improves operating session experience. — MEDIUM confidence (Chrome 89+ feature, well-documented)

### 2. Connection status always visible

A persistent connection indicator in a fixed header position (connected/disconnected/connecting) so the user never has to scroll up to verify serial state during an operating session. Most professional hardware control tools have this as a fixed-position element.

### 3. Per-command undo for preset sequences

Show which preset commands succeeded and which failed, with the ability to re-run just the failed commands. PresetButton already shows ok/error per command in aggregate; per-command visibility is the upgrade.

### 4. Busy-state lockout during memory operations

Disable the Connect/Disconnect button and the Channel List controls while a scan or bulk write is in progress. Prevents user from triggering a second scan before the first completes, which would race on the VFO state.

### 5. Slot-range validation before bulk write

Before writing a batch of channels, verify all target slot numbers fit within 1–999 and warn on potential overwrites of existing non-blank slots. "You are about to overwrite 3 slots that already have data: 42, 43, 44. Continue?"

### 6. Export of radio memory (not just localStorage channels)

Allow exporting the scanned radio memory as CSV. Currently CSV export operates on `savedChannels` (localStorage). Users who have manually programmed the radio via its front panel want to export what's in the radio, not what's in the app's local copy.

### 7. Baud rate auto-detection or sticky last-used value

Persist the last-used baud rate to localStorage so users do not have to re-select 38400 on every page load. A minor friction reduction with high return for regular users.

### 8. Keyboard shortcuts for common VFO operations

Band up/down, mode cycle, XIT/RIT clear. Standard in desktop CAT software (Ham Radio Deluxe, Log4OM). Not expected in a web tool but distinguishes a power-user tool.

---

## Anti-Features (explicitly do not add)

### 1. Mobile browser support
Web Serial API has zero implementation on any mobile browser (iOS Safari, Chrome for Android, Firefox for Android). Building mobile-specific UI paths would consume significant effort for a permanently non-functional experience. The app is a desktop operator tool.

### 2. Multi-radio support
The app identity-checks for FTX-1 (`ID0840`). Adding support for other Yaesu radios or other brands would require maintaining multiple protocol decoders with separate test suites, and would compete with general-purpose tools (hamlib, flrig) that already exist. Focus beats breadth for a purpose-built tool.

### 3. Real-time multi-user / remote operation
Web Serial is single-port, single-tab. Remote operation over a WebSocket bridge belongs to a separate project (RemoteHams, SDR-Radio, etc.), not this tool.

### 4. In-app firmware update
CAT protocol does not support firmware writes. Any firmware update path would require a native utility. Do not create an expectation the web app cannot fulfil.

### 5. Logging/logbook integration
Adding a built-in QSO log would expand scope enormously (callsign lookup, ADIF export, duplicate checking, award tracking). This competes with dedicated logging software that operators already use. Provide frequency/mode data that loggers can read via CAT — don't be the logger.

### 6. Spectrum display / panadapter
The FTX-1 has a band scope but the scope data is control-only (span, speed, mode, level) via CAT — it does not stream IQ or spectral data over the CAT port. A spectrum display would require SDR hardware, not CAT. Do not imply this capability.

---

## Production Hardening Checklist: Web Serial Apps

Items specific to the browser-native serial use case that generic web app checklists miss.

### Error handling

- [ ] Distinguish `NotFoundError` (user dismissed port picker) from `NetworkError` (port failed) from `SecurityError` (HTTPS/permissions) — show specific messages for each
- [ ] Inner + outer read loop: inner catches non-fatal framing/parity/overflow errors and creates a new reader; outer monitors `port.readable === null` for fatal device removal
- [ ] `?;` error responses from radio are surfaced to the UI with the originating command name, not silently dropped
- [ ] Command timeout (currently 1500 ms) shows a named timeout in the error state: "FA query timed out after 1.5s"
- [ ] All async handlers in `index.vue` catch and display errors — no unhandled promise rejections reachable from UI interactions
- [ ] `writeMemoryChannel()` partial-completion risk is documented (caller-level handling already exists)

### Disconnect / reconnect

- [ ] `navigator.serial` `connect` and `disconnect` event listeners wired; UI state updated immediately on device removal
- [ ] On disconnect: stale VFO/mode/status state cleared to `null` or placeholder `---`, not left showing last-known values
- [ ] On disconnect: pending command queue drained (already exists via `_drainQueue`)
- [ ] Reconnect is available from the disconnected state without page reload (already works; add navigator.serial `connect` event to prompt re-connect)
- [ ] Scan and write operations are interrupted cleanly on disconnect (try/finally + VFO restore)

### Browser compatibility messaging

- [ ] Pre-bundle browser gate (inline `<script>` in `index.html`) blocks non-Chromium browsers before the Nuxt app loads
- [ ] Gate distinguishes "browser unsupported" from "page served over HTTP" — both make `navigator.serial` unavailable but require different user actions
- [ ] Passive in-app banner remains as secondary indicator for Chromium users who disable the serial permission
- [ ] `color-mix()` CSS fallback provided for non-Chromium contexts that might render the page (e.g., search engine previews, screenshot tools)

### Data integrity (memory channel writes)

- [ ] CSV import: per-row validation with error summary before applying any rows
- [ ] CSV import: frequency range check (100 kHz – 60 MHz), mode code check against FTX-1 `MODE_MAP`, slot number 1–999
- [ ] Channel write: explicit per-slot success/failure feedback, not aggregate spinner
- [ ] Memory scan: VFO saved before scan, restored in `finally` block on completion or error
- [ ] Memory scan: TX controls locked during scan
- [ ] Delete/wipe: persistent UI explanation that delete = overwrite (not just in the confirmation dialog)
- [ ] Baud rate constant centralised to a single source of truth (currently duplicated between `useSerial.ts` and `index.vue`)

### Testing coverage expectations

- [ ] `_parseResponse()` extracted to a pure function (no port/state dependencies) and covered with fixture-driven unit tests — this is the highest-value test target (30+ decoders, 0 tests today)
- [ ] Each CAT opcode decoder (FA, FB, MD, SM, RM, TX, MR, MZ, MT, SS, VE, EX, RI, etc.) has at minimum one happy-path and one malformed-input test
- [ ] Error injection tests: `?;` response consumed by queue entry, timeout path, partial frame in buffer
- [ ] CSV import validation logic covered: valid row, out-of-range frequency, invalid mode, slot > 999
- [ ] No E2E tests required for this milestone — serial hardware is unavailable in CI; unit tests on pure logic are the achievable bar
- [ ] Test runner: Vitest (already ships with Nuxt 3 / Vite; zero extra config; runs in Node without browser)

### Security / deployment

- [ ] Content Security Policy header in nginx covering `self`, `unsafe-inline` (required by Nuxt), and `https://api-beta.rsgb.online`
- [ ] ACR admin credentials replaced with managed identity (`AcrPull` role on system-assigned identity)
- [ ] `package-lock.json` committed; Dockerfile uses `npm ci`
- [ ] RSGB API base URL extracted to a named constant (not inline in multiple fetch calls)
- [ ] `magic-regexp` unused dependency removed

---

## Confidence Levels

| Area | Level | Basis |
|------|-------|-------|
| Browser compatibility gate requirement | HIGH | WICG Serial spec (secure context required), Chrome docs (Chromium-only), confirmed no polyfill |
| Error handling patterns (inner/outer loop, event listeners) | HIGH | Chrome official serial docs, WICG spec error taxonomy |
| Memory write data integrity requirements | HIGH | Audit findings in CONCERNS.md, hardware protocol confirmed |
| VFO restore during scan | HIGH | Audit finding, hardware behaviour confirmed |
| CSV import validation | HIGH | Audit finding; standard practice for any data import |
| Testing scope (Vitest, pure function extraction) | HIGH | Nuxt 3 ships Vitest; Web Serial unavailable in Node is a known constraint |
| Differentiator features (auto-reconnect, keyboard shortcuts) | MEDIUM | Chrome docs confirm `connect`/`disconnect` events exist; operator value is inference from desktop CAT tool conventions |
| Anti-feature judgements (mobile, multi-radio, logging) | HIGH | Web Serial mobile support confirmed absent; scope judgements derived from PROJECT.md Out of Scope list |
