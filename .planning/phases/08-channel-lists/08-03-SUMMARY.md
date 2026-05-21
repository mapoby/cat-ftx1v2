---
phase: 08-channel-lists
plan: "03"
subsystem: ui
tags: [vue, dialog, teleport, crud, json, import, export, url-fetch]

requires:
  - phase: 08-01
    provides: useLists composable with createList, renameList, deleteList, fetchRemoteList, exportList, importListFromText
  - phase: 08-02
    provides: allLists destructure, listImport* refs pattern, rsgb-* CSS classes, Teleport dialog insertion point

provides:
  - Manage Lists dialog (Teleport block) in pages/index.vue
  - manageListsDialog ref and toolbar button
  - CRUD handlers: doCreateList, startRename/confirmRename/cancelRename, deleteList binding
  - addListFromUrl handler with loading state and error surface
  - onImportListFile handler with file input reset
  - triggerListImport hidden file input pattern
  - exportList(list) call in dialog table

affects: [pages/index.vue]

tech-stack:
  added: []
  patterns: [teleport-dialog, hidden-file-input-reset, bundled-list-read-only-guard]

key-files:
  created: []
  modified:
    - pages/index.vue

key-decisions:
  - Manage Lists dialog inserted between Import from List and Repeater Info Teleport blocks — preserves existing ordering
  - Bundled list guard applied as v-if="list.source !== 'bundled'" wrapping Rename/Delete buttons — composable provides defense-in-depth
  - listImportFileError reused from Plan 02 context for file import errors within the Manage Lists dialog

patterns-established:
  - "hidden-file-input-reset: listJsonImportRef.value.value = '' after file processing — mirrors csvImportRef pattern"
  - "bundled-list-read-only-guard: v-if source !== bundled in template; composable guards source!=='user' as second layer"

requirements-completed: [LIST-03, LIST-04, LIST-05]

duration: 8min
completed: 2026-05-21
---

# Phase 8 Plan 3: Manage Lists Dialog Summary

**"Manage Lists" Teleport dialog added to pages/index.vue with full CRUD table (rename, delete, export per row), create-list input, remote URL fetch with CORS error surface, and JSON file import — bundled lists displayed read-only.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-21T00:00:00Z
- **Completed:** 2026-05-21T00:08:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- All six useLists functions (createList, renameList, deleteList, fetchRemoteList, exportList, importListFromText) destructured and wired
- Nine new refs declared for Manage Lists dialog state (manageListsDialog, manageListsError, manageListsFetching, addRemoteUrl, newListName, renamingListId, renamingListName, listJsonImportRef, listImportFileError)
- Six handler functions added: triggerListImport, onImportListFile, addListFromUrl, startRename, confirmRename, cancelRename, doCreateList
- "Manage Lists" button and hidden JSON file input added to chlist-toolbar
- Teleport dialog block with CRUD table, create row, URL fetch row, file import button, and close button

## Task Commits

1. **Task 1: Add Manage Lists refs, handlers, and toolbar button** - `70df50f` (feat)
2. **Task 2: Add the Manage Lists dialog template** - `13b7be3` (feat)

## Files Created/Modified

- `pages/index.vue` — useLists destructure extended; 9 new refs; 7 new functions; toolbar button + hidden input; Manage Lists Teleport dialog

## Decisions Made

- Manage Lists dialog inserted between Import from List and Repeater Info Teleport blocks to preserve existing ordering
- Bundled list guard applied as `v-if="list.source !== 'bundled'"` wrapping Rename/Delete buttons; composable provides defense-in-depth as second layer
- `listImportFileError` ref (declared in Task 1) reused for file import errors displayed inside the Manage Lists dialog

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

- **T-08-09** Delete button wrapped in `v-if="list.source !== 'bundled'"` — bundled lists cannot be deleted from UI
- **T-08-10** confirmRename guards `.trim()` before calling renameList — empty rename is a no-op
- **T-08-11** addListFromUrl wraps fetchRemoteList in try/catch; manageListsError displayed to user on failure (CORS message from composable)
- **T-08-12** onImportListFile wraps importListFromText in try/catch; listImportFileError displayed on malformed JSON or validation failure
- **T-08-13** (accept) localStorage quota enforced by saveUserLists try/catch in composable

## Known Stubs

None — all UI controls are wired to live composable functions. allLists is populated at mount from bundled JSON and localStorage.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- pages/index.vue modified: FOUND
- manageListsDialog ref (line 1514): FOUND
- Manage Lists toolbar button (line 556): FOUND
- Manage Lists dialog template (line 1140): FOUND
- bundled list guard v-if source !== 'bundled' (line 1177): FOUND
- exportList(list) @click binding (line 1176): FOUND
- addListFromUrl function and @click binding: FOUND
- doCreateList function and @click binding: FOUND
- Commit 70df50f: FOUND
- Commit 13b7be3: FOUND
- npm run generate: exits 0

---
*Phase: 08-channel-lists*
*Completed: 2026-05-21*
