---
phase: 01-testing-foundation-bug-fixes
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - composables/catParser.ts
  - composables/useSerial.ts
  - vitest.config.mts
  - package.json
  - test/unit/catParser.test.ts
  - pages/index.vue
  - .github/workflows/azure-deploy.yml
findings:
  critical: 5
  warning: 8
  info: 4
  total: 17
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-08
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

The implementation covers the catParser extraction, Vitest wiring, and UI wiring for Phase 1. The parser itself is largely correct and the test suite is comprehensive. However, several logic bugs exist in the parser (zero-frequency falsy trap, RM/CT/SH param-index mismatches), the test suite has incorrect expected values that mask real bugs, and the UI has a cross-VFO copy-paste error for the RF-gain/squelch visibility condition. The CI workflow runs tests before building, which is correct. No hardcoded secrets or injection vulnerabilities were found.

---

## Critical Issues

### CR-01: FA/FB zero-frequency uses falsy coercion — rejects frequency 0 but also any parseInt result that is NaN (empty params)

**File:** `composables/catParser.ts:41-42`
**Issue:** `parseInt(params, 10) || null` returns `null` for both `"00000000000"` (zero, intentional) and for any non-numeric string (NaN coerces to falsy). This is intentional for zero but the pattern is fragile. The real bug is on line 94: `parseInt(params.substring(1), 10) || null` for `PC` — if the radio returns a valid power of `0` W it is discarded. `AO` on line 95 has the same problem: AMC level 0 is silently dropped. This is a documented BUG-01/BUG-02 in the project but is reproduced here in the extracted parser.

Additionally `parseInt` on a blank string yields `NaN`, which is falsy, so `NaN || null` silently nullifies state rather than leaving it unchanged. This differs from the radio's actual response being zero.
**Fix:**
```typescript
// For FA/FB: explicit zero check is correct intent but should be documented
case 'FA': {
  const v = parseInt(params, 10)
  ch.mainFreq = (!isNaN(v) && v > 0) ? v : null
  break
}
// For PC/AO: zero is a valid value — do not coerce
case 'PC': {
  const v = parseInt(params.substring(1), 10)
  ch.powerLevel = isNaN(v) ? null : v
  break
}
case 'AO': {
  const v = parseInt(params, 10)
  ch.amcLevel = isNaN(v) ? null : v
  break
}
```

---

### CR-02: RM case param-index bug — mode 0 subSmeter reads wrong slice

**File:** `composables/catParser.ts:107-113`
**Issue:** For `RM` mode `0` (both meters), `subSmeter` is read from `params.substring(4, 8)`. The RM response for mode 0 is documented as `P1=0`, then 3-digit main, then 3-digit sub — i.e. `0` + `NNN` + `NNN` = 7 chars total. `substring(4, 8)` reads characters 4–7 (4 chars) and the last char is beyond the 3-char sub field. The slice should be `substring(4, 7)`. The test at line 295 passes `'001502030'` (9 chars) which only works because the test string is longer than a real response — it would hide the mismatch on actual 7-char radio data.
**Fix:**
```typescript
else if (params[0] === '0') {
  ch.mainSmeter = parseInt(params.substring(1, 4), 10)
  ch.subSmeter  = parseInt(params.substring(4, 7), 10)   // was (4, 8)
}
```

---

### CR-03: CT case reads wrong param index when no sourceCmd

**File:** `composables/catParser.ts:195`
**Issue:** `const sqlType = parseInt(params[1] ?? params[0], 10)`. When `sourceCmd` is `null` the code falls back to `params[0]` for `sqlType`. But `params[0]` is the VFO selector (`'0'` or `'1'`), not the SQL type. The SQL type is always at `params[1]`. The fallback `?? params[0]` will read the VFO digit as the type when `params[1]` is `undefined` (params is only 1 char), which would give `NaN → null`. However for a valid unsolicited AI frame like `CT02`, `params = '02'`, `params[1] = '2'` — this is correct. The real fault is: when the radio sends `CT0` (query without value), `params` is `'0'` and `params[1]` is `undefined`, so `params[0]='0'` is used as sqlType, setting `mainSqlType = 0` incorrectly instead of leaving state unchanged.
**Fix:**
```typescript
case 'CT': {
  const vfo = sourceCmd ? sourceCmd[2] : params[0]
  const sqlType = parseInt(params[1], 10)          // never fall back to params[0]
  if (!isNaN(sqlType)) {
    if (vfo === '0') ch.mainSqlType = sqlType
    else if (vfo === '1') ch.subSqlType = sqlType
  }
  break
}
```

---

### CR-04: SH case reads wrong substring for bandwidth index

**File:** `composables/catParser.ts:218`
**Issue:** `parseInt(params.substring(2, 4), 10)` is used to extract the bandwidth index. The SH response format is `SH P1 P2 P2` where P1 is VFO and P2P2 is the 2-digit index. `params` in `parseResponse` is everything after the 2-char command prefix. So for the full frame `SH00NNN`, `params = '00NNN'` and the index is at `params.substring(2, 4)` — but `params[0]` is VFO, so the 2-digit index starts at position 1: `params.substring(1, 3)`. The extra leading byte from `sourceCmd[2]` path makes this appear correct only for solicited calls. For unsolicited AI frames (no sourceCmd), the VFO is read from `params[0]`, and the index should be `params.substring(1, 3)`, not `(2, 4)`.

The test at line 553 (`parseResponse('SH', '0012', base(), 'SH0')`) passes `params = '0012'` and reads `substring(2, 4) = '12'` which is coincidentally correct only because the test string is padded. Real SH responses have the form `SH001` (VFO=0, idx=01), where `substring(2,4)` would give `'1\0'` or similar truncation.
**Fix:**
```typescript
case 'SH': {
  const vfo = sourceCmd ? sourceCmd[2] : params[0]
  const idx = parseInt(params.substring(1, 3), 10)   // was (2, 4)
  if (vfo === '0') ch.mainBandwidth = isNaN(idx) ? null : idx
  else if (vfo === '1') ch.subBandwidth = isNaN(idx) ? null : idx
  break
}
```

---

### CR-05: Test for RM mode 0 encodes incorrect expected value — masks CR-02

**File:** `test/unit/catParser.test.ts:294-296`
**Issue:** The test string `'001502030'` is 9 chars. For mode 0, the current code reads `subSmeter = parseInt('2030'.substring(0, 4)) = 2030`? No — `params.substring(4, 8)` on `'001502030'` is `'2030'`, so `parseInt('2030') = 2030`, but the test asserts `203`. This means the test is asserting on a value that cannot come from the current code — `parseInt('2030')` is `2030`, not `203`. This test will FAIL as written, which means it was never run, or was run against a different code version. Either the test string is wrong or the expected value is wrong.

Reconstructing: if the intended 7-char RM payload for "main=015, sub=203" is `'0015203'`, then `substring(4, 7) = '203'` is correct. The test string has an extra `'0'` appended, making it 8 chars, and the current `(4, 8)` slice produces `'2030'` → 2030, not 203. The test will fail at runtime — revealing the test was never executed successfully.
**Fix:** Fix both the test string and the parser slice together (per CR-02 fix):
```typescript
// In test file — correct 7-char RM mode-0 payload:
const delta = parseResponse('RM', '0015203', base())
expect(delta.mainSmeter).toBe(15)
expect(delta.subSmeter).toBe(203)
```

---

## Warnings

### WR-01: RF-gain / squelch visibility for MAIN VFO uses subMode instead of mainMode

**File:** `pages/index.vue:276-277`
**Issue:** The LevelBar components for the MAIN VFO card use `isRfGainMode(state.subMode)` instead of `isRfGainMode(state.mainMode)` in their `v-if` conditions. The SUB card (lines 200–201) correctly uses `state.subMode`. The MAIN card should use `state.mainMode`.

```html
<!-- Line 276 — RF GAIN for MAIN incorrectly checks subMode -->
<LevelBar v-if="(state.sqlRfMode===0)||((state.sqlRfMode===2)&&isRfGainMode(state.subMode))"
<!-- Line 277 — SQUELCH for MAIN incorrectly checks subMode -->
<LevelBar v-if="(state.sqlRfMode===1)||((state.sqlRfMode===2)&&(!isRfGainMode(state.subMode)))"
```
**Fix:**
```html
<LevelBar v-if="(state.sqlRfMode===0)||((state.sqlRfMode===2)&&isRfGainMode(state.mainMode))"
  :value="state.rfGainMain" label="RF GAIN" ... />
<LevelBar v-if="(state.sqlRfMode===1)||((state.sqlRfMode===2)&&(!isRfGainMode(state.mainMode)))"
  :value="state.sqMain" label="SQUELCH" ... />
```

---

### WR-02: `_initialSync` uses fire-and-forget `_write` for query commands that need responses

**File:** `composables/useSerial.ts:285-289`
**Issue:** `_initialSync` calls `_write(cmd)` directly (not `_sendAndWait`) for all sync commands including `FA`, `FB`, `MD0`, `TX`, etc. These are query commands — the radio sends back a response. Because `_write` bypasses the queue, responses arrive via `_handleResponse` as unsolicited AI frames. This works only if `state.autoInfo` is true. But `_initialSync` runs before `_enableAutoInfo` completes... no wait: looking at `connect()` line 338, `_enableAutoInfo` is awaited before `_initialSync`. So AI mode is on. However there is a subtler issue: `_initialSync2` at line 339 is fire-and-forget (`_initialSync2()` without `await`), and it also uses `_write`. If the port closes mid-sync the writes throw but are silently caught — acceptable for non-fatal init. This is a marginal reliability concern, not a crash.

The real warning is that `_initialSync` sends query commands that need responses (like `FA`, `FB`) using bare `_write`, bypassing the queue. Any subsequent `_sendAndWait` call could match the wrong response if the AI response for `FA` arrives while a different command's response is expected. The queue-matching logic at line 221 only matches on 2-char prefix — `FA` response while an `FA` command is queued would be consumed by the queue; but if no `FA` is in the queue, it falls through to the unsolicited path. Because these are fired without queuing, there is no response matching problem per se. But if `AI` mode is not yet active when `_initialSync` fires, responses are lost. The guard is the `await _enableAutoInfo()` call, which is correct. Document this dependency explicitly to avoid future breakage.
**Fix:** Add a comment to `_initialSync` noting that it must only be called after AI mode is confirmed active.

---

### WR-03: `scanMemoryChannels` disables AI mode but does not check `connected` before the long scan loop

**File:** `composables/useSerial.ts:439-458`
**Issue:** `scanMemoryChannels` calls `_sendAndWait('AI0')` to disable AI mode for the scan, then iterates through slots calling `readMemoryChannel`. If the port disconnects mid-scan, `readMemoryChannel` catches errors and returns `null`, so the loop continues silently to completion, then tries to re-enable AI mode and restore frequency. The frequency restore on line 452 calls `send('FA' + origFreq)` where `origFreq` came from `origFreqResp.substring(2)` — but `origFreqResp` was obtained from `_sendAndWait('FA', 1500)` at the start. If that await had thrown (race condition during connect), `origFreq` would be an empty string and `send('FA')` would be sent as a bare query, not a set command. The `await` on line 440 is not wrapped in a try/catch, so a failure there propagates to the caller uncaught.
**Fix:**
```typescript
export async function scanMemoryChannels(from = 1, to = 99): Promise<void> {
  let origFreq = ''
  try {
    const resp = await _sendAndWait('FA', 1500)
    origFreq = resp.substring(2)
  } catch { /* proceed without restore */ }
  // ... rest of function
  try {
    await send('VM000')
    if (origFreq) await send('FA' + origFreq)
  } catch { }
```

---

### WR-04: `readMemoryChannel` hardcodes VFO 0 CTCSS/DCS query regardless of channel VFO

**File:** `composables/useSerial.ts:416-424`
**Issue:** After recalling a memory channel to the radio, the code queries CTCSS with `CN00` and DCS with `CN01` — these are always for VFO 0 (main). If the channel is recalled to VFO 1 (sub), the wrong CTCSS/DCS values would be read and stored for the channel. The VFO used for recall is hardcoded via `MC0` (main VFO). This is consistent but should be documented as an assumption.

More critically: `CN00` at line 417 is a query command sent via `_sendAndWait`. The response is `CN00NNN` where `NNN` is the 3-digit index. The code reads `parseInt(resp.substring(4), 10)` — correct for a `CN00NNN` response. However, `resp` as returned by `_sendAndWait` is the full raw response string from the serial port, which is the response after the command prefix. Wait — looking at `_handleResponse` line 224: `e.resolve(response)` where `response` is the full raw string including the `CN` prefix. So `resp = 'CN00042'` and `resp.substring(4) = '042'` — correct. This is fine.

The warning is the implicit assumption about VFO that should be documented.
**Fix:** Add a comment that `readMemoryChannel` always queries VFO 0 (main) for tone codes.

---

### WR-05: `onImportCsv` does not validate mode string against known modes

**File:** `pages/index.vue:2470`
**Issue:** `mode: p[4] || 'USB'` — the CSV mode column is used directly without validation. An attacker-controlled (or corrupted) CSV file could inject an arbitrary string as the mode. This string would then be passed to `writeMemoryChannel` → `MODE_CODE[config.mode ?? ''] ?? '2'`, which gracefully falls back to USB. So there is no security impact, but a bogus mode string (e.g. `"HACK"`) would silently be written as USB mode without any user feedback. The user would not know the import corrupted the mode.
**Fix:**
```typescript
const validModes = new Set(MODES.map(m => m.label))
mode: (validModes.has(p[4]) ? p[4] : null) || 'USB',
```

---

### WR-06: `exportCsv` uses synchronous `a.click()` without `document.body.appendChild` — may silently fail in some browsers

**File:** `pages/index.vue:2438`
**Issue:** The download anchor is created with `document.createElement('a')` and clicked without being appended to the DOM. Firefox requires the element to be in the document for `click()` to trigger a download. The pattern works in Chrome/Edge but is fragile.
**Fix:**
```typescript
document.body.appendChild(a)
a.click()
document.body.removeChild(a)
URL.revokeObjectURL(url)
```

---

### WR-07: `CommandResult` interface is declared twice — once in `useSerial.ts` and once locally in `index.vue`

**File:** `pages/index.vue:1065-1070`
**Issue:** `CommandResult` is defined in `composables/useSerial.ts` (lines 81–86) and imported at line 1039 as part of the named import. But at line 1065 it is re-declared locally as an identical `interface CommandResult`. TypeScript silently accepts this because the local declaration shadows the import. The import at line 1039 includes `type CommandResult` which is then unused (shadowed). This is dead code that creates a maintenance trap — if the canonical interface changes, the local shadow diverges silently.
**Fix:** Remove the local `CommandResult` interface declaration at lines 1065–1070 and rely on the imported type.

---

### WR-08: `setSquelch` sends a redundant AI read-back only for VFO 1, not VFO 0

**File:** `pages/index.vue:2006-2009`
**Issue:** After setting squelch for VFO 1, the code sends `SQ1` and `SQ0` read queries. This pattern exists for no documented reason and is not applied for VFO 0. If this is a workaround for a radio bug where SQ changes aren't pushed via AI, it should apply symmetrically to both VFOs and be documented. As written it will cause spurious SQ updates when setting sub squelch.
**Fix:** Either document why this only applies to VFO 1 and remove it if unnecessary, or apply it symmetrically. Likely this is vestigial debug code and should be removed.

---

## Info

### IN-01: `vitest.config.mts` does not configure `resolve.alias` for `~/` path prefix

**File:** `vitest.config.mts:1-13`
**Issue:** The test imports `from '../../composables/catParser'` and `from '../../composables/useSerial'` using relative paths. This works. But if any future test or the composable itself uses Nuxt's `~/' alias (e.g. `import X from '~/components/...'`), the tests will fail with a module resolution error because there is no `vite`/`vitest` alias configured for `~/`. The current composables do not use `~/`, so this is not a current failure — but it is a latent fragility.
**Fix:**
```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
export default defineConfig({
  resolve: {
    alias: { '~': resolve(__dirname, '.') },
  },
  test: { ... }
})
```

---

### IN-02: `_fireScopeRequery` sends bare `_write` commands without queue — race with solicited responses

**File:** `composables/useSerial.ts:237-245`
**Issue:** `_fireScopeRequery` writes SS commands directly via `_write` with no queue entries. This means when the responses arrive they will be treated as unsolicited AI frames, which is correct. However, if a `_sendAndWait` call is in progress for an `SS` command, the scope requery response could match the queue entry and resolve the wrong promise. The prefix matching at line 221 is `response.substring(0, 2) === prefix` — for `SS` commands this is broad. This is a minor race condition that could cause a `_sendAndWait('SS...')` call to resolve with a scope requery response rather than its own.
**Fix:** Either document this constraint (no `_sendAndWait` for SS commands) or route scope requeries through the queue.

---

### IN-03: Commented-out code left in production template

**File:** `pages/index.vue:174-178`, `185-188`, `248-251`
**Issue:** Multiple commented-out `<div class="freq-display">` and `BandwidthDisplay` blocks remain in the template. These are dead code and clutter the template.
**Fix:** Remove commented-out blocks or convert to a feature-flag pattern.

---

### IN-04: `onPresetExecuted` is a no-op

**File:** `pages/index.vue:1807`
**Issue:** `function onPresetExecuted(_results: CommandResult[]) {}` — the callback does nothing. The `CommandResult[]` array returned by `sendPreset` is discarded. If preset execution errors should surface in the UI (e.g. setting `lastError`), this needs implementation.
**Fix:** Either implement error surfacing or document that preset errors are intentionally silently discarded.

---

_Reviewed: 2026-05-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
