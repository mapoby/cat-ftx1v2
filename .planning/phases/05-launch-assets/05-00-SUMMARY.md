---
phase: 05-launch-assets
plan: "00"
subsystem: launch-assets
tags: [youtube, channel-setup, manual, branding]
dependency_graph:
  requires: []
  provides: [youtube-channel-hamtools]
  affects: [05-01-PLAN.md, 05-02-PLAN.md, 05-03-PLAN.md]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified: []
decisions: []
metrics:
  duration: "0m (checkpoint — awaiting human action)"
  completed_date: ""
---

# Phase 5 Plan 00: Create YouTube Channel — Summary

**One-liner:** Manual prerequisite — create and brand the YouTube `hamtools` channel before demo video upload.

## Status

CHECKPOINT REACHED — awaiting human action. No code changes in this plan.

## Tasks

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Create YouTube channel and configure branding | Awaiting human action | — |

## What Is Needed

The user must manually create the YouTube channel via browser at https://studio.youtube.com. Full instructions are in the plan at `.planning/phases/05-launch-assets/05-00-PLAN.md`.

**Channel spec:**
- Channel name: `hamtools`
- Handle: `@hamtools` (fallback `@hamtools-cc`)
- Description: "Open-source browser tools for amateur radio operators. Built by 2E0MIK.\nhamtools.cc"
- Category: Science & Technology
- Language: English (UK)
- Profile icon: stylized "HT" monogram or antenna icon, dark background (#0d1117)
- Banner: dark (#0d1117) with `hamtools.cc` wordmark in white, 2560x1440px
- Default upload settings: category Science & Technology, tags `ham radio` `amateur radio` `CAT control` `yaesu`, license Creative Commons Attribution
- Playlist: `CAT FTX-1 Controller` (public, empty initially)

**Acceptance criteria:**
- Channel publicly accessible at youtube.com/@hamtools or youtube.com/@hamtools-cc
- Description contains "Open-source browser tools for amateur radio operators"
- Profile icon set (not default letter avatar)
- Banner image set (not blank)
- Playlist "CAT FTX-1 Controller" exists
- Default upload category is "Science & Technology"
- Default license is "Creative Commons Attribution"

**Resume signal:** Paste the channel URL (e.g., youtube.com/@hamtools) to confirm completion.

## Deviations from Plan

None — plan executed exactly as written. This plan is entirely a human-action checkpoint with no automatable steps.

## Self-Check: PASSED

No files were created or commits made (expected — this is a human-action checkpoint with no code changes).
