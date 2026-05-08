# Architecture for Testable CAT Protocol Parsing

**Context:** `composables/useSerial.ts` — ~800 lines, mixing Web Serial lifecycle with 30+ CAT frame decoders in `_parseResponse()`. The decoder reads from `state.value` (for MR/MZ/MT channel merging and VE firmware spreading) and calls `_patch()` to apply changes. It also spawns async side-effects in the FD case (re-querying scope params). The goal is maximum test coverage with minimal refactoring.

---

## Extraction strategy

Extract `_parseResponse` as a **pure function** in a new file `composables/catParser.ts`. The function signature changes from:

```ts
// Before (private, side-effectful)
function _parseResponse(cmd: string, params: string, sourceCmd: string | null = null): void
```

to:

```ts
// After (pure, exported)
export function parseResponse(
  cmd: string,
  params: string,
  current: TransceiverState,
  sourceCmd?: string | null,
): Partial<TransceiverState>
```

Instead of reading `state.value` directly and calling `_patch()`, the function receives the current state as a plain argument and returns the partial update. The caller (`_handleResponse` in `useSerial.ts`) is responsible for calling `_patch()` with the result.

The one non-pure case — the `FD` handler that spawns async serial writes — stays in `useSerial.ts`. The `FD` branch in `parseResponse` returns only the state change (`{ scopeSide }`); the async re-query is triggered by the caller after it sees a `scopeSide` change in the result. This keeps the parser dependency-free.

The decode maps (`MODE_MAP`, `MODE_CODE`, `AGC_MAP`, `FUNC_KNOB`) move to `catParser.ts` because they belong to the protocol layer. They are re-exported from `useSerial.ts` so any existing callers (there are none currently, but `writeMemoryChannel` uses `MODE_CODE` internally) keep working without import path changes.

---

## File/module boundaries

**New file: `composables/catParser.ts`**

Contains:
- `MODE_MAP`, `MODE_CODE`, `AGC_MAP`, `FUNC_KNOB` (moved from `useSerial.ts`)
- `parseResponse(cmd, params, current, sourceCmd?)` — pure, no side effects, no Vue imports, no Web Serial imports
- Re-exports the maps so `useSerial.ts` can re-export them transparently

Does NOT contain:
- Any reference to `state`, `_patch`, `_write`, `_port`, or any Vue reactive primitive
- The `FD` async side-effect — only the state portion `{ scopeSide }` is returned

**Modified file: `composables/useSerial.ts`**

Changes:
- Remove `MODE_MAP`, `MODE_CODE`, `AGC_MAP`, `FUNC_KNOB` (import from `catParser.ts`)
- Remove the body of `_parseResponse` (keep a one-liner that calls `parseResponse` and feeds `_patch`)
- Add `FD` side-effect handling in `_handleResponse` (check if returned patch contains `scopeSide`, then fire the async re-query)
- Everything else stays exactly as-is

The diff is narrow: four constant deletions, one function body replacement, one `FD` side-effect lift into `_handleResponse`.

**New file: `test/catParser.test.ts`**

Unit tests only. No serial, no Vue, no DOM.

---

## How existing useSerial.ts callers are updated

`_parseResponse` is private (not exported), so no external callers exist. The only internal call sites are two lines in `_handleResponse`:

```ts
// Line 251 (solicited path) — before
_parseResponse(prefix, response.substring(2), e.cmd)

// After
const patch = parseResponse(prefix, response.substring(2), state.value, e.cmd)
if (patch.scopeSide !== undefined) _fireScopeRequery(patch.scopeSide)
if (Object.keys(patch).length > 0) _patch(patch)
```

```ts
// Line 257 (unsolicited path) — before
_parseResponse(prefix, response.substring(2))

// After
const patch = parseResponse(prefix, response.substring(2), state.value)
if (patch.scopeSide !== undefined) _fireScopeRequery(patch.scopeSide)
if (Object.keys(patch).length > 0) _patch(patch)
```

The `Object.keys` guard that was at the bottom of the old `_parseResponse` moves here. Extract the `FD` async logic into a named private function `_fireScopeRequery(side: number)` to keep `_handleResponse` readable.

`MODE_CODE` is used inside `writeMemoryChannel` in `useSerial.ts`. After moving the map to `catParser.ts`, add `import { MODE_CODE } from './catParser'` at the top of `useSerial.ts`. No other files import these maps.

---

## Test fixture design

The parser input is always `(cmd: string, params: string, current: TransceiverState)`. Test fixtures are plain objects — no serial port, no browser, no Vue.

**Fixture helper:**

```ts
// test/catParser.test.ts
import { parseResponse } from '../composables/catParser'
import type { TransceiverState } from '../composables/useSerial'

function base(): TransceiverState {
  // minimal valid state — copy defaultState() or inline a trimmed version
  return {
    connected: false, port: null, baudRate: 38400, autoInfo: false,
    mainFreq: null, subFreq: null, mainMode: null, subMode: null,
    // ... all fields null/false/0 as in defaultState()
    radioChannels: {}, firmware: { main: null, display: null, sdr: null, dsp: null, spa1: null, fc80: null },
    lastUpdate: 0, error: null,
  } as TransceiverState
}
```

**Example test cases:**

```ts
// Frequency decoding
it('FA decodes main frequency', () => {
  const r = parseResponse('FA', '029000000', base())
  expect(r.mainFreq).toBe(29000000)
})

// VFO-indexed params
it('AG decodes AF gain for main VFO', () => {
  const r = parseResponse('AG', '0200', base())
  expect(r.afGainMain).toBe(200)
})

it('AG decodes AF gain for sub VFO', () => {
  const r = parseResponse('AG', '1150', base())
  expect(r.afGainSub).toBe(150)
})

// Mode decoding
it('MD decodes main mode FM', () => {
  const r = parseResponse('MD', '04', base())
  expect(r.mainMode).toBe('FM')
  expect(r.narrowMain).toBe(0)
})

it('MD decodes main mode FM-N sets narrow flag', () => {
  const r = parseResponse('MD', '0B', base())
  expect(r.mainMode).toBe('FM-N')
  expect(r.narrowMain).toBe(1)
})

// sourceCmd disambiguation (SM, CT, SH, NA use it)
it('SM uses sourceCmd VFO digit over params[0]', () => {
  const r = parseResponse('SM', '1200', base(), 'SM1')
  expect(r.mainSmeter).toBeUndefined()
  expect(r.subSmeter).toBe(200)
})

// MR channel merge — requires populated current state
it('MR merges into existing radioChannels preserving tag', () => {
  const current = base()
  current.radioChannels[1] = {
    slot: 1, freq: 0, txFreq: null, splitMem: false, mode: null,
    sqlType: null, clarDir: null, clarOffset: null,
    rxClar: false, txClar: false, shift: 0,
    tag: 'TEST', ctcssIdx: null, dcsIdx: null,
  }
  const frame = '00001029000000+000001100200001' // slot 1, 29 MHz, USB, etc.
  const r = parseResponse('MR', frame, current)
  expect(r.radioChannels![1].freq).toBe(29000000)
  expect(r.radioChannels![1].tag).toBe('TEST')  // preserved from current
})

// Edge cases
it('FA with zero returns null', () => {
  const r = parseResponse('FA', '000000000', base())
  expect(r.mainFreq).toBeNull()
})

it('unknown opcode returns empty patch', () => {
  const r = parseResponse('ZZ', '0000', base())
  expect(Object.keys(r)).toHaveLength(0)
})

// RI bit-field decoding
it('RI decodes squelch open from bit 7', () => {
  const frame = '0000000001' // params[7] = '1'
  const r = parseResponse('RI', frame, base())
  expect(r.radioInfo?.squelchOpen).toBe(true)
  expect(r.txState).toBe(false)
})
```

**What frame strings look like:** The parser receives only the substring after the 2-character opcode. Construct test strings by counting character positions from the protocol docs or from the decoder index arithmetic in `_parseResponse`. For `MR` the full wire frame `MR00001029000000...;` produces `cmd='MR'`, `params='00001029000000...'`.

**Priority test cases to write first** (highest bug risk, most complex logic):
1. `MR` — channel merge with `prev` state (slot 0 guard, txFreq/tag preservation)
2. `MZ` — splitMem/txFreq only applied when slot exists in current state
3. `RI` — 8-bit field; multiple fields decoded from fixed positions
4. `CT`/`SH`/`NA`/`SM` — sourceCmd disambiguation path vs. params-based path
5. `EX` — prefix-matched parameter dispatch
6. `VE` — firmware sub-component spread

---

## Build order

1. **Create `composables/catParser.ts`** — copy the four decode maps and the body of `_parseResponse` verbatim. Change the signature: add `current: TransceiverState` parameter, replace all `s.` references with `current.`, remove the `_patch(ch)` call at the bottom, add `return ch` instead. Remove the `FD` async block (leave a TODO comment marking where the caller must handle it). Export `parseResponse` and the four maps.

2. **Update `composables/useSerial.ts`** — import `parseResponse` and the maps from `./catParser`. Delete the four constants and the `_parseResponse` function body. Extract `_fireScopeRequery` as a named private async function. Update the two call sites in `_handleResponse` as described above. Verify the file compiles.

3. **Verify the app still runs** — `npm run dev`, connect to radio (or just check the TypeScript compiles clean with `npx tsc --noEmit`). No behaviour change should be observable.

4. **Install Vitest** — add `@vitest/ui` and configure in `nuxt.config.ts` or a standalone `vitest.config.ts`. Nuxt 3 with `@nuxt/test-utils` supports Vitest natively; for a pure unit test of a non-Vue file, a minimal `vitest.config.ts` with no Nuxt preset is sufficient and faster.

5. **Write tests** starting with the six priority cases above, then expand to full coverage of all 30+ opcodes.

6. **Run tests in CI** — add `npx vitest run` as a step in `.github/workflows/azure-deploy.yml` before the Docker build step.

---

## Risks and how to mitigate

**Risk: FD async side-effect accidentally lost**
The `FD` case spawns serial writes that re-sync scope state after a scope-side change. If this logic is not correctly lifted into `_handleResponse`, scope display breaks silently on scope-side toggles.
Mitigation: Extract it into a clearly named `_fireScopeRequery(side: number)` function immediately when editing `_handleResponse`. Write a test that confirms `parseResponse('FD', '1...', base())` returns `{ scopeSide: 1 }` and nothing else — making the contract explicit.

**Risk: `current` state snapshot races**
`_handleResponse` is called synchronously from the read loop. Between the `parseResponse` call and `_patch`, state cannot change (single-threaded event loop). No risk in practice, but if `_handleResponse` were ever made async this assumption breaks.
Mitigation: Keep `_handleResponse` synchronous. The refactor does not change this.

**Risk: MR/MZ/MT tests require realistic frame strings**
The channel decoders use fixed-offset substring slices. Off-by-one errors in test frame construction produce false passes. 
Mitigation: Derive test frames from the actual radio protocol document (CAT-FTX1.pdf in the repo) rather than guessing. For each decoder under test, write one test that asserts a specific known value at a known offset.

**Risk: `defaultState()` is not exported**
Tests need a valid `TransceiverState` base. `defaultState()` is currently a private function in `useSerial.ts`.
Mitigation: Export `defaultState` from `useSerial.ts`, or duplicate a minimal version inline in the test helper. Exporting is cleaner; it is a zero-risk change.

**Risk: Vitest environment — `TextEncoder`/`TextDecoder` not available in jsdom**
The parser itself does not use these. `useSerial.ts` does. As long as tests only import `catParser.ts`, the Node.js test environment (no jsdom needed) works without polyfills.
Mitigation: Set `environment: 'node'` in `vitest.config.ts`. Do not import from `useSerial.ts` in parser tests.

**Risk: `shallowRef` imported into `catParser.ts` by mistake**
The parser must have zero Vue dependencies to run in Node.js without a browser shim.
Mitigation: `catParser.ts` imports only from `'./useSerial'` for the `TransceiverState` type (a type-only import, stripped at compile time). Lint or CI can verify this with `grep -n "^import" composables/catParser.ts` — only type imports should appear.
