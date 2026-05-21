---
phase: 08-channel-lists
plan: "01"
subsystem: channel-lists
tags: [composable, localStorage, vitest, tdd, json, presets]
dependency_graph:
  requires: []
  provides: [useLists-composable, bundled-preset-json]
  affects: []
tech_stack:
  added: [jsdom (devDependency for jsdom test environment)]
  patterns: [singleton-composable, validate-before-accept, tdd-red-green]
key_files:
  created:
    - composables/useLists.ts
    - composables/useLists.test.ts
    - public/lists/index.json
    - public/lists/uk-calling.json
    - public/lists/iaru-r1-hf.json
    - public/lists/uk-fm-repeaters-sample.json
  modified:
    - vitest.config.mts
    - package.json
decisions:
  - useLists uses module-level singleton state (mirrors useSerial.ts pattern)
  - validateChannelList is permissive on optional fields, strict on freq range and required string fields
  - jsdom devDependency added to support @vitest-environment jsdom in composables/useLists.test.ts
  - vitest.config.mts extended to include composables/**/*.test.ts alongside test/unit/
  - FT8 entries in iaru-r1-hf.json use mode=USB with descriptive tag (FT8 is not a native FTX-1 mode label)
metrics:
  duration: "4 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_created: 6
  files_modified: 2
---

# Phase 8 Plan 1: useLists Composable + Bundled Presets Summary

**One-liner:** Vue 3 singleton composable providing typed ChannelList/ListEntry state, full CRUD with localStorage persistence via `cat_lists_v1`, remote fetch with CORS error handling, JSON export/import, and three bundled UK/IARU preset files with Vitest test coverage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for useLists | 361a88f | composables/useLists.test.ts, vitest.config.mts |
| 1 (GREEN) | useLists composable implementation | b8998a5 | composables/useLists.ts, package.json |
| 3 | Bundled preset JSON files and manifest | 9aff04c | public/lists/*.json (4 files) |

## What Was Built

- `composables/useLists.ts` — singleton composable exporting `ListEntry`, `ChannelList` interfaces and the `useLists()` function with: `allLists` computed, `initLists()`, `loadUserLists()`, `saveUserLists()`, `createList()`, `renameList()`, `deleteList()`, `addEntry()`, `updateEntry()`, `removeEntry()`, `fetchRemoteList()`, `validateChannelList()`, `exportList()`, `importListFromText()`
- `composables/useLists.test.ts` — 18 Vitest tests across 4 describe blocks (validateChannelList, CRUD, localStorage round-trip, importListFromText)
- `public/lists/index.json` — manifest listing 3 bundled filenames
- `public/lists/uk-calling.json` — 8 UK calling frequencies (bundled-uk-calling-v1)
- `public/lists/iaru-r1-hf.json` — 7 IARU R1 HF activity frequencies (bundled-iaru-r1-hf-v1)
- `public/lists/uk-fm-repeaters-sample.json` — 10 UK FM repeater entries with split/CTCSS (bundled-uk-repeaters-v1)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom not installed**
- **Found during:** Task 1 GREEN phase — vitest reported `Cannot find package 'jsdom'` when running tests with `@vitest-environment jsdom`
- **Fix:** Installed `jsdom` as a devDependency via `npm install --save-dev jsdom`
- **Files modified:** package.json, package-lock.json
- **Commit:** b8998a5

**2. [Rule 3 - Blocking] vitest.config.mts include pattern excluded composables/`
- **Found during:** Task 1 RED phase — vitest config only included `test/unit/**/*.{test,spec}.ts`; the plan specifies the test file at `composables/useLists.test.ts`
- **Fix:** Extended `include` in vitest.config.mts to also include `composables/**/*.test.ts`
- **Files modified:** vitest.config.mts
- **Commit:** 361a88f

**3. [Rule 2 - Plan note] Task 2 content covered in Task 1 TDD cycle**
- Task 2 specifies creating `composables/useLists.test.ts` — this file was written in Task 1's RED phase as required by the TDD flow. All 18 test cases across 4 describe blocks satisfy Task 2's acceptance criteria. No separate commit was needed for Task 2.

## Threat Model Compliance

All mitigations from the STRIDE register are implemented:
- **T-08-01** `validateChannelList` applied after remote fetch — invalid shape throws actionable error
- **T-08-02** `importListFromText` overwrites `source='user'` and `id=crypto.randomUUID()` regardless of file content; `validateChannelList` applied after JSON.parse
- **T-08-03** `loadUserLists` silently discards if not array; each entry filtered through `validateChannelList`
- **T-08-04** (accept) exportList is user-initiated download only
- **T-08-05** (accept) `saveUserLists` wraps `setItem` in try/catch

## Known Stubs

None — this plan creates the data layer only. No UI is wired. The composable is the stable contract for Wave 2 and Wave 3.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns beyond what was planned.

## Self-Check: PASSED

- composables/useLists.ts: FOUND
- composables/useLists.test.ts: FOUND
- public/lists/index.json: FOUND
- public/lists/uk-calling.json: FOUND
- public/lists/iaru-r1-hf.json: FOUND
- public/lists/uk-fm-repeaters-sample.json: FOUND
- Commit 361a88f: FOUND
- Commit b8998a5: FOUND
- Commit 9aff04c: FOUND
- npm test passes: 18/18 tests passing
