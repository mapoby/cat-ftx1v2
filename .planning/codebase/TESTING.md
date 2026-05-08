# Testing Patterns

**Analysis Date:** 2026-05-08

## Current State: No Tests Exist

There are zero test files in this codebase. No test runner is configured. No test dependencies are installed.

**Evidence:**
- `package.json` has no test script, no `vitest`, `jest`, `@testing-library`, or `playwright` dependency
- Glob search for `*.test.*` and `*.spec.*` returns no results
- No `vitest.config.*`, `jest.config.*`, or `playwright.config.*` present

## Test Framework

**Runner:** None installed

**Dependencies missing for testing:**
- Test runner (Vitest is the standard for Nuxt 3 / Vue 3 projects)
- Vue component test utilities (`@vue/test-utils`)
- Browser automation for E2E (`playwright` or `cypress`)

**Minimum setup to add Vitest:**
```bash
npm install -D vitest @vue/test-utils @nuxt/test-utils jsdom
```

Add to `package.json` scripts:
```json
"test": "vitest",
"test:coverage": "vitest --coverage"
```

## What Could Be Tested

### High Value: Pure Functions in `useSerial.ts`

The CAT protocol parsing logic in `_parseResponse` (`composables/useSerial.ts`) is pure in effect — it takes a command string and params string and produces a `Partial<TransceiverState>`. This is the highest-value test target.

**Testable without Web Serial API:**

The `_parseResponse` function is not exported. To make it testable, it would need to be extracted or exported. Current internal signature:

```typescript
function _parseResponse(cmd: string, params: string, sourceCmd: string | null = null): void
```

It mutates state via `_patch`. Testing requires either:
1. Exporting `_parseResponse` directly (simplest)
2. Testing via the exported `state` ref after calling internal path (requires mocking `_patch`)

**Example tests that would have high value:**

```typescript
// Frequency parsing
test('FA parses main frequency', () => {
  _parseResponse('FA', '014225000')
  expect(state.value.mainFreq).toBe(14225000)
})

// Mode decode
test('MD decodes USB on main VFO', () => {
  _parseResponse('MD', '02')
  expect(state.value.mainMode).toBe('USB')
})

// MR memory channel parsing
test('MR parses memory channel slot', () => {
  _parseResponse('MR', '0001414225000+00001100200')
  expect(state.value.radioChannels[1].freq).toBe(14225000)
})

// Edge: unknown radio ID during connect
test('connect rejects unknown radio ID', async () => {
  // Requires mocked serial port
})
```

### Medium Value: Component Logic

`PresetButton.vue` — the `execute()` function is testable:
- Verify `running` is set during execution
- Verify `flashState` transitions to `'ok'` on success
- Verify `flashState` transitions to `'error'` when `sendPreset` returns failed results
- Verify `emit('executed', results)` fires

`index.vue` — too large and too intertwined with serial state to unit test effectively. Better suited to E2E tests.

### Low Value / Requires Mocking: Serial-Dependent Paths

`connect()`, `disconnect()`, `send()`, `sendPreset()`, `readMemoryChannel()`, `writeMemoryChannel()`, `deleteMemorySlot()` all require an active `SerialPort` object. These can only be tested with a mock serial port or E2E browser automation.

## Web Serial API Testing Constraint

The Web Serial API (`navigator.serial`) is only available in:
- Chrome / Edge (desktop)
- Secure contexts (HTTPS or localhost)
- Cannot be used in Node.js test environments (jsdom, happy-dom)

**Approaches to work around this:**

**Option 1: Mock the Web Serial API in unit tests**
```typescript
// vitest.setup.ts
const mockPort = {
  open: vi.fn(),
  close: vi.fn(),
  readable: { getReader: vi.fn(() => ({ read: vi.fn(), releaseLock: vi.fn(), cancel: vi.fn() })) },
  writable: { getWriter: vi.fn(() => ({ write: vi.fn(), releaseLock: vi.fn() })) },
}
Object.defineProperty(navigator, 'serial', {
  value: { requestPort: vi.fn(() => mockPort), getPorts: vi.fn(() => []) },
  writable: true,
})
```

This allows testing `connect()` flow including the ID check and state transitions.

**Option 2: E2E with Playwright + real hardware**
Playwright supports Chrome with Web Serial API enabled via launch flags. Requires a real or emulated serial device. Not practical for CI.

**Option 3: Extract protocol logic**
Move `_parseResponse` and the decode maps into a separate `cat-protocol.ts` module with no serial dependencies. Test that module independently. This is the recommended architecture change for testability.

## Coverage Gaps (Current)

Everything is untested. Priority order for adding tests:

| Area | Priority | Reason |
|------|----------|--------|
| `_parseResponse` all CAT commands | High | Complex decode logic, many edge cases, no serial dependency |
| `defaultState()` shape | High | Ensures all fields initialized correctly |
| `PresetButton` execute flow | Medium | UI feedback logic isolated from serial |
| `connect()` / ID check | Medium | Requires Web Serial mock but catches critical failure path |
| `writeMemoryChannel()` command sequence | Medium | Verifies correct CAT command order and formatting |
| `index.vue` UI | Low | Too large; E2E preferred |

## Test Coverage Gaps by File

**`composables/useSerial.ts`:**
- All 30+ CAT command decoders in `_parseResponse` untested
- `MR`/`MZ`/`MT` memory channel parsing untested — most complex logic
- `_sendAndWait` timeout behaviour untested
- `_handleResponse` queue matching logic untested
- `writeMemoryChannel` command string formatting untested (e.g., mode code lookup, CTCSS index padding)
- `deleteMemorySlot` blank-overwrite sequence untested

**`components/PresetButton.vue`:**
- Progress counter logic untested
- Flash state transitions untested
- Error message extraction from `CommandResult` untested

**`pages/index.vue`:**
- Frequency wheel input handling untested
- Channel list import/export untested
- RSGB repeater import mapping untested
- Band selection CAT command generation untested

---

*Testing analysis: 2026-05-08*
