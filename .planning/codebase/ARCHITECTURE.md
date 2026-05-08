<!-- refreshed: 2026-05-08 -->
# Architecture

**Analysis Date:** 2026-05-08

## System Overview

```text
┌───────────────────────────────────────────────────────────────────┐
│                        Browser SPA (Nuxt 3 / Vue 3)               │
│                         pages/index.vue                           │
├───────────────────────────────────────────────────────────────────┤
│  UI Components (display + controls)                               │
│  SMeter · LevelBar · StatusBadge · BandwidthDisplay · PresetButton│
│  components/*.vue                                                 │
└───────────────────┬───────────────────────────────────────────────┘
                    │ useSerial()
                    ▼
┌───────────────────────────────────────────────────────────────────┐
│              Serial Composable (singleton)                        │
│              composables/useSerial.ts                             │
│  state (shallowRef) · command queue · read loop                  │
└───────────────────┬───────────────────────────────────────────────┘
                    │ Web Serial API (browser-native)
                    ▼
┌───────────────────────────────────────────────────────────────────┐
│  Yaesu FTX-1 Transceiver (physical hardware)                      │
│  CAT protocol over serial — text frames terminated with `;`       │
└───────────────────────────────────────────────────────────────────┘
```

## Pattern Overview

**Overall:** Single-page application with a singleton serial composable providing reactive state to the view layer. No router, no Vuex/Pinia — shared state lives entirely in module-level refs inside `composables/useSerial.ts`.

**Key Characteristics:**
- SSR disabled (`ssr: false` in `nuxt.config.ts`); Nuxt used purely as a build tool and for `useRuntimeConfig()`
- The entire application is one route (`pages/index.vue`)
- All radio state flows from `composables/useSerial.ts` → `pages/index.vue` → display components
- Commands flow from `pages/index.vue` (or `PresetButton.vue`) → `useSerial()` public API → Web Serial port
- State updates are driven by incoming CAT frames (both solicited responses and unsolicited AI-mode pushes)

## Layers

**Composable (serial/state layer):**
- Purpose: Own the physical port connection, the command queue, the read loop, and the complete decoded radio state
- Location: `composables/useSerial.ts`
- Contains: `TransceiverState` interface, module-level singleton refs (`state`, `connecting`, `isSupported`), private port/reader/writer handles, internal command queue, decode maps, response parser
- Depends on: Browser Web Serial API only
- Used by: `pages/index.vue`, `components/PresetButton.vue`

**Page (orchestration layer):**
- Purpose: All UI logic, event handlers, derived state, popup management, memory channel management, RSGB integration
- Location: `pages/index.vue`
- Contains: `<script setup>` with ~800 lines of component logic; no sub-composables extracted
- Depends on: `useSerial()`, all five display components, `cat-presets.json`
- Used by: nothing (it is the root)

**Display Components (rendering layer):**
- Purpose: Dumb/presentational with controlled interaction events
- Location: `components/*.vue`
- Contains: Props-in / emits-out pattern; no direct `useSerial()` access except `PresetButton.vue`
- Depends on: Props only, except `PresetButton.vue` which calls `useSerial().sendPreset()`

**Data layer:**
- Purpose: Static preset command sequences
- Location: `cat-presets.json`
- Contains: Array of preset objects with `id`, `label`, `color`, `description`, `commands[]`
- Loaded at: `pages/index.vue` script setup via static import

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `SMeter` | Renders signal-strength bar with S-unit ticks; maps 0-255 raw value to S0–S9+60 | `components/SMeter.vue` |
| `LevelBar` | Generic 0-255 horizontal bar with click and scroll-wheel interaction; emits `update` | `components/LevelBar.vue` |
| `StatusBadge` | Label+value badge with active/inactive styling and optional toggle click; emits `toggle` | `components/StatusBadge.vue` |
| `BandwidthDisplay` | Passband visualizer for SH (bandwidth index) and IS (IF shift); scroll-wheel adjusts both; emits `update:bandwidth` and `update:shift` | `components/BandwidthDisplay.vue` |
| `PresetButton` | Executes a multi-command preset via `sendPreset()`; shows running/ok/error overlay states | `components/PresetButton.vue` |
| `pages/index.vue` | Everything else: connection bar, VFO cards, status grid, scope controls, saved channels, radio memory, channel list tab, all modals | `pages/index.vue` |

## Data Flow

### Connection Sequence

1. User selects baud rate and clicks Connect (`pages/index.vue` → `connect()`)
2. `connect()` in `composables/useSerial.ts` calls `navigator.serial.requestPort()` (browser picker)
3. Port opened at selected baud; `_startReadLoop()` starts concurrently (not awaited)
4. Radio identity verified: `ID` command expected to return `0840` (FTX-1 specific)
5. `AI1` sent to enable auto-info mode; radio will now push unsolicited state frames
6. `_initialSync()` fires a burst of read queries (FA, FB, MD0, MD1, TX, ST, GT0/1, AG0/1, RG0/1, PC, RI0, FR, FT, SS04) with 40 ms delay each
7. `_initialSync2()` fires second burst (NA, AO, MG, PR, PL, VX, VG, SF, CT, CN, RL, RA, LK, SQ, SS, PA, VE, EX, SH, IS) — fire-and-forget, AI mode delivers responses
8. `state.connected` set to `true`; UI transitions from idle screen to dashboard

### Steady-State CAT Frame Processing

1. FTX-1 pushes a frame, or the app sends a command and the radio replies
2. `_startReadLoop()` reads bytes, accumulates in buffer, splits on `;`
3. Each complete frame passed to `_handleResponse(frame)`
4. `_handleResponse` checks if frame prefix matches head of `_queue` (solicited):
   - If yes: dequeue, call `_parseResponse(prefix, params, sourceCmd)`, resolve promise
   - If no: treat as unsolicited AI frame, call `_parseResponse(prefix, params, null)`
5. `_parseResponse` decodes the frame into a `Partial<TransceiverState>` object `ch`
6. `_patch(ch)` replaces `state.value` with a new spread object (triggers Vue reactivity)
7. Vue re-renders the parts of `pages/index.vue` that reference changed state properties

### Command Send Path (fire-and-forget)

1. UI event handler calls `send(cmd)` from `useSerial()`
2. `send()` strips trailing `;`, writes `cmd + ";"` directly to the serial writer
3. For commands that don't auto-generate AI responses (e.g. `SS`, `RG`), a follow-up read query is scheduled via `setTimeout(..., 150)`
4. Radio executes command and pushes AI notification; state updated via read loop

### Preset Execution Path

1. User clicks `PresetButton` → `execute()` called
2. `sendPreset(commands[])` iterates commands with 60 ms inter-command delay
3. Each command written via `_write(cmd)` directly (no queue, no response expected)
4. Results array returned to `PresetButton`; flash ok/error state shown for 3 seconds

## CAT Protocol Handling

**Wire format:** ASCII text, each command or response terminated with `;`. Multiple frames can arrive in one read chunk; the read loop buffers and splits on `;`.

**Command structure:** 2-character opcode + parameters, no spaces. Example: `FA029000000;` sets main VFO A to 29.000 MHz.

**Response types:**
- *Solicited*: reply to a read query — same opcode prefix, followed by value
- *Unsolicited (AI)*: pushed by radio when a parameter changes while AI mode is active
- *Error*: radio returns `?;` when command is invalid

**Opcode decode maps** (module-level constants in `composables/useSerial.ts`):
- `MODE_MAP` / `MODE_CODE`: mode string ↔ single hex digit (e.g. `'4'` = `'FM'`)
- `AGC_MAP`: AGC code → label
- `FUNC_KNOB`: function knob position code → label

**Key opcodes decoded in `_parseResponse()`:**
- `FA`/`FB`: main/sub VFO frequencies (Hz integer)
- `MD`: mode for main (P1=`0`) or sub (P1=`1`) VFO
- `SM`/`RM`: S-meter readings (0–255)
- `TX`/`MX`: transmit state / MOX
- `RI`: radio info byte field (TX, SWR alarm, scanning, squelch open, etc.)
- `MR`/`MZ`/`MT`: memory channel read, split TX freq, memory tag
- `SS`: band scope parameters (span, speed, mode, level, color, marker)
- `VE`: firmware version strings (6 sub-components)
- `EX`: extended parameters (antenna select, SQL/RF mode)

**Command queue** (`_queue: QueueEntry[]`):
- Used only for commands where the response is needed synchronously (e.g. `ID` during connect, `MR`/`MZ`/`MT` during memory scan)
- Each entry holds cmd string, resolve/reject callbacks, and a 1500 ms timeout timer
- Queue is matched by opcode prefix; if no match, frame is treated as unsolicited
- On disconnect or connection failure, `_drainQueue()` rejects all pending entries

## State Management

**Mechanism:** Module-level `shallowRef<TransceiverState>` in `composables/useSerial.ts`. All calls to `useSerial()` return the same singleton refs.

**`shallowRef` semantics:** Vue only tracks the top-level reference replacement, not deep property mutations. All state updates go through `_patch(changes)`, which creates a new spread object: `state.value = { ...state.value, ...changes, lastUpdate: Date.now() }`. Nested objects (`radioChannels`, `scope`, `firmware`) must also be replaced — the code does this explicitly (e.g. `channels[slot] = { ...channels[slot], ... }; ch.radioChannels = channels`).

**Local page state:** `pages/index.vue` holds additional UI-only state in `ref()`s: `savedChannels` (persisted to `localStorage` as `cat_channels`), `channelListRows` (editable in-memory copy of radio memory), popup visibility flags, busy flags, RSGB search state.

**No Pinia/Vuex:** The singleton pattern in the composable file makes a store unnecessary for this single-page app.

## Architectural Constraints

- **Threading:** Single-threaded browser event loop. The serial read loop uses `async/await` within a `while(true)` loop; it yields on every `_reader.read()` call, allowing the event loop to process Vue updates and user interactions between frames.
- **Global state:** `state`, `connecting`, `_port`, `_writer`, `_reader`, `_queue` are all module-level singletons in `composables/useSerial.ts`. Any component calling `useSerial()` shares the same port and state.
- **Web Serial API requirement:** Only available in Chromium-based browsers (Chrome, Edge) on HTTPS or `localhost`. The `isSupported` flag is checked at module load time; the UI shows a warning when false.
- **No backend:** The app is fully static. There is no server-side component at runtime. All I/O is browser ↔ serial port via Web Serial API.
- **Radio ID lock:** `connect()` rejects the connection if the radio does not return `ID0840`. The app only supports the Yaesu FTX-1.

## Anti-Patterns

### BandwidthDisplay only wired on MAIN VFO

**What happens:** `BandwidthDisplay` is rendered (and wired to emit `update:bandwidth`/`update:shift`) only on the MAIN VFO card. The SUB VFO card has the component commented out.
**Why it's wrong:** Bandwidth and IF shift are independently configurable per VFO on the FTX-1.
**Do this instead:** Add `BandwidthDisplay` to the SUB VFO card with `vfo="'1'"` wired, mirroring the MAIN card at `pages/index.vue` lines 259–265.

### All page logic in a single component

**What happens:** `pages/index.vue` contains ~1300 lines of `<script setup>` including channel management, RSGB API calls, CSV import/export, scope control, modal handling.
**Why it's wrong:** Makes the file hard to navigate and untestable in isolation.
**Do this instead:** Extract composables (`useChannelList`, `useRsgb`, `useScope`) following the existing `useSerial` pattern, or extract sub-components for the Channel List tab and each modal.

## Error Handling

**Strategy:** `try/catch` in all async handlers in `pages/index.vue`; errors set `lastError.value` which renders an error banner. The banner is manually dismissable.

**Patterns:**
- Serial errors during the read loop are silently swallowed (expected on normal disconnect)
- `_sendAndWait()` timeout (1500 ms) rejects the promise; callers catch and surface via `lastError`
- `connect()` re-throws errors after cleanup; `pages/index.vue` catches and sets `lastError`
- Preset command failures are per-command: a `CommandResult[]` is returned; `PresetButton` shows error on first failure

## External Integrations

**RSGB Repeater API:** `pages/index.vue` fetches from `https://ukrepeater.net/api2/` to search for UK repeaters by band, callsign, or Maidenhead locator. Results are added to `channelListRows`. No API key required. Called directly from the browser (CORS-permitting).

---

*Architecture analysis: 2026-05-08*
