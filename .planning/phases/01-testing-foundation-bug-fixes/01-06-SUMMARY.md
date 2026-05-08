---
phase: 01-testing-foundation-bug-fixes
plan: "06"
subsystem: ci
tags: [ci, github-actions, test-gate, coverage, npm-ci]
dependency_graph:
  requires: [01-03]
  provides: [TEST-04, TEST-05]
  affects: [.github/workflows/azure-deploy.yml]
tech_stack:
  added: [actions/setup-node@v4, actions/upload-artifact@v4]
  patterns: [test-gate-before-build, lockfile-pinned-install]
key_files:
  created: []
  modified:
    - .github/workflows/azure-deploy.yml
decisions:
  - npm ci used (not npm install) — installs exact lockfile versions, satisfying T-01-06 supply chain threat
  - node-version 22 matches node:22-alpine Dockerfile base image
  - if-no-files-found: warn — coverage upload does not fail CI when coverage/ is absent
  - Upload artifact name includes github.sha for per-run traceability
metrics:
  duration: "5 minutes"
  completed: "2026-05-08"
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 1
---

# Phase 1 Plan 06: CI Test Gate Summary

Node.js test gate inserted into azure-deploy.yml — `npm test` (vitest run) must pass before any Docker build executes; coverage artifact uploaded as `coverage-{sha}` on every CI run.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Insert test gate steps into azure-deploy.yml | b91b490 | .github/workflows/azure-deploy.yml (modified) |

## What Was Built

Four steps inserted after Checkout and before Azure Login in `.github/workflows/azure-deploy.yml`:

1. **Set up Node.js** — `actions/setup-node@v4`, node 22, npm cache enabled
2. **Install dependencies** — `npm ci` (lockfile-pinned; T-01-06 supply chain mitigation)
3. **Run tests** — `npm test` runs `vitest run`; non-zero exit halts entire job before Docker build
4. **Upload coverage** — `actions/upload-artifact@v4`, artifact named `coverage-{sha}`, `if-no-files-found: warn`

Step ordering: Run tests (line 35) precedes Build and push Docker image (line 58) — verified via grep.

## Deviations from Plan

None — plan executed exactly as written. package-lock.json was already committed (confirmed before task execution).

## Known Stubs

None — CI pipeline only; no UI or data-path changes.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. T-01-06 supply chain threat mitigated via `npm ci`.

## Self-Check: PASSED

- .github/workflows/azure-deploy.yml: FOUND
- Commit b91b490: FOUND
- `Run tests` step present at line 35: CONFIRMED
- `Build and push Docker image` step at line 58 (after Run tests): CONFIRMED
- `actions/setup-node@v4` present: CONFIRMED
- `actions/upload-artifact@v4` present: CONFIRMED
- `if-no-files-found: warn` present: CONFIRMED
- `coverage-${{ github.sha }}` artifact name present: CONFIRMED
- package-lock.json exists in repo root: CONFIRMED
