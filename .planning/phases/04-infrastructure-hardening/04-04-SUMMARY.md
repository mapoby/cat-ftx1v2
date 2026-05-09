---
phase: 04-infrastructure-hardening
plan: "04"
subsystem: docs-infra
tags: [readme, documentation, setup-sh, dockerhub, interactive]
dependency_graph:
  requires:
    - 04-01
    - 04-02
    - 04-03
  provides: [local-docker-docs, self-hosted-azure-docs, setup-sh-interactive-mode]
  affects: [README.md, infra/setup.sh]
tech_stack:
  added: []
  patterns:
    - "DEFAULT_* block + USE_DEFAULTS toggle for interactive/non-interactive shell scripts"
key_files:
  created: []
  modified:
    - README.md
    - infra/setup.sh
decisions:
  - "DockerHub pull instructions added alongside build-from-source to cover both audiences (fork contributors and end-users)"
  - "Self-hosted Azure section placed after One-time Azure Setup to preserve logical flow from existing to new"
  - "setup.sh non-interactive path triggered by all three core env vars being pre-set, preserving backward compat with existing APP_NAME=... invocations"
  - "sku parameter threaded through to Bicep deploy command so setup.sh and main.bicep are consistent on SKU"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 4 Plan 04: Documentation and setup.sh Interactive Mode Summary

README.md updated with local Docker (DockerHub pull) and Self-hosted Azure sections; infra/setup.sh upgraded with DEFAULT_* block and interactive/non-interactive mode toggle.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add local Docker pull and self-hosted Azure sections to README.md | 60ebe33 | README.md |
| 2 | Add interactive/non-interactive mode to infra/setup.sh | 6f74edc | infra/setup.sh |

## What Was Done

**Task 1:** Added two blocks to README.md:

1. Expanded the existing "Run with Docker locally" block into two subsections — build-from-source and pull-from-DockerHub (`mapoby/cat-ftx1:latest`). Added a callout noting Chrome or Edge is required for Web Serial API and that `localhost` satisfies the HTTPS requirement.

2. Added a "Self-hosted on Azure" section after the existing "One-time Azure Setup" section. The new section covers prerequisites (Azure CLI, Docker, GitHub fork), the `bash infra/setup.sh` invocation, a numbered list of what the script creates, and a full table of GitHub Actions secrets and variables including `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.

**Task 2:** Modified infra/setup.sh in four places:

1. Replaced the three-line variable block (`APP_NAME=`, `LOCATION=`, `GITHUB_REPO=`) with a `DEFAULT_*` block followed by the interactive/non-interactive mode toggle. If all three core env vars are pre-set at invocation time, the script skips the prompt (preserving backward compatibility with `APP_NAME=catftx1web ... bash infra/setup.sh` usage). Otherwise the script asks "Use default values? [y/N]" — `y` applies all defaults, `n` prompts each parameter individually with its default shown in brackets.

2. Added `DEFAULT_SKU="B1"` and threaded `SKU` through the interactive path.

3. Updated the `az deployment group create` call to pass `sku="$SKU"` alongside `appName="$APP_NAME"`.

4. Added `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` lines to the `[5/5] Done` output block, between `AZURE_SUBSCRIPTION_ID` and the VARIABLES section.

## Verification Results

1. `grep "mapoby/cat-ftx1:latest" README.md` — 2 matches (pull command + run command) ✓
2. `grep "Self-hosted on Azure" README.md` — 1 match ✓
3. `grep "DOCKERHUB_USERNAME" README.md` — 1 match ✓
4. `grep "Chrome or Edge" README.md` — 1 match ✓
5. `grep "DEFAULT_APP_NAME" infra/setup.sh` — 4 matches ✓
6. `grep "USE_DEFAULTS\|_USE_DEFAULTS" infra/setup.sh` — 3 matches ✓
7. `grep "DOCKERHUB" infra/setup.sh` — 2 matches ✓
8. `bash -n infra/setup.sh` — exits 0 ✓

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. T-04-08 (DockerHub token in GitHub secrets) and T-04-09 (setup.sh interactive input) are both accepted-risk items documented in the plan threat model. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED
