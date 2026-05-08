# Phase 1: Testing Foundation + Bug Fixes — Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 7 (3 new, 4 modified)
**Analogs found:** 4 / 7 (3 new files have no codebase analog — patterns from RESEARCH.md)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `composables/catParser.ts` | utility/pure-module | transform | `composables/useSerial.ts` (source of extraction) | source-file |
| `test/unit/catParser.test.ts` | test | transform | none | no analog |
| `vitest.config.mts` | config | — | none | no analog |
| `composables/useSerial.ts` (modify) | composable/service | event-driven + CRUD | self | self |
| `pages/index.vue` (modify BUG-03, BUG-05) | component | event-driven | self | self |
| `package.json` (modify) | config | — | self | self |
| `.github/workflows/azure-deploy.yml` (modify) | config/CI | — | self | self |

---

## Pattern Assignments

### `composables/catParser.ts` (utility, transform)

**Source:** Extracted verbatim from `composables/useSerial.ts` lines 7–33 (maps) and 262–554 (`_parseResponse`).

**Imports pattern** — copy from `useSerial.ts` lines 1–5, adjust to export only what tests need:
```typescript
// No Vue imports — this file must have zero Vue/Web Serial dependencies
import type { TransceiverState } from './useSerial'
```

**Decode maps to move** (lines 7–33 of `useSerial.ts`):
```typescript
// Move these four maps verbatim; add exports so tests can assert map contents
export const MODE_MAP: Record<string, string> = {
  '0': 'AMS',  '1': 'LSB',  '2': 'USB',      '3': 'CW-U',     '4': 'FM',
  '5': 'AM',   '6': 'RTTY-L','7': 'CW-L',    '8': 'DATA-L',   '9': 'RTTY-U',
  'A': 'DATA-FM','B': 'FM-N','C': 'DATA-U',  'D': 'AM-N',     'E': 'PSK',
  'F': 'DATA-FM-N', 'H': 'C4FM-DN', 'I': 'C4FM-VW',
}
export const MODE_CODE: Record<string, string> = { ... }  // lines 16–21
export const AGC_MAP: Record<string, string> = { ... }    // lines 23–26
export const FUNC_KNOB: Record<string, string> = { ... }  // lines 28–33
```

**Core pattern — pure function signature** (derived from `useSerial.ts:262`):
```typescript
// Old signature (private, side-effecting):
// function _parseResponse(cmd: string, params: string, sourceCmd: string | null = null): void
//   const s = state.value    ← external read
//   if (Object.keys(ch).length > 0) _patch(ch)  ← external write

// New signature (pure, exported):
export function parseResponse(
  cmd: string,
  params: string,
  current: TransceiverState,
  sourceCmd: string | null = null,
): Partial<TransceiverState> {
  const s = current   // was: const s = state.value
  const ch: Partial<TransceiverState> = {}
  switch (cmd) {
    // ... all cases verbatim from useSerial.ts:266–552 ...
    // Five cases use `s`: MR (line 503), MZ (line 529), MT (line 545),
    //   SS (line 477), VE (line 399) — all become `s.fieldName` unchanged
    //   since `s` is now the `current` param, not state.value alias
  }
  return ch   // was: if (Object.keys(ch).length > 0) _patch(ch)
}
```

**FD case — remove async side-effect** (currently at `useSerial.ts:270–282`):
```typescript
// CURRENT (impure — fires _write, untestable):
case 'FD': {
  const side = params[0] === '1' ? 1 : 0
  ch.scopeSide = side
  ;(async () => {
    for (const c of [`SS${side}5`, `SS${side}4`, `SS${side}0`, `SS${side}3`, `SS${side}6`]) {
      if (!_port) break
      try { await _write(c) } catch { }
      await new Promise(r => setTimeout(r, 40))
    }
  })()
  break
}

// NEW catParser.ts (pure — side-effect removed):
case 'FD': {
  ch.scopeSide = params[0] === '1' ? 1 : 0
  break
}
// Side-effect moves to useSerial.ts — see _handleResponse modification below
```

**MR/MZ/MT cases — `s` substitution pattern** (lines 503–551):
```typescript
// These read s.radioChannels — the `current` parameter provides the snapshot.
// No other changes needed beyond renaming state.value → current at top of function.
case 'MR':
  if (params.length >= 27) {
    // ... parsing ...
    if (slot > 0 && freq > 0) {
      const channels = { ...s.radioChannels }   // s = current (param), not state.value
      const prev = s.radioChannels[slot]
      channels[slot] = { slot, freq, txFreq: prev?.txFreq ?? null, ... }
      ch.radioChannels = channels
    }
  }
  break
```

---

### `test/unit/catParser.test.ts` (test, transform)

**Analog:** None in codebase. Use RESEARCH.md Pattern 3 directly.

**File structure pattern** (from RESEARCH.md):
```typescript
import { describe, test, expect } from 'vitest'
import { parseResponse } from '../../composables/catParser'
import { defaultState } from '../../composables/useSerial'
import type { TransceiverState } from '../../composables/useSerial'

function base(): TransceiverState {
  return defaultState()
}
```

**Test block pattern** — one `describe` per opcode, 2–4 assertions each:
```typescript
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
```

**Merge-preserving test pattern** (for MR/MZ/MT/SS/VE which read `current`):
```typescript
describe('MR — memory channel merge', () => {
  test('preserves ctcssIdx from prior state', () => {
    const current = base()
    current.radioChannels[1] = {
      slot: 1, freq: 14000000, ctcssIdx: 5, dcsIdx: null,
      txFreq: null, splitMem: false, mode: 'USB', sqlType: 1,
      clarDir: null, clarOffset: null, rxClar: false, txClar: false,
      shift: 0, tag: null
    }
    const delta = parseResponse('MR', '0000114225000+000001100USB00', current)
    expect(delta.radioChannels![1].ctcssIdx).toBe(5)
    expect(delta.radioChannels![1].freq).toBe(14225000)
  })
})
```

**FD side-effect isolation test** (locks the pure-function contract):
```typescript
describe('FD — scope side (no async side-effect)', () => {
  test('returns only scopeSide delta', () => {
    const delta = parseResponse('FD', '1', base())
    expect(delta).toEqual({ scopeSide: 1 })
  })
})
```

**sourceCmd disambiguation test pattern** (for SM, CT, SH, NA):
```typescript
describe('SM — S-meter with sourceCmd disambiguation', () => {
  test('uses sourceCmd VFO digit when provided', () => {
    // sourceCmd = 'SM0' → vfo '0' (main)
    const delta = parseResponse('SM', '0015', base(), 'SM0')
    expect(delta.mainSmeter).toBe(15)
    expect(delta.subSmeter).toBeUndefined()
  })
  test('falls back to params[0] when sourceCmd is null', () => {
    const delta = parseResponse('SM', '1015', base(), null)
    expect(delta.subSmeter).toBe(15)
  })
})
```

---

### `vitest.config.mts` (config)

**Analog:** None in codebase. Use RESEARCH.md Pattern 2.

**Pattern** (use `.mts` extension — avoids `"type": "module"` in package.json per Pitfall 3):
```typescript
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

---

### `composables/useSerial.ts` — modifications (composable, event-driven)

**Analog:** Self. All modification patterns are surgical edits to the existing file.

**1. Import catParser** — add after existing imports at top of file:
```typescript
import { parseResponse } from './catParser'
```

**2. Export `defaultState`** (TEST-03 — line 148, one-word change):
```typescript
// Current:
function defaultState(): TransceiverState {
// Change to:
export function defaultState(): TransceiverState {
```

**3. Remove maps from useSerial.ts** — lines 7–33 move to catParser.ts. Leave a re-export if needed, or update import sites. Maps are module-private (not exported from useSerial.ts currently), so no external callers to update.

**4. Replace `_parseResponse` call in `_handleResponse`** (lines 251, 257):
```typescript
// Current (useSerial.ts:248–257):
if (_queue.length > 0 && _queue[0].cmd.substring(0, 2).toUpperCase() === prefix) {
  const e = _queue.shift()!
  clearTimeout(e.timer)
  _parseResponse(prefix, response.substring(2), e.cmd)  // ← line 251
  e.resolve(response)
  return
}
_parseResponse(prefix, response.substring(2))           // ← line 257

// New pattern:
if (_queue.length > 0 && _queue[0].cmd.substring(0, 2).toUpperCase() === prefix) {
  const e = _queue.shift()!
  clearTimeout(e.timer)
  const delta = parseResponse(prefix, response.substring(2), state.value, e.cmd)
  _patch(delta)
  // FD side-effect: if scopeSide changed, fire scope re-queries
  if (delta.scopeSide !== undefined) _fireScopeRequery(delta.scopeSide)
  e.resolve(response)
  return
}
const delta = parseResponse(prefix, response.substring(2), state.value)
_patch(delta)
if (delta.scopeSide !== undefined) _fireScopeRequery(delta.scopeSide)
```

**5. New private `_fireScopeRequery` function** — add after `_handleResponse`:
```typescript
// Lifted from FD case in old _parseResponse (useSerial.ts:274–281)
function _fireScopeRequery(side: number): void {
  ;(async () => {
    for (const c of [`SS${side}5`, `SS${side}4`, `SS${side}0`, `SS${side}3`, `SS${side}6`]) {
      if (!_port) break
      try { await _write(c) } catch { }
      await new Promise(r => setTimeout(r, 40))
    }
  })()
}
```

**6. BUG-01 + BUG-04: `scanMemoryChannels` fix** (lines 741–747):
```typescript
// Current (useSerial.ts:741–747):
export async function scanMemoryChannels(from = 1, to = 99): Promise<void> {
  await send('VM011')
  for (let i = from; i <= to; i++) {
    if (!state.value.connected) break
    await readMemoryChannel(i)
  }
}

// New (BUG-01: VFO save/restore; BUG-04: AI mode disable/re-enable):
export async function scanMemoryChannels(from = 1, to = 99): Promise<void> {
  const origFreqResp = await _sendAndWait('FA', 1500)
  const origFreq = origFreqResp.substring(2)

  try { await _sendAndWait('AI0', 1000) } catch { }

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
    } catch { }
    try { await _sendAndWait('AI1', 1000) } catch { }
  }
}
```

**7. BUG-02: `readMemoryChannel` — parse return value directly** (lines 725–729):
```typescript
// Current (stale global state read — useSerial.ts:725–729):
if (sqlType <= 2) {
  try { await _sendAndWait('CN00', 1000); ctcssIdx = state.value.mainCtcssTone } catch { }
} else {
  try { await _sendAndWait('CN01', 1000); dcsIdx = state.value.mainDcsCode } catch { }
}

// New (parse from return value — avoids unsolicited AI frame race):
// CN response format: 'CN' + vfo(1) + type(1) + index(3 digits)
// _sendAndWait resolves with full response string e.g. 'CN0003'
// params start at [2]: vfo=[2], type=[3], index=[4..6] (substring(4))
if (sqlType <= 2) {
  try {
    const resp = await _sendAndWait('CN00', 1000)
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
// NOTE: Verify byte offset 4 against CN case in catParser.ts (params[0]=vfo, params[1]=type,
// params.substring(2)=index). Full response = 'CN' + params, so resp[4] = params[2] = index start.
```

---

### `pages/index.vue` — BUG-03 + BUG-05 modifications (component, event-driven)

**Analog:** Self. Surgical edits to two sections.

**BUG-03: Add `rfSqlBusy` ref** (insert after line 1085 alongside existing busy refs):
```typescript
// Context: existing busy refs at index.vue:1082–1086
const funcKnobBusy = ref(false)
const speechProcBusy = ref(false)
const voxBusy = ref(false)
const preAmpBusy    = ref(false)
// Add here:
const rfSqlBusy = ref(false)
const antSelectBusy = ref(false)
```

**BUG-03: Replace `toggleRfSql` function** (lines 1841–1851):
```typescript
// Pattern: use dedicated busy flag, single try/catch/finally, combine both sends
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
// Pattern sourced from adjacent togglePreAmpVhf (lines 1853–1864) which is the
// correct single-flag, single-try pattern this function should have followed.
```

**BUG-05: Add `watch` on `activeTab`** (insert after `activeTab` declaration at line 1089):
```typescript
// Context at index.vue:1089:
const activeTab = ref<'dashboard' | 'channels'>('dashboard')
// Add watcher immediately after:
watch(activeTab, async (newTab, oldTab) => {
  if (!state.value.connected) return
  if (newTab === 'channels') {
    try { await send('AI0') } catch { }
  } else if (oldTab === 'channels') {
    try { await send('AI1') } catch { }
  }
})
// Import: `watch` must be added to the Vue import at the top of <script setup>
```

---

### `package.json` — modifications (config)

**Pattern: add test scripts, do NOT add `"type": "module"`** (per Pitfall 3 — use `.mts` config instead):
```json
"scripts": {
  "dev": "nuxt dev",
  "build": "nuxt build",
  "generate": "nuxt generate",
  "preview": "nuxt preview",
  "postinstall": "nuxt prepare",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```
Add to `devDependencies` after `npm install -D vitest @vitest/coverage-v8 @types/w3c-web-serial`:
```json
"@types/w3c-web-serial": "^1.0.8",
"@vitest/coverage-v8": "^4.1.5",
"vitest": "^4.1.5"
```

---

### `.github/workflows/azure-deploy.yml` — modifications (CI config)

**Analog:** Self. Insert Node.js test steps between step 1 (Checkout) and step 2 (Azure Login).

**Insertion point:** After the `Checkout` step (line 24), before `Azure Login` (line 26).

**Pattern — test steps to insert:**
```yaml
      # ── 1b. Test (must pass before any build work) ──────────────────────────
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ github.sha }}
          path: coverage/
          if-no-files-found: warn
```
Note: `"test": "vitest run"` in package.json makes `npm test` non-interactive (no `-- --run` needed).

---

## Shared Patterns

### Async error handling (try/catch/finally)
**Source:** `composables/useSerial.ts:652–661` (connect), `useSerial.ts:741–747` (before fix)
**Apply to:** All new async functions in useSerial.ts (BUG-01, BUG-04 fix)
```typescript
// Pattern: best-effort cleanup in finally; empty catch for non-fatal ops
try {
  await someOperation()
} finally {
  try { await cleanup() } catch { /* best effort */ }
}
```

### Busy-flag guard pattern
**Source:** `pages/index.vue:1853–1864` (`togglePreAmpVhf` — the correct version)
**Apply to:** BUG-03 `toggleRfSql` replacement
```typescript
async function toggleX() {
  if (xBusy.value) return
  xBusy.value = true
  try {
    await send(...)
  } catch (e: any) {
    lastError.value = e.message
  } finally {
    xBusy.value = false
  }
}
```

### `ref(false)` busy flag declaration
**Source:** `pages/index.vue:1082–1086`
**Apply to:** New `rfSqlBusy` ref for BUG-03
```typescript
const preAmpBusy    = ref(false)
const rfSqlBusy     = ref(false)   // ← add alongside existing busy refs
```

### `_sendAndWait` + `finally` restore pattern
**Source:** `composables/useSerial.ts:559–575` (`_sendAndWait` implementation)
**Apply to:** BUG-01/BUG-04 `scanMemoryChannels` fix — save/restore follows `try/finally` structure already used in `connect()` at lines 631–661

---

## No Analog Found

Files with no close match in the codebase (use RESEARCH.md patterns):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `test/unit/catParser.test.ts` | test | transform | No test files exist in the project yet |
| `vitest.config.mts` | config | — | No test tooling config exists yet |

Both are greenfield — RESEARCH.md Patterns 2 and 3 provide the complete templates.

---

## Metadata

**Analog search scope:** `composables/`, `pages/`, `components/`, `.github/workflows/`
**Files scanned:** 9 TypeScript/Vue source files + 1 workflow YAML
**Pattern extraction date:** 2026-05-08

**Key observations:**
- The project has exactly two TypeScript source files (`useSerial.ts`, `nuxt.config.ts`) and zero test files. Pattern extraction is therefore almost entirely from the source-of-extraction itself (`useSerial.ts`).
- `catParser.ts` is a pure extraction — no new logic, only signature and dependency changes. The body of `_parseResponse` (lines 266–552) moves verbatim; only `state.value` → `current` and the `_patch(ch)` call site change.
- The `CN` response byte offset for BUG-02: the `_sendAndWait('CN00')` response string is `'CN' + params` where params layout is `vfo(1) + type(1) + index(3)`. Full string = `'CN0003'` → `resp.substring(4)` = `'03'` = index. This matches `useSerial.ts:437–438`.
- `package.json` has no `"type": "module"` and no test scripts. The `.mts` extension for vitest config is the safe choice given the `postinstall: nuxt prepare` script.
