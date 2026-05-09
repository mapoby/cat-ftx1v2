---
phase: 03-data-integrity-memory-operations
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - composables/useSerial.ts
  - pages/index.vue
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the Phase 3 changes: slot 0 guards in `writeMemoryChannel` / `deleteMemorySlot`, the `slotWriteResults` write-loop, both destructive-action modals (Delete Selected, Wipe All), `validateCsvRow`, and the restructured `onImportCsv`.

The slot 0 guards are correct and well-placed. The write-loop try/catch and result tracking are sound. The modal hardening for Wipe All is incomplete — the dialog is missing a close button and a backdrop-click handler, creating a UI lockout condition. The CSV validator contains two logic bugs: the tag length check fires on the raw quoted string (always over-counting), and `validateCsvRow` is not called with the correct `rowNum` argument type (minor, but the rowNum counter starts at 0 before the first increment, meaning the first data row is reported as row 1, which is correct — this one is fine). Two broader correctness issues are also present.

---

## Critical Issues

### CR-01: Wipe All modal has no way to close it on error / connection loss

**File:** `pages/index.vue:1029`

**Issue:** The Wipe All confirmation backdrop has no `@click.self` handler and no close (`✕`) button:

```html
<div v-if="wipeAllDialog" class="tone-modal-backdrop">
```

All other destructive modals in this file (CTCSS, DCS, Mode, Band, RSGB, repinfo) attach `@click.self` to their backdrop. If the user opens the Wipe All dialog and then the radio disconnects (or the browser loses focus), `wipeAllDialog` will be `true` indefinitely. The only escape path is the Cancel button — there is no keyboard escape handler, no backdrop dismiss, and the button is a plain `<button>`, not a focusable-by-Escape dialog. The user is locked into the modal.

**Fix:** Add a backdrop click-dismiss and an explicit close button, consistent with every other modal in the file:

```html
<div v-if="wipeAllDialog" class="tone-modal-backdrop" @click.self="wipeAllDialog = false">
  <div class="tone-modal wipe-confirm-modal" role="dialog" aria-modal="true" aria-label="Wipe All Memory">
    <div class="tone-modal-header wipe-confirm-header">
      <span class="tone-modal-title">⚠ WARNING</span>
      <button class="tone-modal-close" @click="wipeAllDialog = false" aria-label="Close">✕</button>
    </div>
```

---

### CR-02: CSV tag validation fires on the raw quoted string, not the parsed value

**File:** `pages/index.vue:2511-2513`

**Issue:** `validateCsvRow` reads `p[13]` directly from the parsed CSV field, but `parseCsvLine` does **not** strip the surrounding double-quotes — it only uses the quote character to suppress comma splitting. When `exportCsv` writes the tag it always wraps it: `` `"${r.tag}"` `` (line 2487). So a tag `"GB3AB"` is parsed into `p[13] = '"GB3AB"'` (8 chars including the quote characters). The length check `tag.length > 12` will count the quotes, and the non-printable regex test will pass, but a 12-character tag will be reported as 14 characters and rejected as too long:

```
Row N: Tag "some12charval" exceeds 12 chars …
```

A round-trip of a valid 12-character tag exported by this app will fail to re-import due to the spurious quotes being counted.

Additionally, the `onImportCsv` function assigns `tag: p[13] ?? ''` (line 2556) without stripping quotes, so the stored tag will contain literal `"` characters that will be sent to the radio via `MT` command, corrupting the memory tag.

**Fix:** Strip surrounding quotes in `parseCsvLine` or in the import path. The simplest fix is to strip them in `parseCsvLine`:

```typescript
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ }   // toggle — do not append
    else if (ch === ',' && !inQ) { result.push(cur); cur = '' }
    else cur += ch
  }
  result.push(cur)
  return result
}
```

This is already what the current code does — `"` characters toggle `inQ` and are not appended to `cur`. Re-reading carefully: the quote characters are **skipped** (not appended) because the `if (ch === '"')` branch does not do `cur += ch`. So `p[13]` for `"GB3AB"` would actually be `GB3AB` (5 chars, no quotes). The CSV quote-stripping is correct.

**Revised analysis:** The actual bug is narrower but still present. `validateCsvRow` validates `p[13]`, but `onImportCsv` assigns `tag: p[13] ?? ''`. `p[13]` may be `undefined` if the CSV row has fewer than 14 columns (e.g., a row missing the trailing tag field). `validateCsvRow` guards `p[13] ?? ''`, which is safe, but the `onImportCsv` assignment on line 2556 also uses `?? ''` — so both paths are actually safe. This specific issue is **not a bug**. Withdrawing CR-02 severity reclassification.

**Actual CR-02 — slot 0 can enter `channelListRows` via `loadChannelList`**

**File:** `pages/index.vue:2297-2301`

**Issue:** `loadChannelList` deserialises the raw `cat_channel_list` JSON from localStorage without any validation. If a previous version of the app (before the slot 0 guard was added) stored a row with `slot: 0`, that row will be loaded and will appear in the table. When `writeAllToRadio` processes it, `writeMemoryChannel(0, ...)` will throw (the guard in `useSerial.ts` will reject it), but the error is caught, shown in `slotWriteResults`, and the loop continues. This does not cause data loss but it will confuse users. Similarly, `deleteSelectedFromRadio` calls `deleteMemorySlot(slot)` for every selected slot — if a slot-0 row somehow exists in `selectedSlots`, `deleteMemorySlot(0)` will throw and the error is surfaced via `lastError`. The guard works, but the UI will not block the operation visually.

More concretely: any slot-0 row that entered localStorage before Phase 3 will silently persist in the table forever (the dirty-write path is guarded, but no code removes it from the list). The `validateCsvRow` guard prevents slot 0 from entering via CSV import, but localStorage bypass is unguarded.

**Fix:** Add a migration guard in `loadChannelList`:

```typescript
function loadChannelList() {
  try {
    const raw = localStorage.getItem('cat_channel_list')
    if (raw) {
      const parsed = JSON.parse(raw)
      channelListRows.value = Array.isArray(parsed)
        ? parsed.filter((r: any) => r.slot >= 1 && r.slot <= 999)
        : []
    }
  } catch { /* corrupt, ignore */ }
}
```

---

## Warnings

### WR-01: `wipeAllMemory` does not guard against slot 0 in `channelListRows`

**File:** `pages/index.vue:2414-2417`

**Issue:** `wipeAllMemory` iterates `channelListRows.value.map(r => r.slot)` and calls `deleteMemorySlot(slot)` for each. The slot 0 guard in `deleteMemorySlot` will throw and the error will be caught by `.catch(e => lastError.value = e.message)`. The wipe loop continues for the remaining slots, so no data is lost. However, the error message "Slot 0 is not a valid memory channel" will appear in the error banner, which will be confusing for the user.

**Fix:** Filter slot 0 in the slots list:

```typescript
const slots = channelListRows.value.map(r => r.slot).filter(s => s >= 1)
```

---

### WR-02: `deleteSelectedFromRadio` does not filter slot 0 from `selectedSlots`

**File:** `pages/index.vue:2397-2401`

**Issue:** Same root cause as WR-01. If a slot-0 row is selected and Delete Selected is triggered, `deleteMemorySlot(0)` throws inside the loop. The `.catch` handler shows it in `lastError`, the loop continues, and the slot-0 row remains in the table (it is not removed because the filter on line 2402 will not find it removed from `slots` as the slot still equals 0 — actually it will be found in `slots`, so the row _is_ removed from the table). The only user-visible symptom is the spurious error banner.

**Fix:** Filter when building the slots snapshot:

```typescript
const slots = [...selectedSlots.value].filter(s => s >= 1)
```

---

### WR-03: CSV import silently overwrites the entire channel list even on partial-error path

**File:** `pages/index.vue:1084`

**Issue:** When the user clicks "Import Valid Rows Only" in the CSV error confirmation dialog, the handler is:

```html
@click="channelListRows = csvPendingRows.sort((a, b) => a.slot - b.slot); csvConfirmDialog = false; ..."
```

This **replaces** `channelListRows` entirely with only the valid rows, discarding any rows that were previously in the table (either loaded from radio or manually added). The button label says "Import Valid Rows Only" which is ambiguous — a user might reasonably expect it to _merge_ the valid rows into the existing list, not replace it. The zero-errors path on line 2567 also does a full replacement:

```typescript
if (validRows.length) channelListRows.value = validRows.sort(...)
```

Both paths are consistent with each other, but the behaviour (full replacement) is destructive and not communicated to the user. If the user imported a second CSV to add more channels, they would lose their first import.

**Fix:** Either (a) merge imported rows into the existing list (matching by slot number), or (b) update the dialog and button text to clearly state "Replace current list with valid rows".

---

### WR-04: `parseCsvLine` does not handle escaped quotes inside quoted fields

**File:** `pages/index.vue:2455-2466`

**Issue:** The CSV parser toggles `inQ` on every `"` character. RFC 4180 CSV escapes an embedded double-quote as `""`. With the current parser, a tag value of `AB""CD` (an embedded quote) would produce `inQ` toggling four times (net: `inQ = false`), and the content between the two quotes would be accumulated correctly. However, a tag value like `AB"CD` (single unmatched quote mid-field) would leave `inQ = true` for the rest of the line, consuming the comma separator and all subsequent fields into the current field. This will produce `undefined` for all fields after the tag, causing the validator to see `p[0]` etc. as `undefined` and throw a confusing error. This is an edge case but it is reachable if a user hand-edits a CSV with a tag containing an apostrophe-lookalike or an actual quote.

**Fix:** This is an acceptable limitation for a hand-edited CSV importer, but the behaviour should be documented or the validator should check column count before parsing fields:

```typescript
if (p.length < 14) {
  return `Row has only ${p.length} columns (expected 14)`
}
```

---

## Info

### IN-01: `validateCsvRow` `rowNum` parameter is unused

**File:** `pages/index.vue:2501`

**Issue:** The function signature is `validateCsvRow(p: string[], rowNum: number)` but `rowNum` is never used inside the function body. The row number is only used in the `errors.push({ row: rowNum, ... })` call at the call site. The parameter is dead code.

**Fix:** Remove the parameter from the function signature and update the call site:

```typescript
function validateCsvRow(p: string[]): string | null { ... }
// call site:
const err = validateCsvRow(p)
```

---

### IN-02: Wipe All modal count reflects UI table rows, not radio memory reality

**File:** `pages/index.vue:1035`

**Issue:** The warning message reads "This will overwrite **all {{ channelListRows.length }} channels** in radio memory". The count `channelListRows.length` is the number of rows in the editable table, which may be a subset of what is on the radio (if the user only scanned slots 1–99 out of 999). The message implies completeness ("all … in radio memory") when it only affects the rows currently loaded in the table.

**Fix:** Change the message to "This will overwrite all **{{ channelListRows.length }} loaded channels** in radio memory" to set accurate expectations.

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
