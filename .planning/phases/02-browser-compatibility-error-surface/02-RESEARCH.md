# Phase 2: Browser Compatibility + Error Surface — Research

**Researched:** 2026-05-09
**Domain:** Nuxt 3 static SPA head injection; Web Serial API secure-context detection; CAT error surfacing; serial disconnect handling
**Confidence:** HIGH

---

## Summary

Phase 2 has five tightly scoped requirements. Two require a pre-bundle browser gate (COMPAT-01/02); two require error propagation improvements within `useSerial.ts` (ERR-01/02); one requires wiring `navigator.serial` global events and a clean state reset (ERR-03).

All source files were read directly. Every technical claim below was verified against official docs or the live codebase.

The browser gate is the most architecturally novel piece: Nuxt 3 `app.head.script` with `innerHTML` renders inline scripts into the static HTML output from `nuxt generate`, and they run synchronously before the Vue/Nuxt bundle loads. No plugin, no custom build step. The remaining four requirements are localised edits to `useSerial.ts` and `index.vue` — no new files, no new dependencies.

**Primary recommendation:** Browser gate via `app.head.script[].innerHTML` in `nuxt.config.ts`. Error surfacing via enriched Error messages in `useSerial.ts`. Disconnect event on `navigator.serial` in a new `_wireSerialEvents()` called from `connect()`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMPAT-01 | Inline `<script>` before Nuxt bundle detects Web Serial support; renders full-page blocking message distinguishing "wrong browser" from "HTTP context" | `app.head.script[].innerHTML` with `tagPriority: 'critical'` in nuxt.config.ts; `window.isSecureContext` for context detection |
| COMPAT-02 | When insecure context detected, message explains HTTPS requirement, not browser/config issue | Flows from COMPAT-01 gate script; two distinct message strings |
| ERR-01 | `?;` responses surface with originating command name, not silently dropped | `_handleResponse` already has the queue entry at shift; pass `e.cmd` to `e.reject` |
| ERR-02 | Timeout errors surface with originating command name + "radio did not respond" | `_sendAndWait` already has `cmd` in closure; enrich the rejection message |
| ERR-03 | `navigator.serial` connect/disconnect events wired; stale state cleared on disconnect without page reload | `navigator.serial.addEventListener('disconnect', ...)` — fires on physical removal; clear state via `state.value = defaultState()` (already the pattern in `disconnect()`) |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Browser gate (COMPAT-01/02) | Browser (static HTML) | — | Must execute before any JS bundle loads; pure HTML/inline script |
| Secure context detection | Browser (inline script) | — | `window.isSecureContext` is available before any JS framework loads |
| `?;` error surfacing (ERR-01) | `useSerial.ts` module | `index.vue` (display) | Error originates in the command queue; display is already wired to `lastError` |
| Timeout surfacing (ERR-02) | `useSerial.ts` module | `index.vue` (display) | Error originates in `_sendAndWait`; same display path |
| Disconnect event (ERR-03) | `useSerial.ts` module | — | Global serial events belong with serial state management |

---

## Standard Stack

No new dependencies required for this phase. All capabilities use the existing stack.

### Core (existing — no changes)
| Library | Version | Purpose |
|---------|---------|---------|
| Nuxt 3 | `^3.x` (see package.json) | Framework — `app.head.script` drives COMPAT-01/02 |
| Vue 3 | peer of Nuxt | `shallowRef` reactive state |
| Web Serial API | Browser-native | `navigator.serial` events for ERR-03 |

### Installation
None. No new packages.

---

## Architecture Patterns

### System Architecture Diagram

```
[index.html from nuxt generate]
  └─ <script> (inline, tagPriority:'critical')       ← COMPAT-01/02
       ├─ 'serial' in navigator? NO → render blocking overlay, stop
       ├─ window.isSecureContext? NO → render HTTPS message, stop
       └─ isSecureContext YES + serial present → do nothing (Nuxt bundle loads)

[Nuxt bundle loads]
  └─ useSerial.ts module
       ├─ connect() → _wireSerialEvents() [new]       ← ERR-03
       │    └─ navigator.serial.addEventListener('disconnect', handler)
       │         └─ handler: _drainQueue(); state.value = defaultState()
       ├─ _handleResponse('?')                        ← ERR-01
       │    └─ e.reject(new Error(`CAT error: ${e.cmd}`))
       └─ _sendAndWait() timer                        ← ERR-02
            └─ reject(new Error(`Radio did not respond to ${cmd}`))

[index.vue]
  └─ lastError ref
       └─ toggleConnection / any async call → catch(e) → lastError.value = e.message
```

### Recommended Project Structure

No structural changes. Edits are confined to:
- `nuxt.config.ts` — add `app.head.script`
- `composables/useSerial.ts` — enrich error messages, add `_wireSerialEvents()`

---

## Pattern 1: Nuxt `app.head` Inline Script (COMPAT-01/02)

**What:** `nuxt.config.ts` `app.head.script` array entry with `innerHTML` renders the script tag verbatim in the static HTML output. `tagPriority: 'critical'` places it before Nuxt's own scripts.

**Source verification:** [VERIFIED: nuxt.com/docs/getting-started/seo-meta#app-head] — `innerHTML` confirmed. [VERIFIED: unhead.unjs.io/docs/head/guides/core-concepts/positions] — `tagPriority: 'critical'` = weight -8, renders before async scripts (weight 30).

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  // ...existing config...
  app: {
    head: {
      script: [
        {
          tagPriority: 'critical',
          innerHTML: `
(function() {
  var hasSerial = 'serial' in navigator;
  var isSecure  = window.isSecureContext;
  if (hasSerial && isSecure) return;
  var msg = hasSerial && !isSecure
    ? 'Web Serial API requires HTTPS. This page is being served over HTTP on a non-localhost address. This is a hosting issue, not a browser setting — use the HTTPS URL.'
    : 'Web Serial API is not supported in this browser. Use Google Chrome or Microsoft Edge on a desktop computer.';
  document.addEventListener('DOMContentLoaded', function() {
    var el = document.createElement('div');
    el.id = 'compat-gate';
    el.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;padding:2rem;text-align:center;z-index:9999';
    el.innerHTML = '<div style="font-size:2rem;margin-bottom:1rem">FTX-1 CAT Controller</div><div style="max-width:480px;line-height:1.6;color:#f85149">' + msg + '</div>';
    document.body.appendChild(el);
  });
})();
          `.trim(),
        },
      ],
    },
  },
})
```

**Key note:** `innerHTML` in `app.head.script` is the confirmed property name (not `textContent`). [VERIFIED: nuxt.com/docs/getting-started/seo-meta#app-head]

**Alternative considered:** A file in `public/` loaded via `<script src>` — rejected because it requires an extra HTTP request and cannot guarantee ordering relative to the bundle. `innerHTML` is synchronous and self-contained.

---

## Pattern 2: Secure Context Detection (COMPAT-01/02)

**What:** `window.isSecureContext` is the correct and complete check. It returns `true` for HTTPS, `localhost`, and `file://`; `false` for HTTP on non-localhost.

**Source verification:** [VERIFIED: developer.mozilla.org/en-US/docs/Web/API/Window/isSecureContext]

The gate needs two conditions and two distinct messages:

| Condition | `'serial' in navigator` | `window.isSecureContext` | Message |
|-----------|------------------------|--------------------------|---------|
| Right browser, right context | true | true | (no gate, load normally) |
| Right browser, wrong context (HTTP) | true | false | HTTPS required; hosting issue, not browser setting |
| Wrong browser | false | true or false | Use Chrome or Edge |

**Do not use:** `location.protocol === 'https:'` — misses `localhost` (always false there, so the gate would wrongly block local dev). [VERIFIED: MDN]

---

## Pattern 3: `?;` Error Surfacing (ERR-01)

**Existing code (useSerial.ts line 212–215):**
```ts
if (response === '?') {
  const e = _queue.shift()
  if (e) { clearTimeout(e.timer); e.reject(new Error('CAT error response')) }
  return
}
```

**Problem:** Error message `'CAT error response'` discards `e.cmd`. The calling code in `index.vue` does `catch(e) { lastError.value = e.message }`, so the command name never appears in the UI.

**Fix:** Enrich the error message with the command name from the queue entry.

```ts
// composables/useSerial.ts — _handleResponse, ?; branch
if (response === '?') {
  const e = _queue.shift()
  if (e) { clearTimeout(e.timer); e.reject(new Error(`Radio rejected command: ${e.cmd}`)) }
  return
}
```

No structural change. The `QueueEntry.cmd` field already holds the command string (line 158: `cmd: string`). [VERIFIED: codebase read]

---

## Pattern 4: Timeout Error Surfacing (ERR-02)

**Existing code (useSerial.ts line 251–255):**
```ts
const timer = setTimeout(() => {
  const idx = _queue.findIndex(e => e === entry)
  if (idx >= 0) _queue.splice(idx, 1)
  reject(new Error(`Timeout: ${cmd}`))
}, timeoutMs)
```

The command name is already in the message (`Timeout: ${cmd}`). The issue is the message format — `toggleConnection` displays it directly as `lastError.value = e.message`, so the user sees `Timeout: FA` which is cryptic.

**Fix:** Make the message user-readable.

```ts
reject(new Error(`Radio did not respond to ${cmd}`))
```

This is a one-word change. No structural change. [VERIFIED: codebase read]

---

## Pattern 5: Serial Disconnect Event + State Reset (ERR-03)

**What the Web Serial spec says:** The `disconnect` event fires on `navigator.serial` (bubbled from `SerialPort`) when a port is **physically removed**. It does NOT fire on `port.close()`. [VERIFIED: wicg.github.io/serial/#dom-serial-onconnect and developer.mozilla.org/en-US/docs/Web/API/SerialPort/disconnect_event]

**What this means for the implementation:**
- The existing `disconnect()` function handles graceful user-initiated disconnect correctly — it already calls `state.value = defaultState()` (line 364). [VERIFIED: codebase read]
- `ERR-03` requires an additional path for *physical* removal (USB cable pulled), which the current code does not handle.
- `_startReadLoop` already handles a closed port partially: when the read loop exits unexpectedly, it calls `_patch({ connected: false, autoInfo: false, port: null, error: 'Port closed' })` (line 204–206). This clears `connected` and `port` but does NOT reset VFO/S-meter/mode state — `mainFreq`, `subFreq`, `mainMode`, `mainSmeter`, etc. remain stale.

**Implementation approach:**

Add a `_wireSerialEvents()` function called once from `connect()` after the port is open. Use `navigator.serial.addEventListener('disconnect', ...)` to catch physical removal.

```ts
// composables/useSerial.ts

function _handlePhysicalDisconnect(event: Event): void {
  // Only act if the disconnected port is our active port
  if ((event as any).target !== _port) return
  _drainQueue(new Error('Serial port disconnected'))
  // Release locks before port becomes unavailable
  if (_reader) { try { _reader.cancel() } catch { } _reader = null }
  if (_writer) { try { _writer.releaseLock() } catch { } _writer = null }
  _port = null
  state.value = defaultState()
}

function _wireSerialEvents(): void {
  ;(navigator as any).serial.addEventListener('disconnect', _handlePhysicalDisconnect)
}

function _unwireSerialEvents(): void {
  ;(navigator as any).serial.removeEventListener('disconnect', _handlePhysicalDisconnect)
}
```

Call `_wireSerialEvents()` at the end of `connect()` on success, and `_unwireSerialEvents()` in `disconnect()`.

**`state.value = defaultState()` — does this trigger reactivity?** YES. Assigning a new object to `.value` on a `shallowRef` triggers reactivity. `Object.assign(state.value, ...)` would NOT trigger reactivity and would require `triggerRef(state)`. The existing pattern (`state.value = defaultState()`) is correct. [VERIFIED: vuejs.org/api/reactivity-advanced.html]

**Connect event (UX-01 is out of scope for Phase 2):** The `connect` event fires when a permitted port is physically re-plugged. Phase 2 does not include auto-reconnect (that is v2 UX-01). Wire only the `disconnect` event.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Secure context detection | Custom protocol/hostname parsing | `window.isSecureContext` (browser native, [VERIFIED: MDN]) |
| Script-before-bundle ordering | Custom webpack/vite plugin | `tagPriority: 'critical'` in `app.head.script` ([VERIFIED: unhead docs]) |
| Reactive state reset | `Object.assign` + `triggerRef` | `state.value = defaultState()` (new object assignment, already the pattern in `disconnect()`) |

---

## Common Pitfalls

### Pitfall 1: Using `location.protocol` instead of `isSecureContext`
**What goes wrong:** `location.protocol === 'https:'` returns `false` on `localhost` (which uses `http:`), causing the browser gate to incorrectly block local development.
**How to avoid:** Use `window.isSecureContext`. It returns `true` for localhost. [VERIFIED: MDN]
**Warning signs:** Gate blocks `http://localhost:3000` during local dev.

### Pitfall 2: `innerHTML` vs `textContent` in `app.head.script`
**What goes wrong:** Using `textContent` instead of `innerHTML` in the Nuxt script config object results in the script not rendering inline (Nuxt/unhead uses `innerHTML` as the property for inline script body). [VERIFIED: nuxt.com/docs/getting-started/seo-meta#app-head]
**How to avoid:** Use `innerHTML` property.

### Pitfall 3: Registering the disconnect listener inside the read loop
**What goes wrong:** If `_wireSerialEvents()` is called on every reconnect without a corresponding `removeEventListener`, the handler accumulates. Physical removal fires the handler N times.
**How to avoid:** `_handlePhysicalDisconnect` is a named function (not anonymous) so `removeEventListener` works. Call `_unwireSerialEvents()` in `disconnect()`.

### Pitfall 4: `disconnect` event fires — but `_port` is already null
**What goes wrong:** `disconnect()` (graceful) nulls `_port`, then if the physical `disconnect` event fires immediately after, `(event.target !== _port)` check would compare `SerialPort` to `null` and skip the handler — correct behaviour, no double-reset.
**How to avoid:** The `_port` guard in `_handlePhysicalDisconnect` handles this correctly. No special logic needed.

### Pitfall 5: `?;` error handling — `response === '?'` check
**What goes wrong:** The protocol arrives as `?` (no semicolon) because `_handleResponse` receives the string *after* the semicolon split. The existing code already checks `response === '?'` (not `'?;'`) — this is correct and must not be changed. [VERIFIED: codebase read — `_startReadLoop` splits on `;` at line 191]

### Pitfall 6: The compat gate blocks the Nuxt app from mounting
**What goes wrong:** If the gate appends its overlay div but the Nuxt app still mounts, it may overwrite the overlay or create a flash.
**How to avoid:** The gate must NOT call `return` before `DOMContentLoaded` if it wants to prevent Nuxt from mounting. The correct approach is to render the overlay but allow the Nuxt app to mount beneath it (z-index 9999 overlay). Nuxt SPA with `ssr:false` cannot be blocked pre-bundle without removing `<div id="__nuxt">` — the overlay approach is correct and simpler.

---

## State Reset on Disconnect — Completeness Check

The `_startReadLoop` error path (line 204–206) sets:
```ts
_patch({ connected: false, autoInfo: false, port: null, error: 'Port closed' })
```

This leaves stale: `mainFreq`, `subFreq`, `mainMode`, `subMode`, `mainSmeter`, `subSmeter`, `txState`, `mox`, `split`, `lock`, `agcMain`, `rfGainMain`, `afGainMain`, `sqMain`, and all other radio state fields.

The physical disconnect handler should call `state.value = defaultState()` (full reset, the same as the graceful `disconnect()` does). This matches the requirement: "stale VFO/status state is cleared on disconnect without requiring a page reload." [VERIFIED: codebase read — defaultState() at line 121 resets all fields]

---

## Environment Availability

Step 2.6: SKIPPED — Phase 2 is pure code/config changes with no new external dependencies or CLI tools. The existing node/npm/Nuxt dev server already available from Phase 1 is sufficient.

---

## Validation Architecture

`nyquist_validation: false` in `.planning/config.json`. Section omitted per instructions.

---

## Security Domain

No new attack surface introduced. The inline gate script renders user-visible text only — no DOM injection from user input. No new APIs, no new network calls, no new auth paths. Standard ASVS V5 input validation concern is not applicable (no inputs processed).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tagPriority: 'critical'` in `app.head.script` config entry renders before Nuxt bundle scripts in `nuxt generate` output | Pattern 1 | Gate runs after bundle; Nuxt app mounts before gate executes; flash of unsupported UI before overlay appears |
| A2 | `disconnect` event does NOT fire when `port.close()` is called by application code | Pattern 5 | Double-reset on graceful disconnect; harmless but redundant — `state.value = defaultState()` is idempotent |

**A1 mitigation:** Verify by running `npm run generate` and inspecting `.output/public/index.html` — the inline script should appear before `<script type="module">` entries.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: developer.mozilla.org/en-US/docs/Web/API/Window/isSecureContext] — `isSecureContext` definition, localhost coverage, comparison with `location.protocol`
- [VERIFIED: developer.mozilla.org/en-US/docs/Web/API/SerialPort/disconnect_event] — disconnect event fires on physical removal, not `port.close()`
- [VERIFIED: developer.mozilla.org/en-US/docs/Web/API/Serial] — `connect`/`disconnect` bubble from SerialPort to navigator.serial
- [VERIFIED: wicg.github.io/serial/#dom-serial-onconnect] — spec-level: disconnect is physical removal only
- [VERIFIED: vuejs.org/api/reactivity-advanced.html] — `shallowRef`: `.value = newObj` triggers reactivity; `Object.assign()` does not without `triggerRef`
- [VERIFIED: nuxt.com/docs/getting-started/seo-meta#app-head] — `innerHTML` property for inline scripts in `app.head.script`
- [VERIFIED: unhead.unjs.io/docs/head/guides/core-concepts/positions] — `tagPriority: 'critical'` = weight -8; renders before async scripts
- [VERIFIED: codebase — composables/useSerial.ts] — `QueueEntry.cmd`, `_handleResponse` `?` branch, `disconnect()` reset, `_startReadLoop` partial reset, `_patch` pattern

### Secondary (MEDIUM confidence)
- [CITED: nuxt.com/docs/api/nuxt-config#head] — `app.head.script` array structure

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; verified against existing codebase
- Architecture: HIGH — all claims traced to official docs or direct source reads
- Pitfalls: HIGH — derived from code analysis and verified API semantics

**Research date:** 2026-05-09
**Valid until:** 2026-08-09 (Web Serial API is stable; Nuxt/unhead head config is stable)
