# Coding Conventions

**Analysis Date:** 2026-05-08

## Naming Patterns

**Files:**
- Vue SFCs use PascalCase: `PresetButton.vue`, `StatusBadge.vue`, `LevelBar.vue`, `SMeter.vue`, `BandwidthDisplay.vue`
- Composables use camelCase with `use` prefix: `useSerial.ts`
- Pages use kebab-case by Nuxt convention: `index.vue`
- JSON data files use kebab-case: `cat-presets.json`

**Functions (composable/module level):**
- Private helpers use underscore prefix: `_write`, `_patch`, `_startReadLoop`, `_handleResponse`, `_parseResponse`, `_sendAndWait`, `_drainQueue`, `_enableAutoInfo`, `_initialSync`, `_initialSync2`
- Public exported functions use camelCase: `connect`, `disconnect`, `send`, `sendPreset`, `readMemoryChannel`, `scanMemoryChannels`, `writeMemoryChannel`, `deleteMemorySlot`
- Component methods use camelCase: `toggleConnection`, `cycleAgc`, `setAfGain`, `openBandPopup`

**Variables:**
- Module-level singletons use underscore prefix: `_port`, `_writer`, `_reader`, `_queue`, `_enc`
- `ref` and `shallowRef` values use camelCase: `connecting`, `selectedBaud`, `lastError`, `funcKnobBusy`
- Lookup/decode maps use UPPER_SNAKE_CASE: `MODE_MAP`, `MODE_CODE`, `AGC_MAP`, `FUNC_KNOB`
- Constants/data arrays use UPPER_SNAKE_CASE: `CTCSS_TONES`, `DCS_CODES`, `BANDS`, `MODES`

**Types/Interfaces:**
- PascalCase, exported from the composable where shared: `TransceiverState`, `CommandResult`, `RadioChannel`, `MemoryWriteConfig`
- Local-only interfaces defined in `<script setup>`: `ChannelConfig`, `EditableChannel`, `Preset`, `QueueEntry`
- Note: `CommandResult` and `Preset` are re-declared locally in `index.vue` despite being exported from `useSerial.ts` — a minor duplication

## Code Style

**Formatting:**
- No Prettier config present — formatting appears to be manual/editor-driven
- Indentation: 2 spaces throughout
- Single quotes for strings in TypeScript; double quotes in template attribute values

**Linting:**
- No ESLint config present
- No Biome config present
- TypeScript type-checking via `vue-tsc` (available as dev dependency, no `check` script defined)

## TypeScript Usage

**Strictness:**
- `tsconfig.json` extends `.nuxt/tsconfig.json` (Nuxt auto-generates strict settings)
- Types are used throughout `useSerial.ts` — all interfaces explicitly typed
- `any` used selectively: `getKnownPorts` returns `Promise<any[]>`, `knownPort` parameter is `any`, `knownPorts` ref is `ref<any[]>` — reflects that `SerialPort` is not in standard TypeScript lib
- Optional chaining used extensively: `params[1]?.toUpperCase()`, `state.firmware?.main`
- Nullish coalescing used throughout: `?? null`, `?? '--'`, `?? 0`
- Non-null assertions used sparingly: `_queue.shift()!`

**Type Casting:**
- Web Serial API types cast via `(navigator as any).serial` — necessary because Web Serial is not in standard TypeScript types
- Template event targets cast explicitly: `($event.target as HTMLInputElement).value`

## Vue / Nuxt Conventions

**Component API:**
- All components use `<script setup lang="ts">` (Composition API)
- No Options API used anywhere
- `defineProps<{...}>()` with TypeScript generics (no `withDefaults`)
- `defineEmits<{...}>()` with TypeScript generics

**Reactivity:**
- `ref` for primitive reactive values
- `shallowRef` for the large `TransceiverState` object in `useSerial.ts` — correct choice to avoid deep reactivity overhead on a frequently-mutated object
- `reactive` used for `editFreq`, `editTxFreq` lookup tables in `index.vue`
- `computed` for derived display values
- `watch` for side effects triggered by state changes

**State Update Pattern in `useSerial.ts`:**
- `_patch(changes)` merges partial state: `state.value = { ...state.value, ...changes, lastUpdate: Date.now() }`
- This is the only way state is mutated — consistent throughout the composable

**Imports in Vue SFCs:**
- Auto-imports used for Nuxt composables (`useRuntimeConfig`, `useHead`)
- Other imports explicit at top of `<script setup>`
- Path alias `~` used for project root imports: `import { useSerial } from '~/composables/useSerial'`

**Template Patterns:**
- `v-if` / `v-show` used appropriately — `v-show` for tab panels (keep DOM alive), `v-if` for conditionally rendered sections
- `:class` with object syntax for conditional classes
- `@event.prevent` for wheel handlers to stop scroll propagation
- Modals use `<Teleport to="body">` — consistent pattern across all dialogs (CTCSS, DCS, mode, band, RSGB, wipe confirm)
- `v-for` with `:key` on all list renders

## Composable Pattern

`useSerial.ts` is a **module-level singleton**, not an instance-per-call composable:

```typescript
// Module-level — shared across ALL useSerial() calls
export const state = shallowRef<TransceiverState>(defaultState())
export const connecting = ref(false)
let _port: SerialPort | null = null

export function useSerial() {
  return { state, connecting, isSupported, connect, disconnect, send, ... }
}
```

- State and port handle live at module scope, not inside the composable function
- `useSerial()` is just a convenience accessor returning references to the singletons
- Components can also import `state`, `connecting` directly without calling `useSerial()`
- All components share the same connection state automatically

## Import Style

**Order (observed):**
1. Vue core imports: `import { ref, computed, watch, ... } from 'vue'`
2. Composables: `import { useSerial, type X } from '~/composables/useSerial'`
3. Data files: `import presetsData from '~/cat-presets.json'`
4. Components: `import SMeter from '~/components/SMeter.vue'`

**Type imports:**
- `type` keyword used for type-only imports: `import { useSerial, type TransceiverState, type CommandResult } from '~/composables/useSerial'`

## Error Handling

**Patterns:**
- `try/catch` with silent catch blocks used extensively for non-fatal serial operations: `catch { /* ignore */ }`, `catch { /* best-effort */ }`, `catch { /* non-fatal */ }`
- Public API functions (`connect`) rethrow after cleanup
- Errors surface to UI via `lastError` ref in `index.vue`
- Async errors in event handlers caught and assigned to `lastError` or `flashState`

**Template:**
- Error state displayed via `v-if="lastError"` banner in header
- Per-operation error state via `flashState` in `PresetButton`

## Inline Comments

- Section dividers use `// ── Section Name ──...` style (box-drawing dashes)
- Explanatory comments for non-obvious CAT protocol decisions: `// FTX-1 CAT has no per-slot delete command...`
- Sparse comments in Vue templates — self-documenting via `title` attributes and label props
- Commented-out code left in templates with `<!-- ... -->` (e.g., old `freq-display` divs, `BandwidthDisplay` on sub VFO)

---

*Convention analysis: 2026-05-08*
