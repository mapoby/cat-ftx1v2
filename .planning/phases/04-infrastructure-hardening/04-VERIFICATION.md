---
phase: 04-infrastructure-hardening
verified: 2026-05-09T12:00:00Z
status: human_needed
score: 3/4 roadmap success criteria verified (SC2 partial — see note)
overrides_applied: 0
human_verification:
  - test: "Confirm RBAC Administrator role was granted to the GitHub Actions SP before Bicep redeploy"
    expected: "az role assignment list for catftx1web-github-sp shows both Contributor and Role Based Access Control Administrator on ev-catftx1web-rg"
    why_human: "This is an Azure Portal/CLI action outside the codebase; cannot be verified programmatically from the repo"
  - test: "Confirm DOCKERHUB_USERNAME and DOCKERHUB_TOKEN secrets exist in GitHub repo settings"
    expected: "GitHub repo Settings → Secrets and variables → Actions shows both secrets present"
    why_human: "GitHub secrets are not readable from the codebase; must be verified in GitHub UI"
  - test: "Trigger a push to main and verify the CI workflow pushes to both ACR and DockerHub successfully"
    expected: "azure-deploy.yml run completes with no failure on the 'Log in to Docker Hub' or 'Build and push Docker image' steps; DockerHub shows mapoby/cat-ftx1:latest updated"
    why_human: "Cannot execute a GitHub Actions run from a static codebase check; requires an actual push and CI observation"
gaps: []
---

# Phase 4: Infrastructure Hardening Verification Report

**Phase Goal:** The build is fully reproducible, the container is secured with a Content Security Policy, and ACR pulls via managed identity rather than admin credentials
**Verified:** 2026-05-09T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `docker build` runs `npm ci` against a committed lockfile; build fails if lockfile absent or inconsistent | VERIFIED | Dockerfile line 6: `COPY package.json package-lock.json ./`; line 7: `RUN npm ci`. package-lock.json present in repo. |
| 2 | `magic-regexp` is absent from `package.json` and `package-lock.json` | PARTIAL | Absent from `package.json` direct deps (confirmed). Still present in `package-lock.json` at lines 7554/7569 as transitive dep via `nuxt → oxc-walker@0.7.0 → magic-regexp@0.10.0`. Unremovable without forking nuxt. Documented deviation. |
| 3 | Every response from the nginx server includes a `Content-Security-Policy` header covering `default-src`, `script-src`, and `connect-src` | VERIFIED | CSP in server block (nginx.conf line 11) and repeated in static assets location block (line 27) per CR fix commit 9a6a015. All three directives present. All responses covered. |
| 4 | App Service pulls images from ACR using managed identity; `adminUserEnabled` is false; no admin credential app settings exist | VERIFIED | main.bicep: `adminUserEnabled: false` (line 23); `identity: { type: 'SystemAssigned' }` (lines 44-46); `acrPullAssignment` role resource (lines 69-80); `webappConfig` with `acrUseManagedIdentityCreds: true` (lines 84-90); no `listCredentials()` call; no `DOCKER_REGISTRY_SERVER_*` app settings. |

**Score:** 3.5/4 roadmap success criteria (SC2 partial due to unremovable transitive dependency)

---

### SC2 Deviation: magic-regexp Transitive Reference

**Situation:** ROADMAP SC2 states "magic-regexp is absent from package.json and package-lock.json." magic-regexp is fully removed as a direct dependency (package.json clean). However, package-lock.json still contains 3 lines referencing `magic-regexp@0.10.0` as a transitive dependency pulled by `nuxt → oxc-walker@0.7.0`.

**Assessment:** This is not actionable. The transitive reference cannot be removed without forking nuxt. The package does not appear in the production bundle — it is only in nuxt's build toolchain. The functional intent of INFRA-02 (remove magic-regexp as a dependency of this application) is satisfied.

**Classification:** WARNING, not BLOCKER. The letter of SC2 is not fully met; the spirit is met.

---

### Plan 04 Must-Haves (Documentation + setup.sh)

These were additional must-haves from Plan 04 frontmatter (no separate INFRA-xx requirement IDs; implements D-15, D-16, D-17).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | README.md has a "Run locally with Docker" section using mapoby/cat-ftx1:latest | VERIFIED | README.md lines 70-78: DockerHub pull section with `docker pull mapoby/cat-ftx1:latest` and `docker run` command |
| 2 | README.md has a "Self-hosted on Azure" section documenting infra/setup.sh prerequisites and GitHub secrets | VERIFIED | README.md lines 113-153: full section with prerequisites, `bash infra/setup.sh`, and secrets/variables table |
| 3 | README.md notes Chrome or Edge required for Web Serial API on localhost | VERIFIED | README.md line 78: "Web Serial API requires Chrome or Edge..." callout |
| 4 | infra/setup.sh has a DEFAULT_* variable block at the top | VERIFIED | setup.sh lines 13-16: `DEFAULT_APP_NAME`, `DEFAULT_LOCATION`, `DEFAULT_GITHUB_REPO`, `DEFAULT_SKU` |
| 5 | infra/setup.sh prompts "Use default values? [y/N]" on start | VERIFIED | setup.sh line 24: `echo "Use default values? [y/N]"` |
| 6 | infra/setup.sh interactive mode prompts each parameter with default shown in brackets | VERIFIED | setup.sh lines 34-44: `read -rp "App name [$DEFAULT_APP_NAME]:"` and equivalent for all 4 params |
| 7 | infra/setup.sh documents DOCKERHUB_USERNAME and DOCKERHUB_TOKEN as required GitHub secrets | VERIFIED | setup.sh lines 150-151: both secrets listed in the `[5/5] Done` output block |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | No magic-regexp entry | VERIFIED | grep returns empty; only `nuxt` in dependencies |
| `package-lock.json` | Committed lockfile without magic-regexp as direct dep | PARTIAL | File present; magic-regexp exists only as transitive dep via oxc-walker (unremovable) |
| `Dockerfile` | Uses `COPY package.json package-lock.json ./` and `npm ci` | VERIFIED | Line 6: COPY both files; line 7: `RUN npm ci`; no `npm install` line |
| `nginx.conf` | CSP header in server block | VERIFIED | Line 11: CSP in server block; line 27: also in static assets location block (correct per nginx inheritance rules) |
| `infra/main.bicep` | SystemAssigned identity, AcrPull role, no admin creds | VERIFIED | All 5 required changes present; outputs section intact |
| `.github/workflows/azure-deploy.yml` | DockerHub login step + mapoby/cat-ftx1 tags | VERIFIED | "Log in to Docker Hub" step at line 59; tags at lines 77-78 |
| `README.md` | Local Docker and Self-hosted Azure sections | VERIFIED | Both sections present with correct content |
| `infra/setup.sh` | DEFAULT_* block + interactive mode | VERIFIED | All required additions present; `bash -n` syntax check passes |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Dockerfile` | `package-lock.json` | `COPY package.json package-lock.json ./` then `npm ci` | VERIFIED | Line 6 COPY, line 7 npm ci |
| `nginx.conf server block` | all HTTP responses | `add_header Content-Security-Policy` | VERIFIED | Line 11 server block; CR fix also added to location block so static assets covered |
| `infra/main.bicep webapp` | `acrPullAssignment` roleAssignment | `webapp.identity.principalId` | VERIFIED | Line 77: `principalId: webapp.identity.principalId` |
| `.github/workflows/azure-deploy.yml build-push step` | DockerHub registry | `mapoby/cat-ftx1` tags in build-push-action | VERIFIED | Lines 77-78 in tags block; preceded by DockerHub login step |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase contains no components that render dynamic data. All deliverables are build/infra configuration files.

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Dockerfile uses npm ci | `grep "npm ci" Dockerfile` | Match on line 7 | PASS |
| Dockerfile copies lockfile | `grep "package-lock.json" Dockerfile` | Match on line 6 | PASS |
| nginx.conf has CSP | `grep -c "Content-Security-Policy" nginx.conf` | 2 (server block + location block) | PASS |
| No magic-regexp in package.json | `grep magic-regexp package.json` | Empty | PASS |
| main.bicep: adminUserEnabled false | `grep "adminUserEnabled: false" main.bicep` | Match | PASS |
| main.bicep: SystemAssigned | `grep "SystemAssigned" main.bicep` | Match | PASS |
| main.bicep: acrUseManagedIdentityCreds | `grep "acrUseManagedIdentityCreds" main.bicep` | Match | PASS |
| main.bicep: no listCredentials | `grep "listCredentials" main.bicep` | Empty | PASS |
| main.bicep: no DOCKER_REGISTRY_SERVER_PASSWORD | `grep "DOCKER_REGISTRY_SERVER_PASSWORD" main.bicep` | Empty | PASS |
| workflow: DockerHub login step | `grep "Log in to Docker Hub" azure-deploy.yml` | Match | PASS |
| workflow: mapoby/cat-ftx1 tags | `grep "mapoby/cat-ftx1" azure-deploy.yml` | 2 matches (sha + latest) | PASS |
| setup.sh syntax | `bash -n infra/setup.sh` | Exit 0 | PASS |
| setup.sh has DEFAULT_APP_NAME | `grep "DEFAULT_APP_NAME" infra/setup.sh` | Match | PASS |
| setup.sh has use-defaults prompt | `grep "Use default values" infra/setup.sh` | Match | PASS |
| README has mapoby/cat-ftx1:latest | `grep "mapoby/cat-ftx1:latest" README.md` | 2 matches | PASS |
| README has Self-hosted on Azure | `grep "Self-hosted on Azure" README.md` | Match | PASS |
| README has Chrome or Edge note | `grep "Chrome or Edge" README.md` | Match | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | 04-01-PLAN.md | `package-lock.json` committed; Dockerfile uses `npm ci` | SATISFIED | Dockerfile lines 6-7; lockfile present in repo |
| INFRA-02 | 04-01-PLAN.md | `magic-regexp` removed from `package.json` | SATISFIED (direct dep) / PARTIAL (lockfile) | Removed as direct dep; transitive ref via oxc-walker remains in lockfile but is unremovable |
| INFRA-03 | 04-02-PLAN.md | nginx CSP header covering default-src, script-src, connect-src | SATISFIED | nginx.conf line 11 (server block) + line 27 (location block) |
| INFRA-04 | 04-03-PLAN.md | ACR managed identity; adminUserEnabled false; no admin credential app settings | SATISFIED | main.bicep fully rewritten with all required changes |

**Orphaned requirements check:** REQUIREMENTS.md maps INFRA-01 through INFRA-04 to Phase 4. All four are claimed by plans in this phase. No orphaned requirements.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `nginx.conf` line 27 | CSP repeated in location block — diverges from plan's "exactly one" success criterion | Info | Intentional and correct: nginx does not inherit server-block add_header directives in location blocks that define their own add_header. CR fix commit 9a6a015 added the repetition. Net effect is strictly better — static assets now also have CSP headers. |

No stubs, no hardcoded empty returns, no TODO/FIXME markers found in the modified files.

---

### Human Verification Required

#### 1. Azure RBAC Role Assignment

**Test:** Run `az role assignment list --assignee <APP_ID> --scope /subscriptions/<SUB>/resourceGroups/ev-catftx1web-rg --query "[].roleDefinitionName" -o tsv` where APP_ID is the `catftx1web-github-sp` application ID
**Expected:** Output includes both "Contributor" and "Role Based Access Control Administrator"
**Why human:** Azure RBAC state is not readable from the git repository; requires Azure CLI authenticated as the subscription owner

#### 2. GitHub DockerHub Secrets

**Test:** Navigate to GitHub repo → Settings → Secrets and variables → Actions
**Expected:** `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` both appear as repository secrets
**Why human:** GitHub encrypted secrets are not readable from the codebase or via unauthenticated API

#### 3. CI/CD End-to-End

**Test:** Push to main (or trigger workflow_dispatch) and observe the run
**Expected:** "Log in to Docker Hub" step succeeds; "Build and push Docker image" step pushes to both `catftx1webacr.azurecr.io/cat-ftx1:sha` and `mapoby/cat-ftx1:sha`; "Deploy to Azure Web App" step completes; app remains accessible at `catftx1web-app.azurewebsites.net`
**Why human:** Cannot execute a GitHub Actions workflow from a static codebase check; requires an actual trigger and CI observation

---

### Gaps Summary

No blocking gaps. The only deviation is the transitive magic-regexp reference in package-lock.json — this is architecturally expected (nuxt's build toolchain pulls it), documented in the SUMMARY, and not removable without forking nuxt. The functional requirement (magic-regexp is not a dependency of this application) is met.

The three human verification items above relate to runtime/deployment state that cannot be verified from the codebase. All code changes for Plans 01-04 are present, substantive, and correctly wired.

---

_Verified: 2026-05-09T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
