---
phase: 04-infrastructure-hardening
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - package.json
  - Dockerfile
  - nginx.conf
  - infra/main.bicep
  - .github/workflows/azure-deploy.yml
  - README.md
  - infra/setup.sh
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the full infrastructure layer: Dockerfile, nginx config, Bicep IaC, GitHub Actions workflow, and the one-time provisioning shell script. The static site serving and container build are structurally sound. Two blockers were found: a well-known nginx `add_header` inheritance bug that strips all security headers from static asset and health responses, and a `set -euo pipefail` misplacement in setup.sh that leaves the most error-prone section of the script running without error guards. Five warnings cover hardcoded infrastructure identity in the workflow, a Bicep image tag that causes deploy rollbacks on infra re-runs, duplicate OIDC credentials, unsafe error suppression, and non-pinned action versions.

---

## Critical Issues

### CR-01: Security headers absent on all static asset responses (nginx `add_header` inheritance)

**File:** `nginx.conf:19-22`
**Issue:** nginx's `add_header` directive does not inherit from parent blocks when a child `location` block defines its own `add_header`. The `location ~* \.(js|css|...)` block at line 19 defines `add_header Cache-Control "public, immutable"`, which completely suppresses the four security headers declared at the server level (lines 8-11). The same applies to the `/health` location (line 33). Every JS, CSS, font, and image response — the overwhelming majority of requests — is served without `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Content-Security-Policy`. This is a documented nginx behavior that defeats the entire security header configuration.

**Fix:** Add the security headers explicitly inside each location block, or use the `headers_more` module. The simplest correct pattern is to duplicate the headers:

```nginx
location ~* \.(js|css|woff2?|svg|ico|png|jpg|webp)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.rsgb.online https://*.ukrepeater.net";
}

location = /health {
    access_log off;
    return 200 "ok\n";
    add_header Content-Type text/plain;
    add_header X-Content-Type-Options "nosniff";
}
```

---

### CR-02: `set -euo pipefail` placed after interactive input — error guard missing for critical section

**File:** `infra/setup.sh:47`
**Issue:** `set -euo pipefail` is declared on line 47, after 46 lines of variable assignments and interactive `read` prompts. The code in lines 19-45 (the entire interactive/non-interactive branching block) runs without any error protection. If `read` times out, if variable substitutions fail, or if any subshell command used for defaulting fails silently, the script continues with potentially empty or wrong values. Most critically, `APP_NAME` could arrive empty, causing `RG="${RG:-${APP_NAME}-rg}"` on line 49 to produce the value `-rg` — an invalid Azure resource group name — which then causes all subsequent `az` commands to fail with confusing errors rather than a clear validation message.

**Fix:** Move `set -euo pipefail` to line 1 (immediately after the shebang), and add explicit validation before proceeding:

```bash
#!/usr/bin/env bash
set -euo pipefail

# ... variable setup ...

# After all variable resolution:
if [[ -z "${APP_NAME:-}" ]]; then
  echo "ERROR: APP_NAME must not be empty" >&2
  exit 1
fi
```

---

## Warnings

### WR-01: Bicep `linuxFxVersion` hardcoded to `:latest` — infra re-apply causes image rollback

**File:** `infra/main.bicep:51`
**Issue:** The web app's `linuxFxVersion` property is set to `'DOCKER|${acr.properties.loginServer}/${appName}:latest'`. The CI/CD pipeline correctly deploys the immutable `:sha`-tagged image (line 85 of the workflow), but if `az deployment group create` is re-run against the Bicep template at any future point (e.g., to change SKU or add a new resource), Azure will reset `linuxFxVersion` back to `:latest`. This effectively rolls back to whichever image is currently tagged latest, breaking the immutable-deploy guarantee.

**Fix:** Remove `linuxFxVersion` from the Bicep template and set it only via the deployment step in CI/CD. Alternatively, accept it as an `appImageTag` parameter with a default:

```bicep
@description('Docker image tag to deploy. Defaults to latest; overridden by CI/CD.')
param appImageTag string = 'latest'

// ...
linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${appName}:${appImageTag}'
```

Then pass `--parameters appImageTag=$GITHUB_SHA` in any re-deploy step.

---

### WR-02: Hardcoded DockerHub username in workflow tags

**File:** `.github/workflows/azure-deploy.yml:77-78`
**Issue:** The `tags` field includes `mapoby/cat-ftx1:${{ github.sha }}` and `mapoby/cat-ftx1:latest` with the personal DockerHub username `mapoby` hardcoded. This means any fork that follows the README setup instructions will push images to the original maintainer's DockerHub account (if they have the secrets) or fail with a permission error. It also couples the workflow to a specific account identity.

**Fix:** Move the DockerHub organisation/username to a repository variable:

```yaml
env:
  DOCKERHUB_REPO: ${{ vars.DOCKERHUB_REPO }}   # e.g. mapoby/cat-ftx1

# in tags:
${{ env.DOCKERHUB_REPO }}:${{ github.sha }}
${{ env.DOCKERHUB_REPO }}:latest
```

If DockerHub push is optional, guard the login and tag steps conditionally on `vars.DOCKERHUB_REPO != ''`.

---

### WR-03: `az` error output suppressed before `||` guard in setup.sh — failures silently misclassified

**File:** `infra/setup.sh:87-93`
**Issue:** Lines 87 and 97 use `2>/dev/null || true` to silently discard all stderr from `az ad app list` and `az ad sp list`. If these commands fail due to insufficient permissions, network error, or Azure CLI misconfiguration, `EXISTING` and `SP_OBJ` will be empty strings — identical to the "not found" case. The script then attempts to create a new app registration or service principal, which may fail with a different error or silently create a duplicate. The user gets no indication that the lookup failed vs. returning no results.

**Fix:** Capture exit code separately to distinguish "not found" from "error":

```bash
EXISTING=$(az ad app list --display-name "$SP_NAME" --query "[0].appId" -o tsv) || {
  echo "WARNING: failed to query existing app registrations — proceeding with create" >&2
  EXISTING=""
}
```

---

### WR-04: `workflow_dispatch` OIDC credential is a redundant duplicate

**File:** `infra/setup.sh:128-136`
**Issue:** The second `az ad app federated-credential create` call (lines 129-136) creates a credential named `github-main-dispatch` with the same subject string `repo:${GITHUB_REPO}:ref:refs/heads/main` as the first credential. Azure OIDC matching uses the subject claim, not the credential name. Having two credentials with identical subjects provides no extra access and creates confusion. Additionally, line 136 uses `|| true` without any message, so if this call fails for a real reason (e.g., the API is rate-limited), the error is completely invisible.

**Fix:** Remove the second credential creation block entirely. The single `github-main` credential covers both `push` and `workflow_dispatch` events on main. If branch-scoped credentials for other branches are needed in future, they can be added explicitly.

---

### WR-05: GitHub Actions action versions may not exist or are unpinned to SHA

**File:** `.github/workflows/azure-deploy.yml:60,67`
**Issue:** The workflow uses `docker/login-action@v4` (line 60) and `docker/build-push-action@v6` (line 67). As of the August 2025 knowledge cutoff, `docker/login-action` had not yet published a v4 major release (latest was v3). If v4 does not exist, the job will fail at that step. Neither action is pinned to a commit SHA, which means a malicious or accidental tag update could execute arbitrary code in the build pipeline — a supply-chain concern for any workflow with `id-token: write` permission.

**Fix:** Pin all third-party actions to their full commit SHA:

```yaml
# Example:
uses: docker/login-action@9780b0c442fbb1117ed29e0efdff1e18412f7567  # v3.3.0
uses: docker/build-push-action@ca052bb54ab0790a636c9b5f226502c73d547a25  # v5.4.0
```

Verify available versions at https://github.com/docker/login-action/releases before updating.

---

## Info

### IN-01: CSP `script-src 'unsafe-inline'` weakens clickjacking/XSS protection

**File:** `nginx.conf:11`
**Issue:** The Content-Security-Policy includes `'unsafe-inline'` for `script-src`. While Nuxt 3 static output may require this for hydration or inline scripts, it negates a significant portion of the XSS protection that CSP provides. Any inline script injected via an XSS vector would execute without being blocked.

**Fix:** Investigate whether `nuxt generate` output actually requires `'unsafe-inline'`. If Nuxt is generating hashed inline scripts, replace `'unsafe-inline'` with the specific `'sha256-...'` hashes. If not possible with the current Nuxt config, add a comment documenting why it is required.

---

### IN-02: Actual infrastructure resource names and URLs exposed in README

**File:** `README.md:34-35,87`
**Issue:** The README hardcodes the live deployment details: `catftx1webacr.azurecr.io`, `catftx1web-app.azurewebsites.net`, resource group `ev-catftx1web-rg`, and region `uksouth`. These are not secrets, but they reduce the effort required for targeted reconnaissance of the running infrastructure.

**Fix:** Replace live values with placeholder tokens: `<your-acr-name>.azurecr.io`, `<your-app-name>.azurewebsites.net`. The README's purpose is to document setup steps, not record the author's specific deployment.

---

### IN-03: No `engines` field in package.json to enforce Node version

**File:** `package.json`
**Issue:** The Dockerfile and CI/CD both use Node 22, but there is no `engines` field in `package.json` to enforce this for local development. A developer running Node 18 or 20 will get no warning.

**Fix:**
```json
"engines": {
  "node": ">=22.0.0"
}
```

---

_Reviewed: 2026-05-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
