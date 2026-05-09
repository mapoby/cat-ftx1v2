---
phase: 04-infrastructure-hardening
plan: 03
subsystem: infra
tags: [azure, bicep, managed-identity, acr, dockerhub, github-actions]

# Dependency graph
requires:
  - phase: 04-infrastructure-hardening
    provides: CI/CD pipeline and Azure infra Bicep templates from earlier plans
provides:
  - ACR admin credentials replaced with system-assigned managed identity and AcrPull role assignment
  - DockerHub push step added to CI workflow for community distribution
affects: [04-infrastructure-hardening, deployment, azure]

# Tech tracking
tech-stack:
  added: [docker/login-action@v4]
  patterns:
    - "Managed identity for ACR pull — no stored credentials in App Service config"
    - "Single docker build-push-action step pushing to multiple registries simultaneously"

key-files:
  created: []
  modified:
    - infra/main.bicep
    - .github/workflows/azure-deploy.yml

key-decisions:
  - "Used guid(acr.id, webapp.id, acrPullRoleId) for deterministic idempotent role assignment name"
  - "acrUseManagedIdentityCreds set via separate webappConfig child resource to ensure role is assigned before config applies"
  - "DockerHub tags added inside existing build-push-action step so image is built once and pushed to both registries"

patterns-established:
  - "Managed identity pattern: SystemAssigned identity + scoped role assignment + acrUseManagedIdentityCreds: true"

requirements-completed: [INFRA-04]

# Metrics
duration: 15min
completed: 2026-05-09
---

# Phase 4 Plan 03: Managed Identity for ACR + DockerHub Push Summary

**ACR admin credentials replaced with system-assigned managed identity and AcrPull role; CI workflow now dual-pushes to ACR and DockerHub**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-09T00:00:00Z
- **Completed:** 2026-05-09T00:15:00Z
- **Tasks:** 3 (Task 1 was a human-action checkpoint; Tasks 2-3 executed here)
- **Files modified:** 2

## Accomplishments

- Removed ACR admin user and `listCredentials()` from Bicep; App Service now pulls images via system-assigned managed identity with least-privilege AcrPull role
- Added deterministic `guid()`-named role assignment resource scoped to ACR, preventing duplicate assignments on redeploy
- Added `docker/login-action@v4` DockerHub login step and `mapoby/cat-ftx1:sha` + `mapoby/cat-ftx1:latest` tags to CI workflow using a single build-push

## Task Commits

Each task was committed atomically:

1. **Task 1: Grant RBAC Administrator role to GitHub Actions SP** - human-action checkpoint (no commit — user action)
2. **Task 2: Rewrite main.bicep with managed identity** - `cf24d00` (feat)
3. **Task 3: Add DockerHub login and push tags to azure-deploy.yml** - `89eb4e8` (feat)

## Files Created/Modified

- `infra/main.bicep` - Removed admin credentials; added SystemAssigned identity, AcrPull roleAssignment, webappConfig with acrUseManagedIdentityCreds
- `.github/workflows/azure-deploy.yml` - Added DockerHub login step; added mapoby/cat-ftx1 tags to build-push step

## Decisions Made

- `guid(acr.id, webapp.id, acrPullRoleId)` generates a deterministic GUID — Bicep redeployments are idempotent and will not create duplicate role assignments
- `webappConfig` declared as a separate child resource (not inline siteConfig) so Bicep can sequence it after the role assignment is established, minimising the credential-gap window
- DockerHub tags added to the existing `docker/build-push-action` step rather than a separate step — single build, multiple push targets per D-12

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Task 1 (human-action checkpoint) required:
- Azure Portal: Grant "Role Based Access Control Administrator" to the GitHub Actions SP (`catftx1web-github-sp` / object-id `304a733a-24a3-4a99-8de0-8f3d913c1905`) on resource group `ev-catftx1web-rg`
- GitHub repo secrets: `DOCKERHUB_USERNAME` (mapoby) and `DOCKERHUB_TOKEN` added

Both confirmed granted before Tasks 2 and 3 executed.

## Threat Surface Scan

T-04-05 (Information Disclosure — ACR admin credentials): mitigated. `adminUserEnabled: false` and no `listCredentials()` in Bicep. Credentials no longer exist.
T-04-07 (Elevation of Privilege — roleAssignment requires RBAC Admin): mitigated by Task 1 checkpoint granting the SP the required permission before Bicep redeploy.
T-04-06 (Tampering — DockerHub :latest mutable): accepted per plan. SHA-tagged image continues to be used for App Service deploy.

## Next Phase Readiness

- Bicep is ready to redeploy: `az deployment group create --resource-group ev-catftx1web-rg --template-file infra/main.bicep --parameters appName=catftx1web`
- After deploy, allow 2-5 minutes for RBAC propagation before triggering a container restart
- CI/CD will push to both ACR and DockerHub on next push to main

---
*Phase: 04-infrastructure-hardening*
*Completed: 2026-05-09*
