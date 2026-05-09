# Phase 3: Data Integrity — Memory Operations - Research

**Researched:** 2026-05-09
**Domain:** Vue 3 / Nuxt 3 reactive UI, CAT protocol write path, CSV validation
**Confidence:** HIGH

---

## Summary

Phase 3 delivers four data-integrity requirements against the channel list and memory write pipeline. All work is contained within `pages/index.vue` and `composables/useSerial.ts` — no new files are strictly required, though a helper function extracted to a separate module for CSV row validation would keep the composable clean.

The codebase has a complete channel-list system already in place: editable rows, write-to-radio loop, delete/wipe operations, CSV import/export, and a Wipe All confirmation dialog. The four requirements add validation gates, per-slot result feedback, a disclosure modal for delete semantics, and a slot-0 guard.

**Primary recommendation:** Implement all four requirements as targeted edits to `index.vue` and `useSerial.ts`. No new composables or external libraries are needed.

---

## Project Constraints (from CLAUDE.md)

- App is a fully static SPA (Nuxt 3, `ssr: false`), served from nginx Docker container on Azure App Service.
- Serial communication via browser-native Web Serial API — no backend.
- Key files: `composables/useSerial.ts`, `pages/index.vue`.
- Do not add comments, docstrings, or type annotations to code that wasn't changed.
- Do not create abstractions or helpers for one-time use.
- Prefer editing existing files over creating new ones.
- Do not add error handling for scenarios that cannot happen.
- Keep solutions minimal — only what is needed for the current task.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | CSV import validates each row for frequency range, valid mode code, slot number (1–999), and tag length/character set before applying any rows; a per-row error summary is shown before import is committed | See "DATA-01 Analysis" below |
| DATA-02 | Each memory channel write produces per-slot feedback ("Channel N written" / "Channel N failed") visible in the UI | See "DATA-02 Analysis" below |
| DATA-03 | Delete and Wipe All operations display a persistent (non-dismissable until acknowledged) disclosure that deletion overwrites with blank values and does not remove the slot number from the radio | See "DATA-03 Analysis" below |
| DATA-04 | Slot 0 is guarded against use as a write/delete target in all code paths | See "DATA-04 Analysis" below |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSV validation logic | Browser / Client | — | Pure function; no serial or Vue deps; runs in the script setup block of index.vue |
| Per-slot write feedback | Browser / Client | — | Reactive UI state in index.vue; `writeMemoryChannel` is the write primitive |
| Delete/Wipe disclosure modal | Browser / Client | — | Template-only concern; existing wipeAllDialog pattern applies |
| Slot-0 guard | API / Composable + UI | — | Guard must live in `useSerial.ts` (composable layer) AND in UI input validation |

---

## Standard Stack

### Core (already installed, no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | bundled with Nuxt 3.13 | Reactive UI, `ref`, `computed`, `watch` | Project standard |
| Nuxt 3 | ^3.13.0 | SPA host, `ssr: false` | Project standard |
| TypeScript | ^5.0.0 | Type safety | Project standard |
| Vitest | ^4.1.5 | Unit tests (nyquist_validation: false, but tests exist) | Project standard |

**No new packages required for Phase 3.** All requirements are implementable with existing Vue 3 reactivity primitives and the existing composable/component structure.

---

## Architecture Patterns

### System Architecture Diagram

```
User action (Import CSV / Write / Delete / Wipe)
        |
        v
[index.vue — script setup]
   ├── DATA-01: validateCsvRows() → error summary → confirm gate → apply rows
   ├── DATA-02: writeAllToRadio() per-slot try/catch → slotFeedback reactive map
   ├── DATA-03: deleteSelectedFromRadio() / wipeAllMemory() → disclosure modal
   └── DATA-04: slot guard (input + composable)
        |
        v
[useSerial.ts — writeMemoryChannel / deleteMemorySlot]
   └── DATA-04: slot === 0 → throw (early return guard)
        |
        v
[Web Serial API — _write() → radio CAT bus]
```

### Existing Pattern: Wipe All Confirmation Dialog

The `wipeAllDialog` ref and modal already exist in `index.vue` (lines 1019–1037 of the template, `wipeAllDialog = ref(false)` at line 1134). DATA-03 for Wipe All is a **content change** to this existing modal — the disclosure text must be made persistent (no close-on-backdrop-click without acknowledgement), and the "This cannot be undone" body must include the specific language about blank-overwrite semantics.

The **Delete Selected** path has no confirmation dialog at all today. DATA-03 requires adding one. The existing wipeAllDialog modal is the model to follow.

[VERIFIED: codebase grep — wipeAllDialog modal at index.vue:1019-1037]

### Existing Pattern: Write Progress Feedback

`writeAllToRadio()` already tracks `chListWriteDone` and `chListWriteTotal` for a progress counter displayed in the Write button label (`Writing… N/M`). DATA-02 requires adding **per-slot result items** (not just a counter). The natural location is a reactive array or map appended inside the existing write loop.

[VERIFIED: codebase read — writeAllToRadio at index.vue:2506-2531]

### Existing Pattern: CSV Import

`onImportCsv()` currently:
1. Reads all lines
2. Silently skips rows where `slot < 1 || slot > 999 || freq <= 0`
3. Applies all passing rows immediately — **no pre-flight gate, no error summary**

DATA-01 requires restructuring this into a two-pass approach: validate-all, show summary, await user confirmation, then apply.

[VERIFIED: codebase read — onImportCsv at index.vue:2445-2486]

### Existing Pattern: CTCSS / DCS Index Bounds

CTCSS_TONES has 50 entries (indices 0–49). DCS_CODES has 104 entries (indices 0–103). These are already defined as `const` arrays in index.vue at lines 1279–1296. DATA-01 validation must verify ctcssIdx is 0–49 and dcsIdx is 0–103.

[VERIFIED: codebase read — CTCSS_TONES length=50, DCS_CODES length=104 at index.vue:1279-1296]

### Frequency Range for DATA-01

The requirement says "100,000–470,000,000 Hz". The existing `FREQ_MIN = 100_000` (line 1600) and band table shows 430 MHz band maxes at 450 MHz. The `FREQ_MAX` in index.vue is `999_999_999` (for VFO use), but the requirement text says 470,000,000. Use the requirement's stated range for CSV import validation since that covers the FTX-1's actual receive range for memory channels (not all VFO-addressable frequencies are memory-writable).

[VERIFIED: requirement text DATA-01 states "100,000–470,000,000 Hz"; ASSUMED that 470 MHz upper bound is the FTX-1 memory channel limit — confirm against CAT-FTX1.pdf if available]

### Tag Character Set for DATA-01

The requirement says "tag length/character set". Current `onImportCsv` truncates to 12 chars with `p[13]?.substring(0, 12)`. The FTX-1 CAT MT command sends a 12-character field padded with spaces. The tag character set is [ASSUMED] to be printable ASCII (0x20–0x7E) based on the MT command structure — no official character set table was found in the codebase. The STATE.md key todo notes: "Confirm CTCSS/DCS index bounds and clarifier range against CAT-FTX1.pdf before writing DATA-01 validation code."

[ASSUMED: tag allows printable ASCII only (0x20–0x7E), max 12 chars — must be confirmed against CAT-FTX1.pdf]

### Mode Code Validation for DATA-01

Valid mode labels are the keys of `MODE_CODE` in `catParser.ts`: AMS, LSB, USB, CW-U, FM, AM, RTTY-L, CW-L, DATA-L, RTTY-U, DATA-FM, FM-N, DATA-U, AM-N, PSK, DATA-FM-N, C4FM-DN, C4FM-VW (18 modes). The existing import already checks `validModes.has(p[4])` but silently falls back to USB. DATA-01 requires treating an invalid mode as a **validation error**, not a silent fallback.

[VERIFIED: MODE_CODE in catParser.ts, validModes set in onImportCsv]

---

## Detailed Requirement Analysis

### DATA-01: CSV Import Validation

**Current state:** `onImportCsv` does partial validation (slot 1–999, freq > 0) but silently skips bad rows and immediately applies good ones without user confirmation.

**What must change:**
1. Validation pass collects `{ rowNum, reason }` error objects per bad row instead of silently skipping.
2. Validation checks: slot 1–999 (not 0), freq 100,000–470,000,000 Hz, mode in valid set, tag ≤ 12 chars printable ASCII, ctcssIdx 0–49 when sqlType 1–2, dcsIdx 0–103 when sqlType 3–4.
3. If any errors: show a modal listing the per-row errors with a "Fix CSV" / "Import Valid Rows Only" choice. A fully invalid file (all rows bad) writes nothing.
4. If no errors (or user confirms partial): apply rows to `channelListRows`.

**Implementation approach:**
- Extract a pure `validateCsvRow(p: string[], rowNum: number): string | null` function that returns an error string or null. Keep it in `index.vue` as a local function (not worth a separate file for one phase).
- Add reactive state: `csvValidationErrors = ref<{row: number, reason: string}[]>([])`, `csvPendingRows = ref<EditableChannel[]>([])`, `csvConfirmDialog = ref(false)`.
- The confirm dialog shows the error list and two action buttons: discard import (X close) and import valid rows only.

### DATA-02: Per-Slot Write Feedback

**Current state:** `writeAllToRadio()` increments `chListWriteDone` for a progress counter but provides no per-slot pass/fail visibility. Errors are sent to `lastError` (overwritten by the last error only).

**What must change:**
1. Add `slotWriteResults = ref<{slot: number, ok: boolean, error?: string}[]>([])`, cleared at start of write.
2. Inside the write loop, push a result entry after each `writeMemoryChannel` call (success) or catch (failure).
3. Display the results as a scrollable list below the toolbar or in a status area — "Channel N written" (green) / "Channel N failed: reason" (red).
4. The list persists until next write operation begins (so the operator can see failures after the loop completes).

**Key consideration:** `writeMemoryChannel` uses fire-and-forget `send()` calls internally with no acknowledgement loop. There is no per-slot CAT response confirming the write succeeded — the FTX-1 AM (store to memory) command does not return a payload. "Written" therefore means "all send() calls completed without throwing" for that slot. "Failed" means an exception was thrown. This is the best available signal given the protocol.

[VERIFIED: writeMemoryChannel in useSerial.ts uses send() (fire-and-forget) — no solicited response for AM command]
[ASSUMED: AM command success = no exception thrown; there is no per-slot CAT acknowledgement from the FTX-1 for memory writes]

### DATA-03: Delete/Wipe All Disclosure

**Current state:**
- **Wipe All:** Has a confirmation modal (wipeAllDialog) with text "The radio has no delete command — slots will remain but contain no useful data. This cannot be undone." The close button (X) in the header allows dismissal without acknowledging. This partially satisfies the intent but the X button is a non-acknowledgement dismissal path.
- **Delete Selected:** Has NO confirmation dialog. The delete operation fires immediately on button click.

**What must change:**
1. **Wipe All modal:** Remove the X close button from the modal header (or replace with a non-dismissive cancel button in the action row). The modal must require explicit user action (Cancel or WIPE ALL) to close. The existing disclosure text is adequate; the persistence requirement means no backdrop-click and no X dismiss.
2. **Delete Selected:** Add a new confirmation modal (or reuse a shared disclosure modal pattern) that shows the same "overwrite with blank values, slot number not removed from radio" disclosure. Must show the count of slots to be deleted. Requires explicit acknowledgement.

**Template pattern (existing wipeAllDialog modal is the model):**
- Remove `@click.self="wipeAllDialog = false"` from backdrop or change backdrop to non-dismissive.
- Remove or replace the `.tone-modal-close` X button.

### DATA-04: Slot 0 Guard

**Current state:** Three code paths could theoretically receive slot 0:
1. `writeMemoryChannel(slot, config)` in useSerial.ts — no guard.
2. `deleteMemorySlot(slot)` in useSerial.ts — no guard.
3. `updateRowSlot(row, newSlotStr)` in index.vue — **already guards** with `n < 1 || n > 999`.

**What must change:**
1. Add `if (slot === 0) throw new Error('Slot 0 is not a valid memory channel')` at the top of `writeMemoryChannel` and `deleteMemorySlot` in useSerial.ts.
2. The UI slot input already rejects slot 0 (`n < 1`). The composable guard is a defense-in-depth layer.
3. Scan range inputs (`chListScanFrom`, `chListScanTo`) have `min="1"` in the template — no additional guard needed for scan.
4. `readMemoryChannel` slot parsing in catParser.ts already filters `slot > 0` before storing to radioChannels (line 269: `if (slot > 0 && freq > 0)`).

[VERIFIED: updateRowSlot guard at index.vue:2293-2299; MR parser slot>0 guard at catParser.ts:269; scan range min="1" at index.vue:523-524]
[VERIFIED: writeMemoryChannel has no slot===0 guard (useSerial.ts:491); deleteMemorySlot has no slot===0 guard (useSerial.ts:521)]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom tokenizer | Existing `parseCsvLine()` in index.vue | Already handles quoted fields correctly |
| Modal management | New modal component | Inline Teleport modal (existing pattern) | All modals in this file use `<Teleport to="body">` with a `ref(false)` guard |
| Write queue coordination | Custom lock | Existing `chListWriting.value` busy flag | Pattern is established across all async ops |

---

## Common Pitfalls

### Pitfall 1: CSV Partial Apply After Validation
**What goes wrong:** Calling `onImportCsv` applies rows immediately; if refactored to a two-phase validate-then-commit, a coding error could result in validation passing but applying the wrong (unvalidated) array.
**Why it happens:** The validated-row list and the originally-parsed list can diverge if not threaded carefully.
**How to avoid:** The `csvPendingRows` ref should hold the **already-validated** rows (i.e., the rows that passed all checks). When the user confirms, copy `csvPendingRows.value` into `channelListRows.value` directly — no re-parse.

### Pitfall 2: Per-Slot Write Feedback Cleared Too Early
**What goes wrong:** Clearing `slotWriteResults` at the start of `writeAllToRadio` is correct, but if the ref is also cleared on tab switch or on radio disconnect, the operator loses visibility into which slots failed.
**How to avoid:** Only clear `slotWriteResults` at the start of a new write operation. Do not wire it to `watch(activeTab, ...)` or the disconnect handler.

### Pitfall 3: Delete Disclosure Modal — Backdrop Dismissal
**What goes wrong:** The existing wipeAllDialog uses `@click.self="wipeAllDialog = false"` on the backdrop div, allowing dismiss without acknowledgement. DATA-03 requires a persistent modal.
**How to avoid:** Remove `@click.self` from the backdrop binding on the delete/wipe modals. Provide only two explicit action buttons (Cancel and confirm).

### Pitfall 4: writeMemoryChannel "Written" Is Best-Effort
**What goes wrong:** Marking a slot as "written" based on no-exception from `send()` (fire-and-forget) means the feedback is optimistic — the radio's actual write may still fail silently (e.g., out-of-band error the radio emits as an unsolicited frame).
**Why it happens:** The FTX-1 AM command has no solicited response; `send()` resolves when the bytes leave the serial buffer, not when the radio has stored the channel.
**How to avoid:** Document this in the UI: label the feedback "sent" not "confirmed". The requirement says "written" / "failed" — use that language but accept it reflects serial write success, not radio storage confirmation.

### Pitfall 5: Slot 0 Reachable via Drag-and-Drop Reassignment
**What goes wrong:** The drag-and-drop reorder in `onDrop()` reassigns slot numbers from `channelListRows.value.map(r => r.slot).sort()`. If a slot 0 row were somehow present (e.g., imported from a hand-edited CSV that passed validation before the guard was added), the sorted slot array could assign slot 0 to the first row.
**How to avoid:** DATA-01 validation rejects slot 0 at import time. The slot input guard `n < 1` prevents manual entry of slot 0. With both guards in place, slot 0 cannot appear in `channelListRows`. The composable guard in `writeMemoryChannel`/`deleteMemorySlot` is the last line of defence.

---

## Code Examples

### Per-Slot Feedback — Write Loop Pattern
```typescript
// Source: verified from existing writeAllToRadio pattern at index.vue:2506
const slotWriteResults = ref<{ slot: number; ok: boolean; error?: string }[]>([])

async function writeAllToRadio() {
  if (chListWriting.value) return
  chListWriting.value = true
  slotWriteResults.value = []
  const dirty = channelListRows.value.filter(r => r.dirty)
  chListWriteDone.value = 0
  chListWriteTotal.value = dirty.length
  try {
    for (const row of dirty) {
      try {
        await writeMemoryChannel(row.slot, { /* ... */ })
        slotWriteResults.value.push({ slot: row.slot, ok: true })
        row.dirty = false
      } catch (e: any) {
        slotWriteResults.value.push({ slot: row.slot, ok: false, error: e.message })
        lastError.value = e.message
      }
      chListWriteDone.value++
    }
    saveChannelList()
  } finally {
    chListWriting.value = false
  }
}
```

### Slot 0 Guard in Composable
```typescript
// Source: verified from writeMemoryChannel signature at useSerial.ts:491
export async function writeMemoryChannel(slot: number, config: MemoryWriteConfig): Promise<void> {
  if (slot === 0) throw new Error('Slot 0 is not a valid memory channel')
  // ... existing implementation
}

export async function deleteMemorySlot(slot: number): Promise<void> {
  if (slot === 0) throw new Error('Slot 0 is not a valid memory channel')
  // ... existing implementation
}
```

### CSV Row Validation — Skeleton
```typescript
// Source: ASSUMED pattern based on DATA-01 requirements and existing onImportCsv logic
interface CsvRowError { row: number; reason: string }

function validateCsvRow(p: string[], rowNum: number): CsvRowError | null {
  const slot = parseInt(p[0])
  if (isNaN(slot) || slot < 1 || slot > 999)
    return { row: rowNum, reason: `Slot "${p[0]}" out of range (must be 1–999)` }
  const freq = Math.round(parseFloat(p[1]) * 1_000_000)
  if (isNaN(freq) || freq < 100_000 || freq > 470_000_000)
    return { row: rowNum, reason: `RX freq "${p[1]}" out of range (0.1–470 MHz)` }
  const validModes = new Set(Object.keys(MODE_CODE))
  if (p[4] && !validModes.has(p[4]))
    return { row: rowNum, reason: `Mode "${p[4]}" is not a valid FTX-1 mode` }
  const tag = p[13] ?? ''
  if (tag.length > 12 || /[^\x20-\x7E]/.test(tag))
    return { row: rowNum, reason: `Tag "${tag}" exceeds 12 chars or contains non-ASCII` }
  return null
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Silent skip of invalid CSV rows | Pre-flight validation with per-row error summary | Phase 3 | Operator sees exactly what is wrong before any data is written |
| Single global error banner for write failures | Per-slot write result list | Phase 3 | Operator can identify which specific slots failed in a bulk write |
| Wipe All modal with X dismiss | Persistent modal requiring explicit acknowledgement | Phase 3 | No accidental dismiss; protocol limitation disclosed |
| No delete confirmation | Delete disclosure modal | Phase 3 | Same protocol limitation disclosure for single/multi-slot delete |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CSV import upper frequency bound is 470,000,000 Hz (the FTX-1 memory channel limit) | DATA-01 Analysis | If the limit is lower (e.g., 450 MHz), valid UHF channels would be incorrectly rejected |
| A2 | Tag character set for MT command is printable ASCII (0x20–0x7E) | DATA-01 Analysis | If the radio accepts a wider character set (e.g., katakana), valid tags would be incorrectly rejected |
| A3 | AM (store to memory) command success is inferred from no-exception on send() | DATA-02 Analysis | If the radio silently fails a memory write (no error response), the UI would show "written" for a failed write |

**A1 and A2 can be confirmed against CAT-FTX1.pdf (flagged in STATE.md key todos).**

---

## Open Questions

1. **Frequency upper bound for DATA-01**
   - What we know: Requirement says 100,000–470,000,000 Hz; FTX-1 covers 430 MHz band (430–450 MHz)
   - What's unclear: Whether memory channels can be written above 450 MHz (the top of the 430 MHz band in BANDS table) up to 470 MHz
   - Recommendation: Use 470,000,000 as stated in the requirement; revisit if CAT-FTX1.pdf specifies a lower limit

2. **Tag character set**
   - What we know: MT command sends 12-char padded string; exportCsv wraps tag in double quotes
   - What's unclear: Whether the radio's character decoder accepts anything beyond ASCII
   - Recommendation: Use printable ASCII (0x20–0x7E) as the safe conservative default; document the assumption in the validation error message

3. **Delete Selected disclosure — share modal with Wipe All?**
   - What we know: Wipe All has its own modal; Delete Selected currently has none
   - What's unclear: Whether a single shared "deletion disclosure" modal (parameterised with slot count) is preferable to two separate modals
   - Recommendation: A single modal with a `deleteDisclosureDialog = ref<{ count: number; onConfirm: () => void } | null>(null)` pattern avoids template duplication

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is purely code/config changes against the existing local dev environment. No new external tools, services, or CLIs are required. Node 22.14.0 is confirmed available.

---

## Sources

### Primary (HIGH confidence)
- `c:/GitHub/cat-ftx1v2/composables/useSerial.ts` — writeMemoryChannel, deleteMemorySlot, send() fire-and-forget pattern
- `c:/GitHub/cat-ftx1v2/composables/catParser.ts` — MODE_CODE, MODE_MAP, MR/MZ/MT parsers, slot>0 guard
- `c:/GitHub/cat-ftx1v2/pages/index.vue` — onImportCsv, writeAllToRadio, deleteSelectedFromRadio, wipeAllMemory, wipeAllDialog modal, CTCSS_TONES, DCS_CODES, updateRowSlot guard
- `c:/GitHub/cat-ftx1v2/.planning/REQUIREMENTS.md` — DATA-01 through DATA-04 authoritative descriptions
- `c:/GitHub/cat-ftx1v2/.planning/STATE.md` — accumulated decisions, key todos

### Secondary (MEDIUM confidence)
- `c:/GitHub/cat-ftx1v2/.planning/ROADMAP.md` — Phase 3 success criteria cross-reference

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing
- Architecture: HIGH — all patterns verified directly in codebase
- Pitfalls: HIGH (protocol limitations) / MEDIUM (tag character set — assumed)
- Frequency upper bound: MEDIUM — requirement states 470 MHz but physical confirmation pending

**Research date:** 2026-05-09
**Valid until:** Until CAT-FTX1.pdf is consulted for A1/A2 (frequency bound and tag charset). All other findings are stable.
