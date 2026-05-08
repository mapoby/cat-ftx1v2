# Production Hardening Pitfalls

**Project:** CAT FTX-1 Controller
**Researched:** 2026-05-08
**Sources:** Official Azure docs (learn.microsoft.com), Web Serial API spec (wicg.github.io), Vitest docs (vitest.dev), direct codebase audit

---

## Serial Protocol Race Conditions — Warning Signs and Prevention

### Pitfall 1: Prefix-only response matching consumes unsolicited frames

**What goes wrong:** `_handleResponse()` in `useSerial.ts:248` compares only the first 2 characters of the response prefix to `_queue[0].cmd`. During a bulk memory scan, the radio emits a continuous stream of unsolicited `FA`, `MD`, `RI`, and `AI` frames. If an unsolicited `FA` frame arrives while a solicited `FA` query is at the head of the queue, `_handleResponse` treats the unsolicited frame as the solicited reply, resolves the promise with stale data, and the correct solicited response is then processed as unsolicited — overwriting state a second time with correct data but leaving the caller with a wrong return value.

**Why it happens:** The queue match is `_queue[0].cmd.substring(0, 2) === prefix`. Two-character prefix is sufficient for most commands that have no unsolicited AI equivalent, but `FA`, `FB`, `MD`, `CT`, `CN`, `SM`, `SQ` all have both solicited and unsolicited forms.

**Consequences:** `readMemoryChannel()` resolves with a channel object built from the wrong VFO recall — wrong frequency, wrong mode. The UI shows corrupted channel data for that slot. The bug is probabilistic and timing-dependent, so it survives manual testing most of the time.

**Prevention:**
- Compare the full command string, not just 2 characters, for any queue entry whose command prefix has a known unsolicited form.
- Or: disable AI mode (`AI0`) before bulk reads, re-enable (`AI1`) after. This removes the unsolicited-vs-solicited ambiguity entirely for the duration of the scan. Re-enabling AI adds one RTT latency at the end of the scan but removes the entire class of race.
- The AI-disable approach is the FTX-1 intended usage — the radio's design separates polling mode from auto-info mode. Switching modes for bulk operations is standard.

**Detection:** Write a unit test that injects an unsolicited `FA` frame into the mock stream immediately before a solicited `FA` response. Verify the returned channel has the solicited frequency, not the unsolicited one.

**Confidence:** HIGH — codebase audit directly identified this; the mechanism is verified by reading the code.

---

### Pitfall 2: CTCSS/DCS tone read via global state after async gap

**What goes wrong:** `readMemoryChannel()` calls `await _sendAndWait('CN00', 1000)` and then reads `state.value.mainCtcssTone`. The `_sendAndWait` promise resolves the moment the response string arrives at the read loop. However, `_parseResponse` writes to `state` synchronously inside `_handleResponse`, which is called from `_startReadLoop`. The assignment to `ctcssIdx = state.value.mainCtcssTone` happens on the microtask after `_sendAndWait` resolves.

If any `CN` unsolicited frame arrives during the await — which AI mode does emit when the VFO tone changes — the global state field is overwritten before the read on the next line.

**Why it happens:** Global mutable state is used as a side channel for values that should be returned directly by `_sendAndWait`. The response string from `CN00` is `CN0000XX` where `XX` is the tone index — the value is present in the return value of `_sendAndWait` but is not parsed there; it is only parsed via the side-effecting `_parseResponse`.

**Consequences:** Wrong CTCSS index stored for the scanned channel. User writes the channel back to the radio and the tone is incorrect.

**Prevention:** Parse the return value of `_sendAndWait` directly in `readMemoryChannel` instead of reading global state. The response from `CN00` is `CN` + params where params follows the `CN` case in `_parseResponse`. Duplicate that 3-line parse inline in `readMemoryChannel`. This removes the global-state side channel for this specific value.

**Detection:** Unit test: inject a `CN` unsolicited frame 10 ms after the solicited `CN00` response. Verify the channel's `ctcssIdx` is from the solicited response, not the unsolicited one.

**Confidence:** HIGH — identified in codebase audit; mechanism follows directly from the code.

---

### Pitfall 3: Missing try/finally in `scanMemoryChannels` leaves radio VFO on last scanned slot

**What goes wrong:** If the serial port disconnects mid-scan, or if `readMemoryChannel` throws, `scanMemoryChannels` exits without restoring the VFO. The radio's main VFO is parked on whatever memory slot was last recalled via `MC0XXXXX`.

**Why it happens:** `scanMemoryChannels` has no try/finally. There is no VFO save/restore around the scan loop.

**Consequences:** The operator is transmitting or monitoring, the scan starts, port disconnects, radio is now on a random frequency. Potentially disruptive for an amateur radio operator.

**Prevention:**
1. Read the original VFO frequency before the scan: `const origFreq = await _sendAndWait('FA')`.
2. Wrap the scan loop in try/finally.
3. In the finally block, restore with `await send('VM000')` then `await send('FA' + origFreq.substring(2))`.
4. Disable transmit-related UI controls while scanning (the UI should gate TX on `state.value.radioInfo?.scanning`).

**Confidence:** HIGH — codebase audit finding, no speculation.

---

### Pitfall 4: Async busy-guard copy-paste bug in `toggleRfSql`

**What goes wrong:** `toggleRfSql()` checks `preAmpBusy.value || state.value.preAmpHf === null` as its guard. `preAmpHf` has nothing to do with RF/SQL mode. When the radio first connects, all fields are null during `_initialSync2`. This means `toggleRfSql` is blocked for the entire 2-second sync period for the wrong reason. Once `preAmpHf` resolves, the guard passes — but it also means the function blocks if you somehow have `preAmpHf === null` permanently (e.g., `PA0` query never responds).

**Why it happens:** Copy-paste from `togglePreAmpHf`.

**Prevention:** Create a dedicated `rfSqlBusy` ref. The guard should only be `rfSqlBusy.value`. No VFO state should gate RF/SQL toggling.

**Confidence:** HIGH — codebase audit finding.

---

### General serial protocol async patterns — warning signs

The following patterns are common in async serial protocol handlers and apply directly to this codebase. Confidence is MEDIUM (general knowledge, consistent with codebase structure).

| Warning Sign | Root Cause | Prevention |
|--------------|------------|------------|
| Reading global state immediately after `await _sendAndWait(...)` | Unsolicited frame may have clobbered the field in the microtask gap | Parse the return value of `_sendAndWait` directly |
| `_queue` matching by 2-character prefix | Both solicited and unsolicited frames share prefix | Full command match or correlation token |
| Fire-and-forget `send()` for writes that the UI depends on | No feedback if radio rejects with `?;` | Route `?;` to an observable error state |
| Fixed `setTimeout` delays without documentation | Timing assumptions may fail on slower hardware or higher baud rate | Comment each delay with the FTX-1 spec minimum; test at min delay |
| No queue depth guard | `_sendAndWait` during a paused/disconnected port fills the queue indefinitely | Add a max-queue-depth check; reject immediately if queue > N |

---

## Web Serial API Test Environment Pitfalls

### Pitfall 1: `navigator.serial` does not exist in Node.js — unit tests cannot import the composable directly

**What goes wrong:** `useSerial.ts` references `navigator.serial` at module evaluation time (line 182: `typeof navigator !== 'undefined' && 'serial' in navigator`). Importing the module in a Node.js Vitest environment does not throw, but `isSupported` is false and `_port` remains null. However, `connect()` — which calls `navigator.serial.requestPort()` — will throw in any environment where `navigator.serial` is not defined, making it impossible to test the connection path without mocking.

More critically, `_startReadLoop`, `_handleResponse`, and `_parseResponse` are module-private functions. They cannot be imported and called directly in tests. The only way to test `_parseResponse` without serial hardware is to extract it into its own module.

**Why it happens:** `_parseResponse` is a 300-line function with no I/O dependencies — it takes a command string and a params string and mutates a patch object. It is purely testable. But it is defined inside the composable module, not exported.

**Prevention:**
- Extract `_parseResponse` and its decode maps (`MODE_MAP`, `AGC_MAP`, etc.) into a separate `parseResponse.ts` module. Export `_parseResponse` (renamed `parseResponse`) as a pure function.
- The composable imports and calls `parseResponse` — no behaviour change.
- Vitest can now import `parseResponse` directly and test all 30+ decoders with fixture strings.
- Do NOT use Vitest Browser Mode to test this: Browser Mode runs in Playwright/WebdriverIO, which does not expose Web Serial API (it is a hardware-gated API; Playwright does not implement it). The only way to test serial-dependent code in a browser is with actual hardware.

**Confidence:** HIGH — official Vitest docs confirm `vi.stubGlobal` exists for mocking globals; official Chrome docs confirm Web Serial API is not accessible in automated browser contexts; this is a known constraint.

---

### Pitfall 2: Vitest fake timers interact badly with Promise-based serial queues

**What goes wrong:** `_sendAndWait` uses `setTimeout` for its 1500 ms command timeout. If tests use `vi.useFakeTimers()`, `setTimeout` callbacks are not called until `vi.advanceTimersByTime()`. If a test resolves a mock response before advancing timers, the queue entry's `clearTimeout(e.timer)` call cancels the fake timer correctly. But if the test does not advance timers after a failed send, the `_queue` will contain stale entries with fake timers that leak into subsequent tests.

**Prevention:**
- Always call `vi.useRealTimers()` in `afterEach` if any test used fake timers.
- Or: do not use fake timers for serial timeout tests — instead, use a very short timeout parameter (e.g., `_sendAndWait(cmd, 50)`) so real timers fire in under 100 ms.
- Clear `_queue` between tests. Since `_queue` is module-level state in `useSerial.ts`, tests must call `disconnect()` or reset module state between test cases.

**Confidence:** MEDIUM — consistent with Vitest fake timer documentation; the specific interaction with the queue's module-level state is a direct reading of the code.

---

### Pitfall 3: Module-level singleton state (`_queue`, `_port`, `state`) persists across test cases

**What goes wrong:** `useSerial.ts` exports module-level variables (`state`, `_queue`, `_port`, `_writer`, `_reader`). In Vitest's default module caching, these retain values across test cases in the same test file. A test that leaves `_queue` populated (e.g., an unresolved `_sendAndWait`) will cause the next test's queue operations to see unexpected entries.

**Prevention:**
- Use `vi.resetModules()` in `beforeEach` if tests need a fresh module instance.
- Or: expose a `_resetForTesting()` function in `parseResponse.ts` (which has no singletons) and keep the singleton state in `useSerial.ts` where it belongs. Test only the pure parser.
- The cleanest split: `parseResponse.ts` is fully stateless and trivially testable; leave `useSerial.ts` integration-tested only via manual radio testing.

**Confidence:** HIGH — direct consequence of how JavaScript module caching works; Vitest docs confirm `vi.resetModules()` as the solution.

---

### Pitfall 4: No WebDriver/Playwright support for Web Serial API

**What goes wrong:** Vitest Browser Mode, Playwright, and WebdriverIO do not support `navigator.serial`. The Web Serial API requires the browser to present a hardware permission dialog, which automated browser contexts cannot satisfy. Attempting to call `navigator.serial.requestPort()` in a headless browser will throw a `NotFoundError` or `TypeError`.

**Consequence:** There is no automated end-to-end test path for the connection flow. The connect/disconnect/read-loop path must be verified manually with hardware.

**Mitigation:** The correct scope for automated tests is limited to:
1. `parseResponse` (pure function, no I/O) — full unit test coverage is achievable.
2. CSV import/validation logic (no serial dependency).
3. Channel write command construction (`writeMemoryChannel` command strings can be verified by mocking `_write`).
Everything else requires hardware.

**Confidence:** HIGH — Chrome Web Serial API docs explicitly state the API is not available in automated contexts; this is a browser security constraint, not a testing framework limitation.

---

## Azure ACR Managed Identity Migration Pitfalls

### Pitfall 1: Forgetting `acrUseManagedIdentityCreds: true` — the App Service still uses old credentials

**What goes wrong:** After enabling a managed identity on the Web App and assigning `AcrPull` to it, deployments still fail or still use the old admin password. The missing step is setting `acrUseManagedIdentityCreds: true` in the Web App's site configuration. Without this flag, App Service ignores the managed identity for image pulls and continues using `DOCKER_REGISTRY_SERVER_USERNAME`/`DOCKER_REGISTRY_SERVER_PASSWORD`.

**Why it happens:** Managed identity assignment is a separate operation from telling App Service to use it for ACR. Both are required.

**Bicep changes required:**
1. Add `identity: { type: 'SystemAssigned' }` to the `Microsoft.Web/sites` resource.
2. Add a `Microsoft.Authorization/roleAssignments` resource that assigns `AcrPull` to the Web App's principal ID (referenced as `webapp.identity.principalId`).
3. In `siteConfig`, set `acrUseManagedIdentityCreds: true`.
4. Remove the `DOCKER_REGISTRY_SERVER_USERNAME` and `DOCKER_REGISTRY_SERVER_PASSWORD` app settings.
5. Set `adminUserEnabled: false` on the ACR resource.

**Consequence of getting this wrong:** If you remove the credential app settings before `acrUseManagedIdentityCreds` is set, the next deployment pull fails and the container does not start. App Service shows "pull access denied" in the container logs.

**Safe migration order:**
1. Add the managed identity and role assignment to Bicep — deploy.
2. Verify `az webapp log tail` shows the new image pulling correctly.
3. Remove the credential app settings and set `adminUserEnabled: false` — deploy.
4. Verify again.

**Confidence:** HIGH — official Azure App Service docs (`configure-custom-container#use-managed-identity-to-pull-image`) document `acrUseManagedIdentityCreds` explicitly; confirmed by reading the Bicep file.

---

### Pitfall 2: Role assignment propagation delay causes immediate deploy failure

**What goes wrong:** Azure RBAC role assignments are eventually consistent. After `az role assignment create` (or a Bicep deployment that creates one), the role may not be effective for 1–5 minutes. A CI/CD pipeline that assigns `AcrPull` and immediately triggers a deploy can fail with a permission error because the role has not propagated.

**Why it happens:** Azure Active Directory token caches and RBAC propagation are not instantaneous. Microsoft docs acknowledge eventual consistency for role assignments.

**Prevention:** Add a delay or a retry loop in `setup.sh` after the role assignment step. Alternatively, deploy Bicep (which creates the identity + role assignment together) in one step, then trigger the GitHub Actions workflow manually after a short wait. In GitHub Actions, a `sleep 60` after the role assignment step before the image push is a common workaround.

**Confidence:** MEDIUM — well-known Azure behaviour mentioned in multiple official docs and community resources; the exact propagation time is not guaranteed.

---

### Pitfall 3: `acr.listCredentials()` in Bicep exposes the password in deployment history

**What goes wrong:** The current `main.bicep` uses `var acrCreds = acr.listCredentials()` and stores the result in an app setting. Azure keeps deployment history in the resource group. Anyone with `Reader` access to the resource group can read all historical deployments, which include the output of `listCredentials()` in plain text.

**Consequence:** The admin password is permanently readable in deployment history unless the history is explicitly purged. Rekeying the ACR admin password does not remove it from history.

**Prevention:** Remove `acr.listCredentials()` from Bicep entirely. Use managed identity as described above. Set `adminUserEnabled: false`.

**Confidence:** HIGH — Azure Bicep/ARM template deployment history is a well-documented attack surface; `listCredentials()` in templates is explicitly warned against in Azure security baselines.

---

### Pitfall 4: ABAC-enabled registries reject `AcrPull` role assignments

**What goes wrong:** Azure is migrating ACR to ABAC-enabled mode as the future default. If the ACR instance is ever configured with `rbac-abac` role assignment mode (either explicitly or if Microsoft enforces it as default), the `AcrPull` role assignment will stop working. `AcrPull` is a legacy role that is not honored in ABAC-enabled registries.

**Impact for this project:** The current Bicep uses admin credentials, not `AcrPull`, so this is not an immediate concern. But the managed identity migration should use `AcrPull` (for a non-ABAC registry). If the registry is later migrated to ABAC mode, `AcrPull` must be replaced with `Container Registry Repository Reader` + `Container Registry Repository Catalog Lister`.

**Detection:** `az acr show --name <name> --query roleAssignmentMode` — if it returns `rbac-abac`, use ABAC-aware roles.

**Confidence:** HIGH — confirmed by official Azure ABAC documentation (learn.microsoft.com/azure/container-registry, updated 2025-12-11).

---

## Input Validation for Radio Data

### Pitfall 1: No frequency range validation in CSV import allows silent radio errors

**What goes wrong:** The CSV import parses row data and maps to channel fields without validating that `freq` is within the FTX-1's supported range (100 kHz – 470 MHz for general coverage; specific bands for TX). An imported frequency of 0, a very large value, or a non-numeric string will produce a command like `FA000000000` or `FA` with `NaN` padding, which returns `?;` from the radio. The UI shows no error; the channel simply fails to write silently.

**Prevention:**
- Validate `freq` is a number in range `[100000, 470000000]` (Hz).
- Validate `txFreq` is either null or in the same range.
- Validate `mode` is one of the known mode strings from `MODE_CODE` (AMS, LSB, USB, CW-U, FM, AM, RTTY-L, CW-L, DATA-L, RTTY-U, DATA-FM, FM-N, DATA-U, AM-N, PSK, DATA-FM-N, C4FM-DN, C4FM-VW).
- Validate `slot` is an integer in `[1, 999]`.
- Validate `sqlType` is an integer in `[0, 5]`.
- Validate `ctcssIdx` is an integer in `[0, 49]` (CTCSS tones 0–49 are standard for Yaesu).
- Validate `dcsIdx` is an integer in `[0, 103]` (DCS codes 023–754, 104 standard codes).
- On validation failure: collect all row errors, display a summary to the user before import proceeds. Do not silently skip bad rows.

**Confidence:** HIGH for the validation approach; MEDIUM for the exact index bounds (Yaesu FTX-1 specific — verify against the radio's CAT reference manual for exact tone table sizes).

---

### Pitfall 2: Tag field length and character set not validated

**What goes wrong:** The FTX-1 accepts a 12-character tag (from `MT` command format `MT<slot><12-char-tag>`). The CSV import and channel edit form do not enforce this limit. A 20-character tag is silently truncated by the composable (`config.tag.substring(0, 12)`), but the user sees their 20-character name accepted in the UI and does not know it will be truncated on the radio.

Additionally, the FTX-1 tag field accepts ASCII printable characters only. Non-ASCII characters (e.g., emoji, accented characters) produce undefined behaviour or a `?;` error.

**Prevention:** Enforce `maxlength="12"` in the HTML input and validate ASCII-only on import (`/^[\x20-\x7E]*$/`).

**Confidence:** MEDIUM — tag length is confirmed by the `MT` format in the composable. ASCII-only assumption is based on standard Yaesu CAT protocol behaviour; verify against FTX-1 manual.

---

### Pitfall 3: Slot number 0 is a sentinel value used by write operations

**What goes wrong:** The composable uses `VM000` (slot 0) as a VFO mode selector before writes. Slot 0 is not a real memory channel. If a CSV row contains `slot: 0`, `writeMemoryChannel(0, ...)` calls `send('MC000000')` which may put the radio into an unexpected state.

**Prevention:** Validate slot > 0 in the CSV import and in the UI channel editor. The check `slot > 0 && freq > 0` is already present in `_parseResponse` for `MR` — apply the same check at the import boundary.

**Confidence:** HIGH — direct reading of the composable code; `VM000` and slot 0 have special meaning.

---

### Pitfall 4: Clarifier offset sign and range not validated

**What goes wrong:** `clarDir` must be `'+'` or `'-'`; `clarOffset` must be in Hz within the FTX-1's clarifier range (typically ±9999 Hz). A CSV import with `clarDir: 'X'` or `clarOffset: 99999` will produce malformed CAT commands.

**Prevention:** Validate `clarDir` is in `['+', '-', null]`; validate `clarOffset` is an integer in `[-9999, 9999]` or null.

**Confidence:** MEDIUM — offset range is based on standard Yaesu clarifier range; verify against FTX-1 CAT manual.

---

## Phase Mapping

| Pitfall | Phase to Address | Priority |
|---------|-----------------|----------|
| Extract `_parseResponse` into testable module | Phase 1 (testing foundation) | Critical — all other test coverage depends on this |
| Fix CTCSS/DCS global state read in `readMemoryChannel` | Phase 1 (bug fixes during testing) | High |
| Add try/finally VFO restore to `scanMemoryChannels` | Phase 1 (bug fixes during testing) | High |
| Fix `toggleRfSql` busy guard | Phase 1 (bug fixes during testing) | Medium |
| Add CSV import validation (freq, mode, slot, tag, clarifier) | Phase 1 or 2 (input hardening) | High — user-facing data corruption |
| Module-level state isolation for Vitest | Phase 1 (test setup) | Medium — affects test reliability |
| Fake timer interaction with queue | Phase 1 (test setup) | Low — avoidable by using short real timeouts |
| Commit lockfile and switch to `npm ci` | Phase 1 (infra hygiene) | High — reproducible builds |
| ACR managed identity migration (Bicep rewrite) | Phase 2 (infra hardening) | Medium — security improvement, not blocking |
| Remove admin credentials from deployment history | Phase 2 (infra hardening) | Medium — accept risk until Phase 2 |
| ABAC role awareness for future ACR migration | Phase 2 or later | Low — not an active issue today |
| Prefix-only response matching fix | Requires deeper design decision | High — consider AI-disable during scan as simpler fix |

---

## Confidence Summary

| Area | Confidence | Notes |
|------|------------|-------|
| Serial protocol race conditions | HIGH | All findings come from direct codebase audit |
| Web Serial API test constraints | HIGH | Confirmed by official Chrome and Vitest docs |
| Vitest fake timer pitfalls | MEDIUM | General Vitest knowledge consistent with codebase structure |
| Azure managed identity migration | HIGH | Confirmed by official Azure docs (2026-02-03, 2026-04-08) |
| ABAC role assignment changes | HIGH | Confirmed by official Azure ABAC docs (2025-12-11) |
| CSV input validation ranges | MEDIUM | Freq/slot/mode bounds verified by code; CTCSS/DCS index bounds need FTX-1 manual confirmation |
| Tag character set constraints | MEDIUM | Length confirmed by code; ASCII-only is standard Yaesu behaviour, not confirmed from FTX-1 manual |
