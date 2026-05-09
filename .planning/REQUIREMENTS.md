# Requirements: CAT FTX-1 Controller

**Defined:** 2026-05-08
**Core Value:** A connected operator can control every aspect of their FTX-1 from a browser tab without touching the radio.

## v1 Requirements

### Testing

- [ ] **TEST-01**: CAT protocol parsing logic is extracted into a pure function module (`catParser.ts`) with no Vue or Web Serial dependencies
- [x] **TEST-02**: `parseResponse()` is unit tested with Vitest covering all 30+ CAT opcodes including edge cases
- [ ] **TEST-03**: `defaultState()` is exported from `useSerial.ts` so tests can construct a valid base state without duplication
- [x] **TEST-04**: Vitest runs in CI (GitHub Actions) before the Docker build step and fails the build on test failure
- [x] **TEST-05**: Test coverage report is generated and available in CI artifacts

### Bug Fixes

- [ ] **BUG-01**: `scanMemoryChannels()` saves VFO frequency before scan and restores it in a `try/finally` block; TX controls are disabled during scan
- [ ] **BUG-02**: `readMemoryChannel()` reads CTCSS/DCS tone directly from the `_sendAndWait()` return value, not from global `state.value.mainCtcssTone`
- [ ] **BUG-03**: `toggleRfSql()` uses a dedicated `rfSqlBusy` flag and removes the incorrect `preAmpHf === null` guard
- [ ] **BUG-04**: Memory scan disables AI mode (`AI0`) before bulk reads and re-enables it (`AI1`) after, preventing unsolicited frames from resolving solicited queue entries with stale data
- [ ] **BUG-05**: Switching to the Channel List tab sends `AI0` to disable Auto Information mode; switching away sends `AI1` to re-enable it

### Browser Compatibility

- [x] **COMPAT-01**: An inline `<script>` before the Nuxt bundle detects Web Serial API support and renders a blocking full-page message for unsupported browsers, distinguishing "wrong browser" from "page served over HTTP/non-localhost"
- [x] **COMPAT-02**: When `isSupported` is false due to a non-secure context (HTTP on non-localhost), the error message explains that HTTPS is required and Web Serial is not a configuration issue

### Error Surface

- [x] **ERR-01**: `?;` error responses from the radio are surfaced to the user with the originating command name, not silently dropped
- [x] **ERR-02**: Command timeout (1500 ms) is surfaced with the originating command name and a "radio did not respond" message
- [x] **ERR-03**: `navigator.serial` `connect` and `disconnect` events are wired; stale VFO/status state is cleared on disconnect without requiring a page reload

### Data Integrity

- [x] **DATA-01**: CSV import validates each row for frequency range (100,000–470,000,000 Hz), valid mode code, slot number (1–999), and tag length/character set before applying any rows; a per-row error summary is shown before import is committed
- [ ] **DATA-02**: Each memory channel write to the radio produces per-slot feedback ("Channel N written" / "Channel N failed") visible in the UI
- [x] **DATA-03**: Delete and Wipe All operations display a persistent (non-dismissable until acknowledged) disclosure that deletion overwrites with blank values and does not remove the slot number from the radio
- [ ] **DATA-04**: Slot 0 is guarded against use as a write/delete target in all code paths

### Infrastructure

- [ ] **INFRA-01**: `package-lock.json` is committed to the repo and `Dockerfile` uses `npm ci` instead of `npm install`
- [ ] **INFRA-02**: `magic-regexp` is removed from `package.json` (unused dependency)
- [ ] **INFRA-03**: nginx `nginx.conf` includes a `Content-Security-Policy` header covering `default-src`, `script-src`, `connect-src`
- [ ] **INFRA-04**: ACR uses managed identity for App Service image pull; `adminUserEnabled` is set to `false` in `main.bicep`; admin credential app settings are removed

## v2 Requirements

### UX Improvements

- **UX-01**: Auto-reconnect when a previously-used serial port is re-plugged (using `navigator.serial` `connect` event + `SerialPort.open()`)
- **UX-02**: Persistent connection status in the page header (baud rate, port name, connected duration)
- **UX-03**: Baud rate selection persisted to localStorage
- **UX-04**: UI controls locked (disabled) while a memory scan or bulk write is in progress
- **UX-05**: Radio memory export to CSV directly from the channel list tab

### Technical Debt

- **DEBT-01**: Extract `useChannelList.ts` composable from `index.vue`
- **DEBT-02**: Extract `useRsgb.ts` composable from `index.vue`
- **DEBT-03**: `CommandResult` re-declaration in `index.vue` removed; use the exported type from `useSerial.ts`
- **DEBT-04**: Timing magic numbers (`40`, `60`, `150`, `1500` ms) extracted to named constants with comments explaining the FTX-1 spec requirement

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile browser support | Web Serial API not available on any mobile browser; no polyfill exists |
| Multi-radio support | App is purpose-built for FTX-1; ID check (`0840`) enforces this |
| Refactoring `index.vue` into sub-composables | High effort, zero user-facing benefit this milestone; deferred to v2 |
| Real-time multi-user sessions | Single operator, single serial port |
| Spectrum display / waterfall | Requires radio scope data stream not exposed via CAT |
| Firmware update | Not supported by FTX-1 CAT protocol |
| E2E browser tests with real radio | Cannot be automated in CI; manual testing only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Complete |
| TEST-03 | Phase 1 | Pending |
| TEST-04 | Phase 1 | Complete |
| TEST-05 | Phase 1 | Complete |
| BUG-01 | Phase 1 | Pending |
| BUG-02 | Phase 1 | Pending |
| BUG-03 | Phase 1 | Pending |
| BUG-04 | Phase 1 | Pending |
| BUG-05 | Phase 1 | Pending |
| COMPAT-01 | Phase 2 | Complete |
| COMPAT-02 | Phase 2 | Complete |
| ERR-01 | Phase 2 | Complete |
| ERR-02 | Phase 2 | Complete |
| ERR-03 | Phase 2 | Complete |
| DATA-01 | Phase 3 | Complete |
| DATA-02 | Phase 3 | Pending |
| DATA-03 | Phase 3 | Complete |
| DATA-04 | Phase 3 | Pending |
| INFRA-01 | Phase 4 | Pending |
| INFRA-02 | Phase 4 | Pending |
| INFRA-03 | Phase 4 | Pending |
| INFRA-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-08*
*Last updated: 2026-05-08 after roadmap creation*
