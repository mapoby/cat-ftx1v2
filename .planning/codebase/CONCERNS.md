# Codebase Concerns

**Analysis Date:** 2026-05-08

---

## Browser Compatibility

### Web Serial API — Chrome/Edge only [HIGH]

- **Issue:** `navigator.serial` is only available in Chromium-based browsers (Chrome 89+, Edge 89+). Firefox and Safari have no implementation.
- **Files:** `composables/useSerial.ts:182`, `pages/index.vue:30-32`, `pages/index.vue:1737-1739`
- **Impact:** The app is completely non-functional in Firefox, Safari, and all mobile browsers. The warning in the UI (`compat-warning` div) only shows after the page loads; there is no pre-load gate or dedicated unsupported-browser page.
- **Current mitigation:** A passive warning banner renders at the top of the header when `isSupported === false`.
- **Fix approach:** Add a full-page blocking overlay for unsupported browsers that renders before any other UI. Consider a static `index.html` fallback page that detects support before loading the Nuxt bundle.

### `color-mix()` CSS — no Safari <16.2 support [LOW]

- **Issue:** `PresetButton.vue:131,136` uses `color-mix(in srgb, ...)`. This is not available in Safari <16.2 or any Firefox.
- **Files:** `components/PresetButton.vue:131,136`
- **Impact:** Preset button hover/active backgrounds silently disappear in unsupported browsers.
- **Fix approach:** Provide a `background` fallback value before the `color-mix()` declaration.

---

## Infrastructure

### Azure infrastructure not provisioned [HIGH]

- **Issue:** Per `CLAUDE.md`, the Azure resource group, ACR, App Service Plan, and Web App have never been created. `infra/setup.sh` has not been run.
- **Files:** `infra/setup.sh`, `infra/main.bicep`, `.github/workflows/azure-deploy.yml`
- **Impact:** Every push to `main` triggers the CI/CD workflow, which will fail at the Azure login step because the required GitHub Actions secrets (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`) and variables (`ACR_NAME`, `ACR_LOGIN_SERVER`, `AZURE_WEBAPP_NAME`) have not been configured.
- **Fix approach:** Run `infra/setup.sh` from Azure Cloud Shell per the instructions in `CLAUDE.md`, then add the printed values as GitHub Actions secrets/variables.

### ACR admin credentials in Bicep [MEDIUM]

- **Issue:** `infra/main.bicep:39-63` uses `acr.listCredentials()` to inject ACR username and password directly into App Service app settings as plain strings. Admin credentials are enabled (`adminUserEnabled: true`).
- **Files:** `infra/main.bicep:21,39-63`
- **Impact:** The ACR admin password is stored as a plain-text App Service config value, visible in the Azure portal to anyone with Reader access to the resource. Admin credentials are long-lived and cannot be scoped.
- **Fix approach:** Use a managed identity (system-assigned) on the Web App and grant it `AcrPull` on the registry. Remove `adminUserEnabled`. This is the standard Azure pattern and avoids credentials in app settings entirely.

### CI/CD workflow has no failure notification [LOW]

- **Issue:** `.github/workflows/azure-deploy.yml` has no `on.failure` steps or notification mechanism. A broken deployment silently leaves the old container running.
- **Files:** `.github/workflows/azure-deploy.yml`
- **Fix approach:** Add a `notify` step (e.g., GitHub issue or email action) on job failure.

### No lockfile [MEDIUM]

- **Issue:** `package.json` uses `^` ranges for all dependencies (Nuxt `^3.13.0`, magic-regexp `^0.11.0`). There is no `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` present in the repository.
- **Files:** `package.json`, `Dockerfile:7`
- **Impact:** `npm install --prefer-offline` in the Dockerfile installs whatever `^` resolves to at build time. A Nuxt minor or patch release can silently change build output between identical Docker builds. The `--prefer-offline` flag only helps when a local cache exists; on CI it falls back to live resolution anyway.
- **Fix approach:** Commit a `package-lock.json` (run `npm install` locally, commit the lockfile). Change `Dockerfile:7` to `npm ci` instead of `npm install`.

---

## CAT Protocol Limitations

### No per-slot delete command exists on the FTX-1 [HIGH]

- **Issue:** The Yaesu FTX-1 CAT protocol has no command to delete a memory slot. The `MW` command with `P7=0` or `P7=4` returns `?;` (error). The only available workaround is overwriting the slot with blank defaults (29 MHz, USB, no squelch, empty tag).
- **Files:** `composables/useSerial.ts:776-791`
- **Impact:** "Delete" and "Wipe All Memory" do not actually clear slots — they fill them with sentinel values. The radio retains all slot numbers; users who expect deletion will find ghost entries. This limitation is documented in a code comment and in the wipe confirmation dialog, but there is no persistent warning in the Channel List UI.
- **Fix approach:** This is a hardware/firmware limitation. Document it more prominently in the UI, e.g., a persistent tooltip or info badge on the Delete and Wipe buttons in the Channel List toolbar.

### Unsolicited-vs-solicited response matching is naive [MEDIUM]

- **Issue:** `_handleResponse()` in `composables/useSerial.ts:248` matches a solicited response by comparing only the first 2 characters of the response prefix to the head of the queue. If the radio sends an unsolicited `FA` frame while a solicited `FA` query is queued, the unsolicited frame will be consumed by the queue entry and resolve the promise with unexpected data.
- **Files:** `composables/useSerial.ts:238-257`
- **Impact:** Low probability during normal operation because AI mode pushes updates continuously, but during `readMemoryChannel()` — which fires multiple solicited queries back-to-back — a race between an AI frame and a solicited response could cause a query to resolve early with stale data, leading to incorrect channel display.
- **Fix approach:** Include a full command-string comparison (not just prefix) or add a correlation token strategy. Alternatively, disable AI mode (`AI0`) during bulk memory reads and re-enable it afterward.

### `send()` fire-and-forget with no error feedback to UI [MEDIUM]

- **Issue:** `send()` (`composables/useSerial.ts:679-690`) calls `_write()` and returns immediately without waiting for a radio acknowledgement or AI feedback. If the radio rejects the command with `?;`, the error is routed through `_handleResponse()` but is only exposed if the command happens to be at the head of the queue. For fire-and-forget sends, the rejection is silently dropped.
- **Files:** `composables/useSerial.ts:679-690`, `composables/useSerial.ts:238-242`
- **Impact:** Invalid or out-of-range commands (e.g., setting power on a VHF-only band) will fail silently. The user sees no feedback.
- **Fix approach:** Either route `?;` responses to a shared error state that the UI observes, or add an optional `await` path for commands that need confirmation.

### `_initialSync2()` is fire-and-forget [LOW]

- **Issue:** `connect()` (`composables/useSerial.ts:649`) calls `_initialSync2()` without `await`. The 40+ commands in that sequence — including firmware version queries, all EX settings, all PA/VE queries — execute asynchronously after `connect()` returns and the UI renders.
- **Files:** `composables/useSerial.ts:602-613,649`
- **Impact:** On first render, most status badges (firmware, attenuator, preamp, bandwidth, etc.) show `--` for up to ~2 seconds while the sync completes. This is cosmetically acceptable but not ideal. A deeper concern is that if the port is disconnected during `_initialSync2()`, the `if (!_port) break` guard catches it, but any already-queued commands remain unresolved until their 1500 ms timeouts fire.
- **Fix approach:** Low priority. Track a `syncing` flag in state to show a spinner during initial sync.

### `readMemoryChannel()` mutates live VFO state [MEDIUM]

- **Issue:** `readMemoryChannel()` (`composables/useSerial.ts:712-739`) sends `MC0<slot>` to recall a memory channel into the main VFO before sending `MR`. This temporarily changes the radio's active frequency and mode on every channel read during a scan.
- **Files:** `composables/useSerial.ts:712-716`
- **Impact:** During a scan of 99 channels (`scanMemoryChannels()`), the radio's main VFO is cycled through all 99 frequencies. If the user is actively transmitting or monitoring, this is disruptive. After the scan, the radio VFO is left on the last scanned channel, not the original frequency.
- **Fix approach:** This is a CAT protocol limitation — there is no direct `MR` read without recalling. The scan should save and restore the original VFO frequency (`FA` read at start, `FA` write at end). The UI should disable transmit controls during a scan.

### CTCSS/DCS index read during memory scan uses main VFO state [MEDIUM]

- **Issue:** `readMemoryChannel()` (`composables/useSerial.ts:722-731`) reads CTCSS/DCS by querying `CN00`/`CN01` and then reading from `state.value.mainCtcssTone`/`state.value.mainDcsCode`. These are global state fields used by both the live VFO display and the channel scanner — they are not isolated per-slot.
- **Files:** `composables/useSerial.ts:726-729`
- **Impact:** During a multi-channel scan, if an AI unsolicited `CN` frame arrives between the `MC0<slot>` recall and the `CN00` query, the wrong tone value can be stored for the channel.
- **Fix approach:** Use `_sendAndWait()` return value instead of reading global state to retrieve CTCSS/DCS values. The response string contains the data directly.

---

## Technical Debt

### `index.vue` is a single 4000+ line component [HIGH]

- **Issue:** `pages/index.vue` contains the entire application: template, 3000+ lines of `<script setup>`, and ~1500 lines of `<style>`. All state, business logic, event handlers, data constants (CTCSS tones, DCS codes, band list, mode map, scope constants), API calls, CSV import/export, RSGB API integration, and UI rendering are co-located.
- **Files:** `pages/index.vue` (entire file)
- **Impact:** High coupling makes it difficult to test individual features, trace bugs, or understand data flow. Any PR touching this file risks conflicts. Adding new features requires scrolling past thousands of lines of unrelated code.
- **Fix approach:** Extract logical slices into composables (`useChannelList.ts`, `useRsgb.ts`, `useScopeControls.ts`) and sub-components (`ChannelListTab.vue`, `VfoCard.vue`, `ScopePanel.vue`). This is the primary maintainability risk in the codebase.

### `CommandResult` interface is re-declared in `index.vue` [LOW]

- **Issue:** `CommandResult` is exported from `composables/useSerial.ts:108-113` and also re-declared locally inside `pages/index.vue:1065-1070`. The local declaration shadows the import.
- **Files:** `pages/index.vue:1065-1070`, `composables/useSerial.ts:108-113`
- **Impact:** Structural duplication; if the canonical interface changes, the local copy can drift out of sync.
- **Fix approach:** Remove the re-declaration in `index.vue` and use the imported type.

### `toggleRfSql()` uses `preAmpBusy` guard incorrectly [LOW]

- **Issue:** `toggleRfSql()` in `pages/index.vue:1841` checks `preAmpBusy.value || state.value.preAmpHf === null` as its guard. This has nothing to do with RF/SQL mode toggling — it appears to be a copy-paste from `togglePreAmpHf()`. The function also sends a follow-up `EX030102` query inside a separate `try/catch` with an empty `finally`, leaving `preAmpBusy` set to `false` after the first block, not after the second.
- **Files:** `pages/index.vue:1841-1851`
- **Impact:** RF/SQL mode toggle is blocked when the preamp state is unknown (`preAmpHf === null`), which is incorrect. The `preAmpBusy` flag is also released before the follow-up query completes.
- **Fix approach:** Use a dedicated `rfSqlBusy` flag and remove the `preAmpHf === null` guard.

### `magic-regexp` dependency is unused [LOW]

- **Issue:** `package.json` lists `magic-regexp: ^0.11.0` as a runtime dependency. No import of `magic-regexp` exists in any source file.
- **Files:** `package.json:14`
- **Impact:** Unnecessary dependency adds to bundle analysis noise and is resolved during Docker builds. No functional impact.
- **Fix approach:** Remove it: `npm uninstall magic-regexp`.

---

## Security

### External API call without CORS or rate-limit protection [MEDIUM]

- **Issue:** `fetchRsgb()` and `openRepeaterInfo()` in `pages/index.vue:2544-2572,2657` call `https://api-beta.rsgb.online` directly from the browser. This is an unofficial beta endpoint with no documented SLA, rate limits, or guarantee of continued availability.
- **Files:** `pages/index.vue:2552,2657`
- **Impact:** If the RSGB beta API changes its domain, response schema, or enforces CORS restrictions, the repeater import feature will break silently or throw an unhandled error. The `rsgbError` state does catch `fetch` failures, so the UI degrades gracefully, but there is no fallback.
- **Fix approach:** Pin the API base URL to a named constant and add a clear UI note that this is a third-party beta API. Monitor for an official stable endpoint.

### nginx serves on HTTP port 80 only [MEDIUM]

- **Issue:** `nginx.conf` listens on port 80 only. TLS termination is handled by Azure App Service (via the `httpsOnly: true` setting in `infra/main.bicep:48`). If the container is run outside Azure without a TLS proxy in front of it, the Web Serial API will refuse to connect because `navigator.serial` requires HTTPS (except `localhost`).
- **Files:** `nginx.conf:2`, `infra/main.bicep:48`
- **Impact:** Running the Docker image directly (`docker run -p 8080:80 cat-ftx1`) over a non-local network will produce a non-functional app with no clear error message.
- **Fix approach:** Document this limitation in `CLAUDE.md` local dev guidance. Optionally add self-signed TLS to nginx for non-localhost Docker use, or add a check that displays a warning when the page is served over plain HTTP on a non-localhost origin.

### No Content Security Policy header [LOW]

- **Issue:** `nginx.conf` sets `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`, but does not set a `Content-Security-Policy` header.
- **Files:** `nginx.conf:8-10`
- **Impact:** Minimal practical risk for this app (no user-generated content, no auth, no tokens), but absence of CSP is a standard security finding.
- **Fix approach:** Add a permissive but explicit CSP: `default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api-beta.rsgb.online https://ukrepeater.net`.

---

## Missing Error Handling

### Memory scan leaves radio in unknown VFO state on error [MEDIUM]

- **Issue:** `scanMemoryChannels()` (`composables/useSerial.ts:741-747`) has no try/catch. If an error occurs mid-scan (e.g., disconnect), the function exits and the radio VFO is left on whatever channel was last recalled.
- **Files:** `composables/useSerial.ts:741-747`
- **Fix approach:** Wrap the scan loop in try/finally and restore the original VFO frequency.

### `writeMemoryChannel()` and `deleteMemorySlot()` have no error propagation [MEDIUM]

- **Issue:** Both functions (`composables/useSerial.ts:749-791`) use `send()` for every step. `send()` calls `_write()` which can throw if not connected. Neither function has a try/catch; errors would propagate as unhandled rejections to the caller.
- **Files:** `composables/useSerial.ts:749-791`
- **Impact:** In `index.vue`, the callers (`writeChannelToRadio`, `deleteSelectedFromRadio`, `wipeAllMemory`) do wrap in try/catch, so the UI handles errors, but the composable-level operations have no partial-completion recovery (e.g., if `AM` succeeds but `MZ` fails, the channel slot exists with incomplete data).
- **Fix approach:** Low priority given the caller-level handling. Document the partial-completion risk.

### CSV import has no schema validation [LOW]

- **Issue:** CSV import in `pages/index.vue` parses rows and maps column names. There is no validation that frequency values are in-range, that mode codes are valid FTX-1 modes, or that slot numbers are in 1–999 range.
- **Files:** `pages/index.vue` (CSV import section)
- **Impact:** Importing a malformed CSV could populate the channel list with invalid rows that silently produce a `?;` error when written to the radio.
- **Fix approach:** Add per-row validation with a user-visible error summary after import.

---

## Hardcoded Values and Magic Strings

| Value | Location | Concern |
|-------|----------|---------|
| `'0840'` — FTX-1 radio ID | `composables/useSerial.ts:644` | Hardcoded device check. If Yaesu releases a firmware update that changes the ID response, all connections will be rejected with "Unknown radio ID". |
| `38400` — default baud rate | `composables/useSerial.ts:627`, `pages/index.vue:1075` | Correct for CAT-1, but duplicated. Change in one place does not propagate to the other. |
| `'https://api-beta.rsgb.online'` | `pages/index.vue:2552` | Beta API URL hardcoded inline, not a named constant. |
| `'https://ukrepeater.net/my_repeater.php'` | `pages/index.vue:984` | Third-party URL hardcoded in template. |
| `40` ms inter-command delay | `composables/useSerial.ts:598,611` | Magic constant for serial timing. No comment explaining the minimum required by FTX-1 spec. |
| `60` ms preset delay | `composables/useSerial.ts:707` | Same — no reference to source. |
| `150` ms write-wait delay | `composables/useSerial.ts:768,789` | Same pattern. |
| `1500` ms default command timeout | `composables/useSerial.ts:559` | Reasonable, but not documented. Some commands use `1000`, others `2000` — no rationale. |
| `29000000` Hz (29 MHz) — blank slot frequency | `composables/useSerial.ts:783,789` | Sentinel value used by delete. Not a named constant. |
| `'EX030704'` — antenna select menu code | `pages/index.vue:1234,1886,1893,1901` | FTX-1 EX menu code baked in multiple places. A single constant would be safer. |
| `'EX030102'` — RF/SQL mode menu code | `pages/index.vue:1843,1849`, `composables/useSerial.ts:411` | Same pattern. |

---

## Scalability and Maintainability

### No automated tests of any kind [HIGH]

- **Issue:** There are no unit, integration, or end-to-end tests. No test framework is installed (`package.json` has no test runner).
- **Files:** `package.json`
- **Impact:** All CAT protocol parsing, memory read/write logic, and UI interactions are untested. Regressions in `_parseResponse()` — the most complex function in the codebase — would only be caught through manual radio testing.
- **Fix approach:** Add Vitest for unit-testing `_parseResponse()` with fixture responses. The pure-function nature of the parser makes it straightforward to test in isolation.

### `shallowRef` for `state` hides deep reactivity bugs [MEDIUM]

- **Issue:** `state` is declared as `shallowRef<TransceiverState>` (`composables/useSerial.ts:180`). Every `_patch()` call creates a new top-level object, which is correct. However, `radioChannels` is a nested `Record<number, RadioChannel>` that is spread-cloned on every channel update. If any component ever tries to track a nested channel property (e.g., `state.value.radioChannels[1].freq`), it will not be reactive.
- **Files:** `composables/useSerial.ts:180,197-199`
- **Impact:** Current UI accesses `radioChannels` via computed properties that read the full record, so reactivity works today. This is a fragility that could break silently if future code subscribes to nested channel properties directly.

### `index.vue` script section exceeds 3000 lines [HIGH]

- See "Technical Debt → `index.vue` is a single 4000+ line component" above. This also affects build performance: `vue-tsc` must type-check the entire file as a single unit.

---

*Concerns audit: 2026-05-08*
