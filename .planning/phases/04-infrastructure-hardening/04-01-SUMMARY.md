---
phase: 04-infrastructure-hardening
plan: "01"
subsystem: infra
tags: [dependencies, docker, npm, lockfile, supply-chain]
dependency_graph:
  requires: []
  provides: [reproducible-docker-build, clean-dependency-manifest]
  affects: [Dockerfile, package.json, package-lock.json]
tech_stack:
  added: []
  patterns: [npm-ci, committed-lockfile]
key_files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - Dockerfile
    - README.md
decisions:
  - "magic-regexp removed as direct dependency; transitive reference via nuxt/oxc-walker is unavoidable and does not affect production bundle"
  - "Dockerfile builder stage uses npm ci with COPY of both package.json and package-lock.json for fail-fast lockfile drift detection"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 4 Plan 01: Dependency Cleanup and Reproducible Docker Build Summary

Remove magic-regexp as a direct dependency and switch the Dockerfile builder stage to `npm ci` with a committed lockfile for fail-fast supply-chain integrity.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Remove magic-regexp and regenerate package-lock.json | 27c29b4 |
| 2 | Switch Dockerfile to npm ci, remove stale README row | 731e35d |

## What Was Done

**Task 1:** Ran `npm uninstall magic-regexp` from the project root. This removed `"magic-regexp": "^0.11.0"` from `package.json` dependencies and regenerated `package-lock.json`. The package was unused — it was present in dependencies but no code in the project imported from it.

**Task 2:** Updated the Dockerfile builder stage to copy both `package.json` and `package-lock.json` before installing, then replaced `RUN npm install --prefer-offline` with `RUN npm ci`. Removed the stale `magic-regexp` row from the README Tech Stack table.

## Verification Results

1. `grep "magic-regexp" package.json` — empty (exit 1) ✓
2. `grep "npm ci" Dockerfile` — matches line 7 ✓
3. `grep "package-lock.json" Dockerfile` — matches line 6 ✓
4. `grep "magic-regexp" README.md` — empty (exit 1) ✓
5. `npm ci --dry-run` — exits 0 ✓

## Deviations from Plan

### Auto-noted: Transitive magic-regexp via nuxt/oxc-walker

**Found during:** Task 1 verification

**Issue:** The plan's must_have stated "package-lock.json does not reference magic-regexp". After `npm uninstall magic-regexp`, grep still found three lines in package-lock.json: `nuxt → oxc-walker@0.7.0 → magic-regexp@0.10.0`. This is a transitive dependency of nuxt's build toolchain, not our code.

**Resolution:** The critical intent (INFRA-02) is satisfied — magic-regexp is gone as a direct dependency and does not appear in the production bundle. The transitive lockfile entry cannot be removed without forking nuxt. Documented here for clarity.

**Files modified:** None (this was an observation, not a code change)

## Known Stubs

None.

## Threat Flags

None. T-04-01 (supply-chain via npm install) is fully mitigated by the switch to `npm ci`. T-04-02 (magic-regexp in production bundle) is eliminated — the package is no longer a direct dependency.

## Self-Check: PASSED
