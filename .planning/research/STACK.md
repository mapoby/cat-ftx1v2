# Test Stack Research

**Project:** CAT FTX-1 Controller
**Researched:** 2026-05-08
**Scope:** Test tooling for Nuxt 3 / Vue 3 static SPA with Web Serial API

---

## Recommended Tooling (with versions)

| Package | Version (current) | Role |
|---|---|---|
| `vitest` | `^4.1.5` | Test runner — Vite-native, replaces Jest |
| `@nuxt/test-utils` | `^4.0.3` | Nuxt environment adapter for Vitest (component tests) |
| `@vue/test-utils` | `^2.4.10` | Vue component mounting utilities |
| `happy-dom` | `^20.9.0` | DOM environment for component tests (faster than jsdom) |
| `@vitest/coverage-v8` | `^4.1.5` | Code coverage via V8 — faster and lower memory than istanbul |
| `@types/w3c-web-serial` | `^1.0.8` | TypeScript types for Web Serial API (needed in test setup files) |

**Do not install `playwright-core`** unless you intend to add E2E tests. It is a peer dep of `@nuxt/test-utils` but marked optional. It is ~100 MB and not needed for unit or component tests.

**Confidence:** HIGH — versions verified against npm registry on 2026-05-08. Peer dep constraints verified from `@nuxt/test-utils@4.0.3`.

---

## Vitest Setup for Nuxt 3

### The two-project pattern

Nuxt's own testing guide prescribes separating unit tests (Node environment) from component tests (Nuxt environment). This matters here because:

- CAT decoder unit tests have zero browser dependencies — run them in `node` for speed
- Any future component tests for `pages/index.vue` or sub-components need the Nuxt runtime for auto-imports

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      // Unit tests: pure TypeScript, no DOM, no Nuxt runtime
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      // Component tests: Vue components, requires Nuxt runtime
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
        },
      }),
    ],
  },
})
```

**Important:** `package.json` must have `"type": "module"` for this config to work without renaming. Alternatively rename the config to `vitest.config.mts`. The project's current `package.json` has no `"type"` field — add `"type": "module"` or use `vitest.config.mts`.

### `package.json` scripts to add

```json
"test": "vitest",
"test:unit": "vitest --project unit",
"test:nuxt": "vitest --project nuxt",
"test:coverage": "vitest --project unit --coverage"
```

### For unit tests only (minimal path)

If component tests are deferred, the entire `@nuxt/test-utils` dependency can be skipped. A minimal `vitest.config.ts` for pure TypeScript decoder tests:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/cat-parser/**'],
    },
  },
})
```

This is viable because the extracted `_parseResponse` logic will have no Vue/Nuxt imports once it is extracted to a plain `.ts` module.

**Confidence:** HIGH — pattern taken directly from nuxt.com/docs/getting-started/testing, verified 2026-05-08.

---

## Web Serial API Mocking Approach

### Context

`useSerial.ts` currently embeds `_parseResponse` alongside `navigator.serial` calls. Once `_parseResponse` is extracted into a standalone module (e.g., `lib/cat-parser.ts`), unit tests for decoders require **no mock at all** — they are pure functions: string in, state-delta out.

The mock is only needed for integration-level tests that exercise the serial connection lifecycle (open, read loop, reconnect). Those tests are optional for this milestone.

### Approach 1: No mock needed (recommended for decoder tests)

Extract `_parseResponse` and the decode maps to `lib/cat-parser.ts` with no imports from `useSerial`, no `navigator` references. Tests call the function directly.

```typescript
// lib/cat-parser.ts
export function parseResponse(cmd: string, params: string): Partial<TransceiverState> {
  // ... decoder switch
}
```

```typescript
// test/unit/cat-parser.test.ts
import { parseResponse } from '../../lib/cat-parser'

test('FA decodes main frequency', () => {
  const delta = parseResponse('FA', '00014225000')
  expect(delta.mainFreq).toBe(14225000)
})
```

No `vi.stubGlobal`, no DOM, no Nuxt. This is the correct architecture for the test milestone.

### Approach 2: Stub navigator.serial with vi.stubGlobal (integration tests only)

If tests need to exercise the serial read loop, stub the entire `navigator.serial` global in a setup file:

```typescript
// test/setup/web-serial.ts
import { vi, beforeEach, afterEach } from 'vitest'

const mockSerialPort = {
  open: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  readable: {
    getReader: vi.fn(() => ({
      read: vi.fn()
        .mockResolvedValueOnce({ value: new TextEncoder().encode('FA00014225000;'), done: false })
        .mockResolvedValue({ value: undefined, done: true }),
      releaseLock: vi.fn(),
    })),
  },
  writable: {
    getWriter: vi.fn(() => ({
      write: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    })),
  },
  getInfo: vi.fn().mockReturnValue({ usbVendorId: 0x0403, usbProductId: 0x6015 }),
}

beforeEach(() => {
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    serial: {
      requestPort: vi.fn().mockResolvedValue(mockSerialPort),
      getPorts: vi.fn().mockResolvedValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
```

Reference this in `vitest.config.ts` via `setupFiles: ['./test/setup/web-serial.ts']`.

### No dedicated npm package for Web Serial mocking exists

As of 2026-05-08, no maintained npm package mocks the Web Serial API for test environments. `web-serial-polyfill` (v1.0.15) is a WebUSB bridge for hardware-constrained platforms — not a test mock. The `vi.stubGlobal` approach is what the ecosystem uses.

**Confidence:** HIGH for Approach 1 (extract + test pure functions). MEDIUM for Approach 2 (hand-written stub is correct pattern but untested against this specific codebase).

---

## What NOT to Use and Why

### Jest
**Do not use.** Nuxt 3 uses Vite for builds and dev. Vitest reads `vite.config.*` natively, shares the same transform pipeline, and handles ESM and TypeScript without additional babel configuration. Jest requires `babel-jest` + `@babel/preset-typescript` + workarounds for Vite-specific imports. There is no benefit and significant cost.

### `@testing-library/vue`
**Skip for this milestone.** It wraps `@vue/test-utils` with a user-centric query API. Useful for component behavioural tests, but the test milestone is focused on decoder unit tests. Adding it is pure overhead. `@vue/test-utils` directly is sufficient if component tests are added later.

### Vitest Browser Mode (`@vitest/browser`)
**Do not use.** Browser Mode runs tests in a real Chromium instance and would make Web Serial available without mocking. However: it requires Playwright, adds ~500 MB to dev dependencies, is significantly slower, and is architecturally wrong for testing pure parsing logic. The extraction approach (Approach 1) eliminates the need for a real browser in tests.

### `jsdom` as the DOM environment
**Prefer `happy-dom`.** jsdom is more complete but measurably slower. For Vue component tests that do not depend on edge-case DOM APIs, happy-dom is the correct choice. `@nuxt/test-utils` supports both; `happy-dom` is listed first in Nuxt's own docs.

### Nuxt module integration (`@nuxt/test-utils/module` in `nuxt.config.ts`)
**Optional, defer.** Adding `modules: ['@nuxt/test-utils/module']` to `nuxt.config.ts` enables Nuxt DevTools test panel. Not needed for CI or basic testing. Do not add it until there is a specific reason.

### `workspace` config key (Vitest < 3.2)
**Obsolete.** The `test.workspace` key is deprecated since Vitest 3.2 in favour of `test.projects`. Do not use tutorials or examples that reference `vitest.workspace.ts` files — those predate the current API.

---

## Confidence Levels

| Area | Confidence | Source |
|---|---|---|
| Vitest version (4.1.5) | HIGH | npm registry, 2026-05-08 |
| `@nuxt/test-utils` version (4.0.3) | HIGH | npm registry, 2026-05-08 |
| `@vue/test-utils` version (2.4.10) | HIGH | npm registry, 2026-05-08 |
| Two-project vitest config pattern | HIGH | nuxt.com/docs/getting-started/testing |
| `test.projects` replaces `test.workspace` | HIGH | vitest.dev/guide/projects |
| V8 coverage faster than istanbul | HIGH | vitest.dev/guide/coverage |
| happy-dom faster than jsdom for Vue | MEDIUM | vitest.dev/guide/environment (no explicit Vue recommendation) |
| No maintained Web Serial mock on npm | HIGH | npm search, 2026-05-08 |
| `vi.stubGlobal` pattern for Web Serial | MEDIUM | vitest.dev/guide/mocking (pattern confirmed, not Serial-specific) |
| Extract-then-test as correct architecture | HIGH | Follows from Web Serial API being unavailable in Node.js (documented browser constraint) |

---

## Sources

- https://nuxt.com/docs/getting-started/testing (retrieved 2026-05-08)
- https://vitest.dev/guide/environment (retrieved 2026-05-08)
- https://vitest.dev/guide/projects (retrieved 2026-05-08)
- https://vitest.dev/guide/coverage (retrieved 2026-05-08)
- https://vitest.dev/guide/mocking (retrieved 2026-05-08)
- https://test-utils.vuejs.org/installation/ (retrieved 2026-05-08)
- https://developer.chrome.com/docs/capabilities/serial (retrieved 2026-05-08)
- npm registry: `@nuxt/test-utils`, `vitest`, `@vue/test-utils`, `happy-dom`, `@types/w3c-web-serial` (all 2026-05-08)
