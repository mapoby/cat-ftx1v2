---
phase: 03-data-integrity-memory-operations
plan: "03"
subsystem: pages/index.vue
tags: [csv-import, validation, modal, data-integrity]
dependency_graph:
  requires: [03-02]
  provides: [DATA-01]
  affects: [pages/index.vue]
tech_stack:
  added: []
  patterns: [two-pass validate-then-confirm, Vue 3 Teleport modal, ref auto-unwrap in template]
key_files:
  modified:
    - pages/index.vue
decisions:
  - validateCsvRow placed immediately before onImportCsv — keeps validation and usage co-located
  - Template uses Vue 3 ref auto-unwrap (no .value in @click handlers)
  - Modal reuses existing wipe-confirm-modal/wipe-confirm-body/wipe-confirm-actions CSS classes
metrics:
  duration: "~20 min"
  completed: "2026-05-09"
---

# Phase 3 Plan 03: CSV Import Validation Summary

Two-pass CSV import validation with per-row error modal: validateCsvRow() rejects invalid slot/freq/mode/tag before any data is written; partially valid files offer "Import Valid Rows Only"; fully invalid files write nothing.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | validateCsvRow + restructured onImportCsv | 483e564 | pages/index.vue |
| 2 | CSV validation error modal | 2663922 | pages/index.vue |

## What Was Built

**Task 1** (483e564 — completed in prior session):
- `validateCsvRow(p, rowNum)` pure function: rejects slot 0 / > 999, freq < 100 kHz / > 470 MHz, unknown mode codes, tags > 12 chars or with non-printable ASCII
- Three new refs: `csvValidationErrors`, `csvPendingRows`, `csvConfirmDialog`
- `onImportCsv` restructured to two-pass: validate-all first, then either apply immediately (no errors) or populate refs and show modal

**Task 2** (2663922):
- `<Teleport to="body">` modal rendered when `csvConfirmDialog` is true
- Scrollable per-row error list (max 200px) listing row number and reason
- "Fix CSV" button: closes modal, clears pending state, no data written
- "Import Valid Rows Only" button: conditionally shown (hidden when all rows invalid), applies `csvPendingRows` sorted by slot to `channelListRows`
- "All rows failed" message shown when no valid rows remain
- CSS: `.csv-error-list`, `.csv-error-item`, `.csv-error-all-invalid`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

All mitigations from the plan's STRIDE register were implemented in Task 1:

| Threat | Mitigation |
|--------|-----------|
| T-03-07 slot tampering | validateCsvRow rejects slot 0 and > 999 |
| T-03-08 freq tampering | validateCsvRow rejects < 100 kHz or > 470 MHz |
| T-03-09 mode tampering | validateCsvRow rejects codes not in MODES label set |
| T-03-10 tag tampering | validateCsvRow rejects > 12 chars or non-printable ASCII |
| T-03-11 info disclosure | accepted — user-supplied data echoed back, no PII/secrets |

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- pages/index.vue exists and modified
- Commit 483e564 exists: `git log --oneline --all | grep 483e564` → found
- Commit 2663922 exists: `git log --oneline --all | grep 2663922` → found
- `npm run generate` exits 0
- `grep -c "csvConfirmDialog" pages/index.vue` → 5
- `grep -c "csv-error-list" pages/index.vue` → 2
- `grep -c "Import Valid Rows Only" pages/index.vue` → 1
- `grep -c "Fix CSV" pages/index.vue` → 1
