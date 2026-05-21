---
status: partial
phase: 08-channel-lists
source: [08-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Import from List dialog end-to-end
expected: Clicking "+ Add from List" opens dialog; selecting a bundled list populates the entry table; selecting entries and clicking "Add N channels" inserts rows into the channel list table with dirty=true
result: [pending]

### 2. Remote URL fetch — success and CORS error
expected: A valid remote URL returns a parsed ChannelList that appears in the Manage Lists dialog; an invalid URL or CORS-blocked URL shows an actionable error message containing "cross-origin"
result: [pending]

### 3. JSON export + re-import round-trip
expected: Exporting any list downloads a .json file; importing that file via "Import from .json file" creates a new user list with source='user' and a new UUID id; the entries are identical
result: [pending]

### 4. Bundled list read-only in Manage Lists dialog
expected: Bundled lists (uk-calling, iaru-r1-hf, uk-fm-repeaters-sample) show only "Export" in their Actions column — no Rename or Delete buttons visible
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
