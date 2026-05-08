# Phase 1: Testing Foundation + Bug Fixes — Research

**Researched:** 2026-05-08
**Domain:** Vitest setup for Nuxt 3 static SPA; TypeScript module extraction; CAT serial protocol bug fixes
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from STATE.md / ROADMAP.md)

### Locked Decisions
- Extract `_parseResponse` into `composables/catParser.ts` with pure function signature before writing any tests
- Use Vitest (not Jest) — ships with Nuxt 3 / Vite ecosystem
- `package.json` needs `"type": "module"` or vitest config must be named `.mts`

### Claude's Discretion
- Exact test file layout (`test/unit/` vs `tests/`)
- Whether to install `@nuxt/test-utils` now or defer to Phase 2 when component tests are needed
- Minimal vs two-project vitest config

### Deferred Ideas (OUT OF SCOPE)
- E2E tests with real serial hardware
- Vitest Browser Mode
- `@testing-library/vue`
- Component tests for `PresetButton.vue` or `index.vue`
- Refactoring `index.vue` into sub-composables
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | CAT protocol parsing logic extracted into `catParser.ts` — no Vue or Web Serial dependencies | Extraction design fully documented; all dependencies mapped |
| TEST-02 | `parseResponse()` unit tested with Vitest covering all 30+ CAT opcodes including edge cases | All opcodes catalogued; test patterns documented |
| TEST-03 | `defaultState()` exported from `useSerial.ts` so tests can construct a valid base state | `defaultState()` is already defined (line 148); needs `export` keyword only |
| TEST-04 | Vitest runs in CI before the Docker build step and fails the build on test failure | CI workflow structure identified; insertion point documented |
| TEST-05 | Test coverage report generated and available in CI artifacts | `@vitest/coverage-v8` + `actions/upload-artifact` pattern documented |
| BUG-01 | `scanMemoryChannels()` saves VFO before scan, restores in `try/finally`; TX disabled during scan | Code path fully audited; exact fix documented |
| BUG-02 | `readMemoryChannel()` reads CTCSS/DCS from `_sendAndWait()` return value, not `state.value.mainCtcssTone` | Bug location identified at line 726–729; fix pattern documented |
| BUG-03 | `toggleRfSql()` uses dedicated `rfSqlBusy` flag; removes `preAmpHf === null` guard | Bug at `index.vue:1841–1851`; exact copy-paste error identified |
| BUG-04 | Memory scan disables AI mode (`AI0`) before bulk reads, re-enables (`AI1`) after | Root cause (unsolicited/solicited race) documented; `AI0`/`AI1` insertion points identified |
| BUG-05 | Channel List tab switch sends `AI0`; switching away sends `AI1` | Tab switch mechanism at `index.vue:50–51` uses bare `@click`; watcher/handler pattern documented |
</phase_requirements>

---

## Summary

Phase 1 has two parallel workstreams: (1) stand up Vitest and make the CAT parser testable, (2) fix five production bugs in `useSerial.ts` and `index.vue`. Both workstreams are well-understood — the codebase has been fully audited and prior domain research covers test tooling.

The single highest-leverage task is extracting `_parseResponse` from `useSerial.ts` into `composables/catParser.ts` with a pure function signature. This extraction is a prerequisite for TEST-01 through TEST-03, and also enables cleaner fixes for BUG-02 and BUG-04 by making the parser side-effect-free. The extraction is surgical: the function body is ~290 lines, uses three read-only maps (`MODE_MAP`, `AGC_MAP`, `FUNC_KNOB`) and reads `state.value` only for `MR`/`MZ`/`MT`/`SS`/`VE` cases (to merge with existing sub-objects). Lifting `state.value` as a `current: TransceiverState` parameter removes all external dependencies. One async side-effect (`FD` fires scope re-queries via `_write`) must be lifted out of the parser into a separate callback in `useSerial.ts`.

The five bugs are independent and can be fixed in any order after the extraction. All five have HIGH-confidence root-cause analysis from the prior codebase audit.

**Primary recommendation:** Extract `catParser.ts` first (Wave 0), install Vitest + write tests (Wave 1), then fix all five bugs with test coverage verifying each fix (Wave 2), then wire CI (Wave 3).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CAT response parsing | Pure TS module (`catParser.ts`) | — | No I/O, no Vue; belongs in a testable module with no tier dependency |
| Serial I/O + command queue | `useSerial.ts` composable | — | Owns Web Serial port, queue, and `_patch` calls; not testable without hardware |
| AI mode management | `useSerial.ts` composable | `index.vue` (tab switch) | AI mode is a radio protocol concern; `index.vue` needs to signal on tab navigation |
| Reactive state | `useSerial.ts` (`shallowRef`) | — | Singleton module-level state; shared across all `useSerial()` calls |
| Test infrastructure | `test/unit/` (Node env) | CI workflow (GitHub Actions) | Pure function tests run in Node; coverage uploaded as CI artifact |
| CI/CD pipeline | `.github/workflows/azure-deploy.yml` | — | Test step inserted before Docker build; fails job on test failure |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vitest` | `^4.1.5` | Test runner | Vite-native; no Babel/Jest overhead; shares Nuxt's transform pipeline |
| `@vitest/coverage-v8` | `^4.1.5` | Code coverage | V8-based; faster and lower memory than istanbul; ships with vitest ecosystem |

[VERIFIED: npm registry — versions confirmed 2026-05-08 by prior research in `.planning/research/STACK.md`]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/w3c-web-serial` | `^1.0.8` | TypeScript types for Web Serial API | Needed in test setup files that stub `navigator.serial`; also useful in `useSerial.ts` |

[VERIFIED: npm registry — confirmed 2026-05-08 by prior research]

### Deferred (not needed this phase)
| Library | Reason to Defer |
|---------|-----------------|
| `@nuxt/test-utils` | Needed only for Nuxt component tests; Phase 1 tests are pure TS with no Vue |
| `@vue/test-utils` | Same — no component tests this phase |
| `happy-dom` | DOM environment; not needed for Node-environment unit tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vitest` | `jest` | Jest requires Babel + extra config for ESM/TypeScript; no benefit in a Vite project |
| `@vitest/coverage-v8` | `@vitest/coverage-istanbul` | Istanbul is slower, higher memory; V8 is correct choice for this stack |

**Installation:**
```bash
npm install -D vitest @vitest/coverage-v8 @types/w3c-web-serial
```

**Version verification:** Versions above confirmed against npm registry by prior research session (2026-05-08). Vitest 4.x is current as of that date.
[VERIFIED: npm registry — `.planning/research/STACK.md`]

---

## Architecture Patterns

### System Architecture Diagram

```
CAT response string (from serial port)
        |
        v
  _handleResponse()          <-- in useSerial.ts (serial-tier)
  [queue match / dispatch]
        |
        v
  parseResponse(cmd, params, current: TransceiverState)
                             <-- in catParser.ts (pure function tier)
  returns Partial<TransceiverState>
        |
        v
  _patch(delta)              <-- in useSerial.ts (state tier)
  state.value = { ...state.value, ...delta }
        |
        v
  Vue reactive state (shallowRef)
        |
        v
  index.vue / components (UI tier)
```

For the `FD` side-effect (scope re-query on scope-side change), the flow diverges:

```
parseResponse('FD', ...) returns { scopeSide: N }  (no async side-effect)
        |
        v
  _handleResponse() sees delta.scopeSide changed
        v
  _fireScopeRequery(side)    <-- new private fn in useSerial.ts
  fires _write() calls for scope params
```

### Recommended Project Structure
```
composables/
├── catParser.ts      # pure parseResponse() function + all decode maps
└── useSerial.ts      # serial I/O, command queue, state singleton (imports catParser)
test/
└── unit/
    ├── catParser.test.ts     # 30+ opcode tests + edge cases
    └── catParser.edge.test.ts  # (optional) sourceCmd disambiguation, FD side-effect isolation
vitest.config.ts              # minimal node-environment config
```

### Pattern 1: Pure Parser Extraction

**What:** `_parseResponse` is extracted verbatim, signature changes from `(cmd, params, sourceCmd?)` to `(cmd: string, params: string, current: TransceiverState, sourceCmd?: string | null): Partial<TransceiverState>`. The `const s = state.value` inside becomes `const s = current`. The `_patch(ch)` call at the end is removed — the caller does `_patch(parseResponse(...))`.

**When to use:** Whenever a function reads external state as a read-only snapshot and produces a delta object; this is the standard pattern for extracting testable pure functions from Vue composables.

**Example (catParser.ts):**
```typescript
// Source: derived from composables/useSerial.ts _parseResponse (lines 262–555)
import type { TransceiverState } from './useSerial'

export { MODE_MAP, MODE_CODE, AGC_MAP, FUNC_KNOB }  // re-export for tests

export function parseResponse(
  cmd: string,
  params: string,
  current: TransceiverState,
  sourceCmd: string | null = null,
): Partial<TransceiverState> {
  const s = current
  const ch: Partial<TransceiverState> = {}
  switch (cmd) {
    case 'FA': ch.mainFreq = parseInt(params, 10) || null; break
    // ... remaining cases verbatim, substituting `s` for `state.value`
  }
  // FD case: return only scopeSide; do NOT fire _write here
  // VE case: use s.firmware (already renamed from state.value.firmware)
  return ch
}
```

**Example (useSerial.ts call site):**
```typescript
import { parseResponse } from './catParser'

// In _handleResponse:
_parseResponse(prefix, response.substring(2), state.value, e.cmd)
// becomes:
_patch(parseResponse(prefix, response.substring(2), state.value, e.cmd))

// FD side-effect: after patching, caller checks if scopeSide changed
// and calls _fireScopeRequery(side) if needed.
```

### Pattern 2: Minimal Vitest Config (node environment only)

**What:** Single-project config targeting `test/unit/**` in Node environment. No Nuxt runtime, no DOM. Sufficient because all Phase 1 tests are pure TypeScript.

```typescript
// vitest.config.ts
// Source: [CITED: vitest.dev/guide/projects]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['composables/catParser.ts'],
      reporter: ['text', 'lcov'],
    },
  },
})
```

**Note:** `package.json` must have `"type": "module"` for this config filename to work. If `"type": "module"` is not added, rename to `vitest.config.mts`. [VERIFIED: `.planning/research/STACK.md`]

### Pattern 3: Test Structure for CAT Opcode Coverage

```typescript
// test/unit/catParser.test.ts
import { describe, test, expect } from 'vitest'
import { parseResponse } from '../../composables/catParser'
import type { TransceiverState } from '../../composables/useSerial'

function base(): TransceiverState {
  return defaultState()  // imported from useSerial after TEST-03 export
}

describe('FA — main frequency', () => {
  test('parses 14 MHz', () => {
    const delta = parseResponse('FA', '00014225000', base())
    expect(delta.mainFreq).toBe(14225000)
  })
  test('returns null for zero frequency', () => {
    const delta = parseResponse('FA', '00000000000', base())
    expect(delta.mainFreq).toBeNull()
  })
})

describe('MR — memory channel', () => {
  test('merges channel preserving existing ctcssIdx', () => {
    const current = base()
    current.radioChannels[1] = { slot: 1, freq: 14000000, ctcssIdx: 5, dcsIdx: null,
      txFreq: null, splitMem: false, mode: 'USB', sqlType: 1,
      clarDir: null, clarOffset: null, rxClar: false, txClar: false, shift: 0, tag: null }
    const delta = parseResponse('MR',
      '0000114225000+000001100USB00', current)
    expect(delta.radioChannels![1].ctcssIdx).toBe(5)  // preserved from current
    expect(delta.radioChannels![1].freq).toBe(14225000)
  })
})

describe('FD — scope side (no async side-effect)', () => {
  test('returns only scopeSide', () => {
    const delta = parseResponse('FD', '1', base())
    expect(delta.scopeSide).toBe(1)
    expect(Object.keys(delta)).toEqual(['scopeSide'])
  })
})
```

### Pattern 4: CI Test Step Before Docker Build

**What:** Insert a Node.js setup + test step in `.github/workflows/azure-deploy.yml` before step 4 (Docker build). If `npm test` fails, the job fails and Docker build never runs.

```yaml
# Insert after step 1 (Checkout), before step 2 (Azure Login)
- name: Set up Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'npm'

- name: Install dependencies
  run: npm ci

- name: Run tests
  run: npm test -- --run

- name: Upload coverage
  uses: actions/upload-artifact@v4
  with:
    name: coverage-${{ github.sha }}
    path: coverage/
    if-no-files-found: warn
```

[ASSUMED] `actions/setup-node@v4` and `actions/upload-artifact@v4` are the current major versions. Verify against github.com/actions when writing the workflow update.

### Anti-Patterns to Avoid

- **Using `test.workspace` key in vitest config:** Deprecated since Vitest 3.2; use `test.projects` for multi-project setups. [VERIFIED: `.planning/research/STACK.md`]
- **Installing `@nuxt/test-utils` for unit tests:** Brings Playwright as a peer dep (~100 MB); not needed for pure TypeScript tests. Defer to Phase 2.
- **Using `vi.useFakeTimers()` without cleanup:** `_sendAndWait` uses `setTimeout`; fake timers interact with the queue and leak state between tests. Prefer short real timeouts (`_sendAndWait(cmd, 50)`) for timeout tests, or always call `vi.useRealTimers()` in `afterEach`.
- **Reading `state.value` fields after `await _sendAndWait()`:** An unsolicited AI frame can overwrite the field in the microtask gap. Always parse the return value directly (BUG-02 fix pattern).
- **Leaving `FD` async side-effect inside `parseResponse`:** Makes the function impure and untestable; the side-effect fires `_write` calls which require an open serial port. Lift it to `useSerial.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code coverage | Custom coverage script | `@vitest/coverage-v8` | V8 coverage is built into the runtime; hand-rolled coverage misses branches |
| CI artifact upload | Custom artifact storage | `actions/upload-artifact@v4` | GitHub Actions provides native artifact storage with retention and UI download |
| Web Serial mock for unit tests | Custom mock factory | Not needed for Phase 1 | CAT parser tests are pure function tests; no mock required once extraction is done |

**Key insight:** The extraction of `_parseResponse` into a pure function eliminates the need for any Web Serial mocking in Phase 1 tests. Tests call `parseResponse(cmd, params, base())` with no I/O whatsoever.

---

## Bug Fix Specifications

### BUG-01: `scanMemoryChannels()` — VFO save/restore

**Current code** (`useSerial.ts:741–747`):
```typescript
export async function scanMemoryChannels(from = 1, to = 99): Promise<void> {
  await send('VM011')
  for (let i = from; i <= to; i++) {
    if (!state.value.connected) break
    await readMemoryChannel(i)
  }
}
```

**Problem:** No VFO save before scan, no restore on error or completion. Radio is left parked on the last scanned channel slot. `VM011` sets VFO mode to memory mode but there is no corresponding `VM000` + frequency restore.

**Fix pattern:**
```typescript
export async function scanMemoryChannels(from = 1, to = 99): Promise<void> {
  // 1. Save current VFO frequency
  const origFreqResp = await _sendAndWait('FA', 1500)
  const origFreq = origFreqResp.substring(2)  // e.g. '00014225000'

  await send('VM011')
  try {
    for (let i = from; i <= to; i++) {
      if (!state.value.connected) break
      await readMemoryChannel(i)
    }
  } finally {
    // 2. Restore VFO frequency regardless of success/error
    try {
      await send('VM000')
      await send('FA' + origFreq)
    } catch { /* best effort */ }
  }
}
```

**TX controls:** BUG-01 requirement says TX controls are disabled during scan. The UI `scanRadioMemory()` already sets `radioMemScanning.value = true`. The template must gate TX controls on `!radioMemScanning`. This is a template change in `index.vue`, not a composable change.
[VERIFIED: codebase audit — `index.vue:2632–2639`]

### BUG-02: `readMemoryChannel()` — stale global state for CTCSS/DCS

**Current code** (`useSerial.ts:725–729`):
```typescript
if (sqlType <= 2) {
  try { await _sendAndWait('CN00', 1000); ctcssIdx = state.value.mainCtcssTone } catch { }
} else {
  try { await _sendAndWait('CN01', 1000); dcsIdx = state.value.mainDcsCode } catch { }
}
```

**Problem:** After `_sendAndWait` resolves, `state.value.mainCtcssTone` is read. But an unsolicited `CN` AI frame could have clobbered that field in the microtask gap between resolution and the read.

**Fix pattern:** The `CN00` response string is `CN` + params where params format is `<vfo><type><3-digit-index>` (per the `CN` case in `_parseResponse`). Parse the return value directly:
```typescript
if (sqlType <= 2) {
  try {
    const resp = await _sendAndWait('CN00', 1000)
    // resp = 'CN0003' where last 3 chars are the tone index
    const idx = parseInt(resp.substring(4), 10)
    ctcssIdx = isNaN(idx) ? null : idx
  } catch { }
} else {
  try {
    const resp = await _sendAndWait('CN01', 1000)
    const idx = parseInt(resp.substring(4), 10)
    dcsIdx = isNaN(idx) ? null : idx
  } catch { }
}
```

**Note:** The exact byte offsets in the `CN` response depend on the full response string format. The response from `_sendAndWait('CN00')` is the raw string returned by `e.resolve(response)` in `_handleResponse` — the full `CN0000XX` or `CN0100XX` format. Verify offsets against the `CN` case in `_parseResponse` lines 437–449.
[VERIFIED: codebase audit — `useSerial.ts:436–449` and `useSerial.ts:725–729`]

### BUG-03: `toggleRfSql()` — copy-paste guard from `togglePreAmpHf`

**Current code** (`index.vue:1841–1851`):
```typescript
async function toggleRfSql() {
  if (preAmpBusy.value || state.value.preAmpHf === null) return
  preAmpBusy.value = true
  try {
    const next = ((state.value.sqlRfMode) + 1) % 3
    await send(`EX030102${next}`)
  } catch (e: any) { lastError.value = e.message } finally { preAmpBusy.value = false }
  try {
    await send(`EX030102`)
  } catch (e: any) { lastError.value = e.message } finally {  }
}
```

**Problems:**
1. Guard `preAmpBusy.value || state.value.preAmpHf === null` is copy-pasted from `togglePreAmpHf`. `preAmpHf` has nothing to do with RF/SQL mode.
2. Uses shared `preAmpBusy` flag instead of its own flag.
3. `preAmpBusy` is set to `false` in the first `finally` block, before the second `try/catch` executes — so the busy guard is not actually preventing re-entrance during the follow-up EX query.

**Fix pattern:**
```typescript
const rfSqlBusy = ref(false)  // add alongside preAmpBusy at line 1085

async function toggleRfSql() {
  if (rfSqlBusy.value) return
  rfSqlBusy.value = true
  try {
    const next = ((state.value.sqlRfMode ?? 0) + 1) % 3
    await send(`EX030102${next}`)
    await send(`EX030102`)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    rfSqlBusy.value = false
  }
}
```

[VERIFIED: codebase audit — `index.vue:1085,1841–1851`]

### BUG-04: AI mode disable/re-enable around memory scan

**Root cause:** During bulk memory reads, the radio is in AI1 (Auto Information) mode. Unsolicited frames (`FA`, `MD`, `CT`, `CN`, etc.) share the same 2-character prefix as solicited responses. `_handleResponse` matches by prefix only (`_queue[0].cmd.substring(0, 2) === prefix`), so an unsolicited `FA` frame can resolve a queued `FA` query with stale data.

**Fix location:** `scanMemoryChannels()` in `useSerial.ts`.

**Fix pattern:**
```typescript
export async function scanMemoryChannels(from = 1, to = 99): Promise<void> {
  const origFreqResp = await _sendAndWait('FA', 1500)
  const origFreq = origFreqResp.substring(2)

  // Disable AI mode before bulk reads — prevents unsolicited frames from
  // resolving solicited queue entries with stale data (BUG-04)
  try { await _sendAndWait('AI0', 1000) } catch { /* ignore */ }

  await send('VM011')
  try {
    for (let i = from; i <= to; i++) {
      if (!state.value.connected) break
      await readMemoryChannel(i)
    }
  } finally {
    try {
      await send('VM000')
      await send('FA' + origFreq)
    } catch { /* best effort */ }
    // Re-enable AI mode after scan
    try { await _sendAndWait('AI1', 1000) } catch { /* ignore */ }
  }
}
```

[VERIFIED: codebase audit — `useSerial.ts:741–747`; pitfall analysis — `.planning/research/PITFALLS.md`]

### BUG-05: Channel List tab switch sends AI0/AI1

**Current state:** `index.vue:50–51` — tab switching is plain `@click="activeTab = 'channels'"` with no side effects. No AI mode change is sent.

**Problem:** The Channel List tab performs bulk memory reads (`scanMemoryChannels`). While the tab is active, unsolicited AI frames can corrupt channel read operations (same root cause as BUG-04). The tab should disable AI while the user is in channel-list mode.

**Fix pattern:** Add a `watch` on `activeTab` in `index.vue`:
```typescript
// index.vue — add after activeTab declaration (line 1089)
watch(activeTab, async (newTab, oldTab) => {
  if (!state.value.connected) return
  if (newTab === 'channels') {
    try { await send('AI0') } catch { /* best effort */ }
  } else if (oldTab === 'channels') {
    try { await send('AI1') } catch { /* best effort */ }
  }
})
```

**Alternative:** Handle in the `@click` handlers directly on the tab buttons. The `watch` approach is cleaner and captures all navigation paths (including programmatic tab changes).

[VERIFIED: codebase audit — `index.vue:50–51,1089`]

---

## Common Pitfalls

### Pitfall 1: FD Async Side-Effect Lost During Extraction

**What goes wrong:** The `FD` case in `_parseResponse` currently fires `_write` calls asynchronously via an IIFE. If this IIFE is moved into `catParser.ts`, `parseResponse` acquires a dependency on `_write` (which requires an open serial port). Tests calling `parseResponse('FD', '1', base())` would fail because `_write` throws `'Not connected'`.

**Why it happens:** The `FD` side-effect is architecturally misplaced inside the parser; the parser should only return state deltas.

**How to avoid:** Remove the IIFE from the `FD` case in `catParser.ts`. The `FD` handler should only set `ch.scopeSide`. Lift the re-query logic to `useSerial.ts` — after `_patch(parseResponse(...))`, check if `scopeSide` changed in the delta and call `_fireScopeRequery(side)`.

**Write a test** to lock in this contract:
```typescript
test('FD returns only scopeSide delta, no side effects', () => {
  const delta = parseResponse('FD', '1', base())
  expect(delta).toEqual({ scopeSide: 1 })
})
```
[VERIFIED: codebase audit — `useSerial.ts:270–282`]

### Pitfall 2: `_parseResponse` Reads `state.value` for 5 Case Groups

**What goes wrong:** The extraction looks trivial but `_parseResponse` reads `state.value` (aliased as `s`) in five places:
- `MR` — `s.radioChannels` to preserve `ctcssIdx`/`dcsIdx`/`tag`/`txFreq`/`splitMem` from prior reads
- `MZ` — `s.radioChannels[slot]` guard and existing channel data
- `MT` — `s.radioChannels[slot]` guard
- `SS` — `s.scope` to spread existing scope fields
- `VE` — `s.firmware` to spread existing firmware fields

All these read `s` as a snapshot (not a setter). Passing `current: TransceiverState` as a parameter satisfies all of them.

**How to avoid:** Pass `state.value` as `current` at every `_parseResponse` call site. Verify with `npx tsc --noEmit` after extraction.
[VERIFIED: codebase audit — `useSerial.ts:399,477,503–519,529–538,545–550`]

### Pitfall 3: `"type": "module"` May Break Nuxt Config

**What goes wrong:** Adding `"type": "module"` to `package.json` changes how Node resolves `nuxt.config.ts` and other config files. Nuxt 3 supports ESM natively, but any `require()` calls in config files (e.g., legacy plugins) will break.

**Why it happens:** `"type": "module"` makes `.js` files ESM by default; CJS files must use `.cjs` extension.

**How to avoid:** Inspect `nuxt.config.ts` — it uses only `defineNuxtConfig` and `new Date()`, no `require()`. The risk is low. Alternative: rename vitest config to `vitest.config.mts` instead of adding `"type": "module"` — this is the safer approach if any doubt exists.

**The safer path for this project:** Use `vitest.config.mts` (rename) rather than modifying `package.json`. The Nuxt config is clean but `"type": "module"` is a broad change.
[ASSUMED] Whether `.mts` vs `"type": "module"` is the cleaner approach depends on whether any other tooling in the project (e.g., `postinstall` scripts) has CJS assumptions. Confirm by running `npm install` after making the change and checking for errors.

### Pitfall 4: Module-Level State in `useSerial.ts` Leaks Between Tests

**What goes wrong:** `useSerial.ts` exports module-level variables (`state`, `_queue`, `_port`, etc.). If any test imports `useSerial` and leaves the queue populated, subsequent tests see unexpected queue state.

**How to avoid:** Phase 1 tests only import `catParser.ts` (pure function, zero module-level state). This pitfall only applies if tests for `useSerial` itself are added. Keep Phase 1 tests in `test/unit/catParser.test.ts` importing only from `catParser.ts`.
[VERIFIED: `.planning/research/PITFALLS.md`]

### Pitfall 5: `npm test` vs `npm test -- --run` in CI

**What goes wrong:** `vitest` without `--run` starts in watch mode and hangs the CI job indefinitely.

**How to avoid:** CI must use `npm test -- --run` or `npx vitest run`. Add `"test": "vitest run"` to `package.json` scripts so `npm test` is always non-interactive.
[VERIFIED: vitest.dev documentation behavior — CITED]

---

## Code Examples

### Exporting `defaultState` (TEST-03)

Current declaration at `useSerial.ts:148`:
```typescript
function defaultState(): TransceiverState {
```
Change to:
```typescript
export function defaultState(): TransceiverState {
```

No other changes required. One-word diff.

### CAT Opcode Coverage Targets (TEST-02)

All 30+ cases that must be covered by `parseResponse` tests:

| Opcode | Key Test Cases |
|--------|----------------|
| `FA` | 14 MHz, 0 Hz (null), valid 9-digit |
| `FB` | Same as FA for sub VFO |
| `FD` | Returns only `{ scopeSide: 1 }` or `{ scopeSide: 0 }` |
| `MD` | Main VFO (`0`) USB/FM-N (triggers narrowMain), Sub VFO (`1`) |
| `SM` | VFO 0 vs 1 with sourceCmd disambiguation |
| `TX` | `1`, `2` (both true), `0` (false) |
| `MX` | `1` true, `0` false |
| `ST` | Split on/off |
| `GT` | AGC_MAP all 7 values for main and sub |
| `RG` | Main/sub RF gain integer |
| `AG` | Main/sub AF gain integer |
| `SQ` | Main/sub squelch |
| `PC` | Power level `1XX` format |
| `AO` | AMC level |
| `MG` | Mic gain |
| `PR` | Speech proc: only updates when params[0] === '1' |
| `PL` | Proc level |
| `VX` | VOX on/off |
| `VG` | VOX gain |
| `RM` | Mode 0 (both), 1 (main), 2 (sub), 3-char slice |
| `RL` | DNR: 0 = 'OFF', non-zero = number |
| `RI` | 8-bit field, all subfields |
| `IF` | params length guard, freq substring 5–14, mode byte 21 |
| `OI` | Same as IF for sub |
| `SF` | FUNC_KNOB map |
| `VE` | All 6 firmware sub-fields (0–5), spread preserves others |
| `EX` | `030704` → antSelect; `030102` → sqlRfMode |
| `RA` | rfAttenuator true/false |
| `PA` | band 0/1/2 for HF/VHF/UHF preamp |
| `FT` | txVfo 0/1 |
| `FR` | rxMode `'01'` = single, else dual |
| `CT` | sourceCmd disambiguation, main/sub sqlType |
| `CN` | vfo 0/1, type 0 (CTCSS) vs 1 (DCS), index parse |
| `SH` | sourceCmd disambiguation, bandwidth |
| `IS` | Main/sub shift |
| `NA` | sourceCmd disambiguation, narrow mode |
| `LK` | Lock true/false |
| `SS` | All 7 sub-params (0/2/3/4/5/6/7), scope spread |
| `AI` | autoInfo true/false |
| `MR` | slot > 0 guard, channel merge (preserves ctcssIdx/tag/txFreq) |
| `MZ` | Guard requires existing radioChannels entry; splitMem/txFreq |
| `MT` | Guard requires existing entry; tag trimEnd |

Total: 40 opcodes (30+ as required by TEST-02).

### `package.json` Scripts to Add

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `test.workspace` config key | `test.projects` | Vitest 3.2 | Workspace config files no longer needed |
| Istanbul coverage | V8 coverage | Vitest 1.x onward | V8 is faster, no instrumentation overhead |
| `@nuxt/test-utils` for all tests | Separate Node + Nuxt environments | `@nuxt/test-utils` v4 | Pure TS tests run without Nuxt overhead |

**Deprecated/outdated:**
- `test.workspace` key: Replaced by `test.projects` in vitest config. Do not use vitest tutorials that reference `vitest.workspace.ts` files.
[VERIFIED: `.planning/research/STACK.md` — vitest.dev/guide/projects]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `actions/setup-node@v4` and `actions/upload-artifact@v4` are the current major versions for GitHub Actions | Architecture Patterns → Pattern 4 | Wrong version tag fails CI job; easy to verify and correct |
| A2 | `"type": "module"` in `package.json` is safe for this project's Nuxt config and postinstall scripts | Common Pitfalls → Pitfall 3 | Could break `nuxt prepare` or other scripts; mitigation: use `vitest.config.mts` instead |
| A3 | The `CN` response from `_sendAndWait('CN00')` has tone index starting at byte offset 4 (`resp.substring(4)`) | BUG-02 fix pattern | Wrong offset silently stores wrong tone index; verify against `_parseResponse` CN case at useSerial.ts:436–449 |

---

## Open Questions (RESOLVED)

1. **`vitest.config.mts` vs `"type": "module"`**
   - What we know: Both work; `.mts` is targeted, `"type": "module"` is broad
   - What's unclear: Whether any postinstall script or indirect dep uses `require()`
   - Recommendation: Use `vitest.config.mts` (safer, narrower change)
   - **RESOLVED — plan 01-02 uses vitest.config.mts extension; no package.json type:module change needed**

2. **BUG-01 TX disable — template change scope**
   - What we know: `radioMemScanning` ref exists in `index.vue`; needs to gate TX controls
   - What's unclear: Exactly which controls constitute "TX controls" — `MOX` button, `TUNE`, all `send`-based controls?
   - Recommendation: Disable at minimum: MOX toggle, TUNE button, preset execution during scan. The `radioMemScanning` flag is already set; it's a template `:disabled` binding addition.
   - **RESOLVED — plan 01-05 adds `:clickable="!radioMemScanning"` to MOX StatusBadge and `:connected="state.connected && !radioMemScanning"` to PresetButton; TUNER badge is status-only with no toggle handler and requires no change**

3. **BUG-05 scope: `send('AI0')` vs `_sendAndWait('AI0')`**
   - What we know: `send()` is fire-and-forget; `_sendAndWait` confirms the mode change via the `AI` response
   - What's unclear: Whether the Channel List tab switch needs to confirm AI mode is actually disabled before bulk reads start
   - Recommendation: Use `send('AI0')` in the tab watcher (async, non-blocking); the scan itself can use `_sendAndWait('AI0')` for the critical pre-scan disable (BUG-04 fix already does this)
   - **RESOLVED — plan 01-05 uses send('AI0') (fire-and-forget) in the tab watcher; _sendAndWait is unnecessary for tab-switch AI toggle**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, npm ci | [check CI image] | node:22-alpine in Dockerfile | — |
| npm | `npm ci` in CI test step | ✓ | ships with Node | — |
| Vitest | TEST-01 through TEST-05 | ✗ (not installed) | To be installed: `^4.1.5` | None — install required |
| GitHub Actions `actions/setup-node` | CI test step | ✓ | Standard action | — |

**Missing dependencies with no fallback:**
- Vitest is not installed — `npm install -D vitest @vitest/coverage-v8` required in Wave 0

**Step 2.6: No external services required.** This phase touches only local TypeScript files, `package.json`, and the GitHub Actions workflow. No databases, no runtime services, no Docker required for tests.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.5 |
| Config file | `vitest.config.mts` (to be created in Wave 0) |
| Quick run command | `npm test` (= `vitest run`) |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | `catParser.ts` imports cleanly in Node with no Vue/serial deps | unit | `npm test` | ❌ Wave 0 |
| TEST-02 | All 40 opcodes parsed correctly with edge cases | unit | `npm test` | ❌ Wave 0 |
| TEST-03 | `defaultState()` exported; tests can call it | unit | `npm test` | ❌ Wave 0 |
| TEST-04 | CI fails if any test fails | smoke (CI) | CI run on PR | ❌ Wave 0 |
| TEST-05 | Coverage artifact uploaded in CI | smoke (CI) | CI run | ❌ Wave 0 |
| BUG-01 | `scanMemoryChannels` restores VFO in `finally` | unit (composable logic) | manual verify | ❌ — structure verified by code review |
| BUG-02 | `readMemoryChannel` uses return value not global state | unit | manual verify | ❌ — inline parse removes race |
| BUG-03 | `toggleRfSql` works when `preAmpHf === null` | unit | manual verify | ❌ — guard removal verified by test |
| BUG-04 | AI0 sent before scan, AI1 sent after | unit | `npm test` | ❌ Wave 0 |
| BUG-05 | Tab switch sends AI0/AI1 | unit (watcher) | manual verify | ❌ — watcher logic |

### Sampling Rate
- **Per task commit:** `npm test` (vitest run, ~seconds)
- **Per wave merge:** `npm run test:coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `composables/catParser.ts` — extracted from `useSerial.ts` (TEST-01 prerequisite)
- [ ] `vitest.config.mts` — minimal node-environment config
- [ ] `test/unit/catParser.test.ts` — 40+ opcode assertions (TEST-02)
- [ ] `npm install -D vitest @vitest/coverage-v8` — installs test runner

---

## Security Domain

This phase does not introduce authentication, session management, cryptography, or user-submitted data paths. It is a refactor + test infrastructure phase.

| ASVS Category | Applies | Note |
|---------------|---------|------|
| V2 Authentication | No | No auth changes |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | No access changes |
| V5 Input Validation | No | No new user input paths (DATA-01 is Phase 3) |
| V6 Cryptography | No | No cryptographic operations |

No new threat surface is introduced. The existing `send()` fire-and-forget pattern is unchanged; error surfacing (ERR-01/ERR-02) is Phase 2.

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — Vitest versions verified against npm registry 2026-05-08
- `.planning/research/PITFALLS.md` — Serial race conditions, bug root causes from direct codebase audit
- `.planning/research/SUMMARY.md` — Architecture extraction design
- `.planning/codebase/TESTING.md` — Test infrastructure gap analysis
- `.planning/codebase/CONCERNS.md` — Bug locations with exact line numbers
- `composables/useSerial.ts` — Full source audit (lines 1–797)
- `pages/index.vue` — BUG-03 and BUG-05 locations (lines 50–51, 1085, 1841–1851, 2632–2639)
- `.github/workflows/azure-deploy.yml` — CI structure for test step insertion

### Secondary (MEDIUM confidence)
- [CITED: vitest.dev/guide/projects] — `test.projects` API (replaces deprecated `test.workspace`)
- [CITED: vitest.dev/guide/coverage] — V8 coverage configuration
- [CITED: nuxt.com/docs/getting-started/testing] — Nuxt 3 test setup patterns

### Tertiary (LOW confidence / ASSUMED)
- A3: `CN` response byte offsets for BUG-02 fix — confirmed by reading `_parseResponse` CN case but not verified against a live radio response log

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry
- Architecture (extraction design): HIGH — derived from reading all 797 lines of useSerial.ts
- Bug fix specifications: HIGH — root causes from direct codebase audit, not speculation
- CI pattern: MEDIUM — standard GitHub Actions pattern; action versions need verification

**Research date:** 2026-05-08
**Valid until:** 2026-08-08 (Vitest moves fast; re-verify versions if > 30 days old)
