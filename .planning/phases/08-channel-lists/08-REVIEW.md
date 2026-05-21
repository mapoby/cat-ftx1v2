---
phase: 08-channel-lists
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - composables/useLists.ts
  - composables/useLists.test.ts
  - pages/index.vue
  - vitest.config.mts
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the `useLists` composable, its test suite, the Phase 8 additions to `pages/index.vue` (Import from List dialog, Manage Lists dialog, related handlers), and `vitest.config.mts`.

The composable's module-level shared state (`userLists`, `bundledLists`) is a correctness hazard in tests and in SSR-adjacent patterns. The `exportList` function contains a URL object leak. The `importFromList` slot-allocation logic silently skips channels when overwrite mode is off and slots run out, with no user feedback. The `validateChannelList` function does not validate the `source` field, allowing silent promotion of a `bundled` list into `userLists`. The test suite's `resetState` function does not reset `loadError`, leaving it stale across tests.

---

## Critical Issues

### CR-01: Module-level `ref` state is shared across all composable consumers and test runs

**File:** `composables/useLists.ts:27-29`
**Issue:** `userLists`, `bundledLists`, and `loadError` are declared at module scope as plain `ref()` calls, outside the `useLists()` function. In the test suite `resetState` manually resets `userLists` and `bundledLists`, but any test that throws before reset, any ordering change, or any future test that also calls `initLists()` will leave `bundledLists` contaminated. More critically, `initLists()` **pushes** to `bundledLists.value` (`bundledLists.value.push(data)` at line 81); it never clears first. Calling `initLists()` more than once — or across two test files — doubles the bundled entries with no deduplication. In a browser SPA this is a less acute risk because modules load once, but the design makes correctness tests non-isolated by default.

**Fix:** Move state inside `useLists()` using Vue's `useState` pattern (or a factory), or at minimum clear `bundledLists.value` at the start of `initLists()` before pushing:
```ts
// top of initLists(), before the try block:
bundledLists.value = []
```
This prevents double-loading on re-init and makes test isolation trivially achievable without relying on manual teardown.

---

### CR-02: `exportList` leaks an object URL — `revokeObjectURL` called before the click event fires

**File:** `composables/useLists.ts:165-173`
**Issue:** The function calls `URL.revokeObjectURL(url)` synchronously, immediately after `a.click()`. `a.click()` is synchronous in browsers but the browser initiates the download asynchronously. Revoking the URL in the same synchronous turn causes the download to fail in some browsers (Chromium-based browsers usually succeed because the download starts before the microtask boundary, but Firefox and Safari may fail). Additionally, the anchor element is never appended to the document, which causes the click to be silently ignored in Firefox unless the element is in the DOM.

**Fix:**
```ts
function exportList(list: ChannelList): void {
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = list.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
```

---

### CR-03: `importFromList` silently drops channels when slots run out (overwrite=off); no user feedback

**File:** `pages/index.vue:3075-3099`
**Issue:** When `listImportOverwrite` is false, the inner `while` loop advances `nextSlot` past occupied slots. If all slots 1–999 are occupied or `nextSlot` exceeds 999 before all selected entries are processed, the remaining entries are silently discarded (line 3079: `if (nextSlot > 999) break`). The dialog closes with no indication that some entries were not imported. The user sees the "Add N channels" button, clicks it, and some subset of N channels silently disappears.

**Fix:** Track how many entries were actually added and show the user a warning if fewer were imported than selected:
```ts
function importFromList() {
  // ... (existing slot allocation loop) ...

  const added = newRows.length
  const requested = selectedEntries.length

  // ... (existing merge logic) ...

  listImportSelected.value = new Set()
  listImportDialog.value = false

  if (added < requested) {
    lastError.value = `Only ${added} of ${requested} channels imported — radio slots 1–999 are full.`
  }
}
```

---

## Warnings

### WR-01: `validateChannelList` does not validate the `source` field, allowing arbitrary values into typed state

**File:** `composables/useLists.ts:33-46`
**Issue:** `validateChannelList` checks `id`, `name`, and `entries`, but does not validate `source`. A JSON file with `source: "bundled"` passes validation and is then pushed into `userLists` by `importListFromText` (after `source` is overridden to `'user'`). However, `fetchRemoteList` sets `source = 'remote'` after validation (line 158) — it mutates `data` directly. This is fine, but `loadUserLists` does not re-validate the `source` field either, so a corrupt localStorage entry with `source: "bundled"` would load into `userLists` and the `deleteList`/`renameList` guards (which check `list.source !== 'user'`) would then silently refuse to delete or rename that list, with no error surfaced to the user.

**Fix:** Add a source validation step in `loadUserLists`, or at minimum in `validateChannelList`:
```ts
const VALID_SOURCES = new Set(['bundled', 'user', 'remote'])
if (typeof o['source'] !== 'string' || !VALID_SOURCES.has(o['source'] as string)) return false
```

---

### WR-02: `resetState` in the test file does not reset `loadError`

**File:** `composables/useLists.test.ts:5-10`
**Issue:** `resetState` resets `userLists` and `bundledLists` but not `loadError`. Any test that sets `loadError` (through future tests or via `initLists` mock failures) will leave the error ref dirty for subsequent tests, potentially causing spurious failures or masking real ones.

**Fix:**
```ts
function resetState() {
  const { userLists, bundledLists, loadError } = useLists()
  userLists.value = []
  bundledLists.value = []
  loadError.value = null
  localStorage.clear()
}
```

---

### WR-03: `updateEntry` in `useLists.ts` does not guard against non-user lists

**File:** `composables/useLists.ts:130-135`
**Issue:** `updateEntry` finds the list by ID across `userLists` only (correct), but does not check `list.source !== 'user'` before mutating entries. All other mutating functions (`addEntry`, `renameList`, `deleteList`) guard against non-user lists. `updateEntry` is inconsistent: if a list with source `'bundled'` or `'remote'` somehow ends up in `userLists` (e.g., via a corrupt localStorage load as described in WR-01), `updateEntry` would mutate it and persist it.

**Fix:**
```ts
function updateEntry(listId: string, index: number, entry: ListEntry): void {
  const list = userLists.value.find(l => l.id === listId)
  if (!list || list.source !== 'user') return
  list.entries[index] = entry
  saveUserLists()
}
```

---

### WR-04: `onImportListFile` swallows the original `Error` object when `e.message` is undefined

**File:** `pages/index.vue:3129-3131`
**Issue:** The catch block uses `String(e.message ?? 'Invalid file')`. If `e` is not an `Error` instance (e.g., `JSON.parse` throws a string literal in some environments, or `importListFromText` re-throws a non-Error), `e.message` is `undefined`, and the fallback `'Invalid file'` is shown instead of the actual error text. This is the same pattern used in `addListFromUrl` (line 3144). In `addListFromUrl` the callee `fetchRemoteList` always throws `Error` objects, so it is fine there. But `importListFromText` calls `JSON.parse` which throws a `SyntaxError` (an `Error` subclass), so the real message would be captured — however the pattern is fragile and should use a consistent approach.

**Fix:**
```ts
} catch (e) {
  listImportFileError.value = e instanceof Error ? e.message : 'Invalid file'
}
```

---

## Info

### IN-01: `vitest.config.mts` coverage only includes `catParser.ts`, not the new `useLists.ts`

**File:** `vitest.config.mts:9`
**Issue:** The coverage configuration only instruments `composables/catParser.ts`. `composables/useLists.ts` is tested but excluded from coverage reporting, so coverage thresholds (if added in future) will not apply to it and coverage gaps will not be visible.

**Fix:** Add `useLists.ts` to the coverage include list:
```ts
include: ['composables/catParser.ts', 'composables/useLists.ts'],
```

---

### IN-02: `importListFromText` in `useLists.ts` assigns `data.id` and `data.source` via direct property mutation after type guard

**File:** `composables/useLists.ts:180-181`
**Issue:** After `validateChannelList(data)` narrows `data` to `ChannelList`, the code mutates `data.id` and `data.source` directly. This works at runtime because the type guard returns the same object reference, but TypeScript has to allow mutation on what is declared a `ChannelList` (a validated interface). The pattern is fine here but is inconsistent with the clone approach that would make intent clearer. More practically: the `createdAt` field is not updated/set on import, so imported lists retain the `createdAt` from the original file, which could be misleading in the Manage Lists table (no `createdAt` column, but the field is stored).

**Fix:** No code change required if the `createdAt` discrepancy is acceptable. If not, reset it on import:
```ts
data.id = crypto.randomUUID()
data.source = 'user'
data.createdAt = new Date().toISOString()
```

---

### IN-03: Manage Lists dialog — `listImportFileError` is only cleared on `onImportListFile` call, not when the dialog is closed

**File:** `pages/index.vue:1150, 3122-3123`
**Issue:** `listImportFileError` is displayed inside the Manage Lists dialog (line 1150). It is cleared at the start of `onImportListFile` (line 3123), but not when `manageListsDialog` is set to `false`. If the user imports a bad file (error shown), closes the dialog, and reopens it, the previous error message is still visible.

**Fix:** Clear `listImportFileError` when closing the dialog. The close button at line 1145 sets `manageListsDialog = false` — add a close handler or use a `watch`:
```ts
watch(manageListsDialog, (open) => {
  if (!open) {
    listImportFileError.value = null
    manageListsError.value = null
  }
})
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
