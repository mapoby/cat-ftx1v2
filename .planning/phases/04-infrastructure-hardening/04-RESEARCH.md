# Phase 4: Infrastructure Hardening - Research

**Researched:** 2026-05-09
**Domain:** Azure Bicep, nginx CSP, GitHub Actions, npm lockfile, bash scripting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Build reproducibility (INFRA-01)**
- D-01: Remove `magic-regexp` from `package.json` first, then run `npm install` locally to generate `package-lock.json`, then commit the lockfile.
- D-02: Switch `Dockerfile` line 7 from `npm install --prefer-offline` to `npm ci` — fails the build if the lockfile is absent or inconsistent.

**Unused dependency (INFRA-02)**
- D-03: `magic-regexp` is a listed production dependency but has zero imports in the codebase. Remove it. No code changes needed beyond `package.json` and regenerating the lockfile.

**Content Security Policy (INFRA-03)**
- D-04: Add CSP header in `nginx.conf` server block (applies to all responses). Header value:
  `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.rsgb.online https://*.ukrepeater.net`
- D-05: `'unsafe-inline'` in `script-src` is required — Nuxt's static build injects inline runtime chunks and the Phase 2 browser compat gate is an inline `<script>` in `app.head.script`. Hash-based CSP is not pursued.
- D-06: `connect-src` uses wildcards to be resilient to subdomain changes.
- D-07: The CSP `add_header` directive must be placed in the `server` block (not inside a `location` block).

**ACR managed identity (INFRA-04)**
- D-08: Enable system-assigned managed identity on the Web App and grant it the `AcrPull` built-in role on the ACR. Set `adminUserEnabled: false` in Bicep. Remove the three `DOCKER_REGISTRY_SERVER_*` app settings.
- D-09: Deploy via `az deployment group create` (Bicep redeploy) against the existing resource group.
- D-10: Sequencing: assign `AcrPull` role to the managed identity first, then run the Bicep redeploy that removes admin credentials.
- D-11: No CI/CD workflow changes required for the push side — only the Web App pull side is affected.

**DockerHub community distribution (new scope)**
- D-12: Add a DockerHub push step to `azure-deploy.yml` after the existing ACR push. Push to `mapoby/cat-ftx1:latest` and `mapoby/cat-ftx1:<sha>` on every push to `main`.
- D-13: DockerHub credentials stored as GitHub Actions secrets: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.
- D-14: The built image is safe for public distribution.

**Local Docker documentation (new scope)**
- D-15: Add a "Run locally with Docker" section to `README.md` covering: `docker pull mapoby/cat-ftx1:latest`, `docker run -p 8080:80 mapoby/cat-ftx1:latest`, and the note that Web Serial API requires Chrome/Edge on `localhost`.

**Self-hosted Azure installation (new scope)**
- D-16: Improve `infra/setup.sh` with a `USE_DEFAULTS` block at the top and an interactive/non-interactive mode toggle.
- D-17: Add a "Self-hosted on Azure" section to `README.md`.

### Claude's Discretion
- Exact nginx CSP header placement (within server block but above or below existing headers).
- Whether to create a separate DockerHub workflow file or add to existing `azure-deploy.yml` — inline is preferred.
- Bicep role assignment syntax (using `roleDefinitionId` for the built-in `AcrPull` GUID vs. looking up by name).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | `package-lock.json` committed; `Dockerfile` uses `npm ci` | Lockfile already exists (lockfileVersion 3, npm 10.9.2). `npm ci` syntax confirmed. magic-regexp must be uninstalled first before regenerating. |
| INFRA-02 | `magic-regexp` removed from `package.json` | Zero imports verified via codebase grep. Still present in `package.json` dependencies and `package-lock.json`. README still references it. |
| INFRA-03 | nginx `Content-Security-Policy` header covering `default-src`, `script-src`, `connect-src` | Header value and server-block placement verified. `add_header` inheritance pitfall documented. |
| INFRA-04 | ACR uses managed identity for App Service image pull; `adminUserEnabled: false`; admin credential app settings removed | AcrPull GUID verified: `7f951dda-4ed3-4680-a7ca-43fe172d538d`. Bicep pattern for system-assigned identity + roleAssignment documented. `acrUseManagedIdentityCreds` setting confirmed required. |
</phase_requirements>

---

## Summary

Phase 4 is a pure infrastructure and configuration phase with no application logic changes. All four INFRA requirements are isolated changes to specific files. The work divides cleanly into three independent tracks: (1) lockfile + Dockerfile, (2) nginx CSP header, and (3) Bicep managed identity migration. The DockerHub push and README/setup.sh work is additive with no cross-dependencies.

**Key discovery:** The `package-lock.json` already exists in the repository (lockfileVersion 3, generated by npm 10.9.2). However, `magic-regexp` is still present in both `package.json` and the lockfile, and the `Dockerfile` still uses `npm install --prefer-offline`. The correct sequence is: uninstall magic-regexp, run `npm install` locally to regenerate the lockfile, commit both, then update the Dockerfile to `npm ci`.

**Critical Bicep fact:** The `acrUseManagedIdentityCreds` site config property must be set to `true` on the Web App in addition to granting the role assignment — without it, the App Service platform does not use managed identity for image pulls even if the role is granted. The existing `DOCKER_REGISTRY_SERVER_*` app settings must be removed.

**Primary recommendation:** Implement as three sequential tasks — (1) lockfile/Dockerfile, (2) CSP header, (3) Bicep managed identity — because each can be deployed and verified independently. The DockerHub push and README updates can run in parallel with the Bicep work.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Build reproducibility | CI/CD + Docker | — | Lockfile committed to repo; `npm ci` enforces it at build time |
| Content Security Policy | CDN/Static (nginx) | — | Header set at the serving layer; app has no auth tokens to protect but CSP is a standard hardening measure |
| ACR image pull auth | Azure infrastructure (Bicep) | CI/CD | Role assignment defined in Bicep; CI pushes but App Service pulls independently |
| DockerHub push | CI/CD | — | Additional `docker/login-action` step after existing ACR push |
| Documentation | Repo files | — | README and setup.sh — no runtime component |

---

## Standard Stack

### Core

| Tool/Config | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| npm ci | npm 10.9.2 [VERIFIED: local] | Reproducible install from lockfile | Fails fast on lockfile inconsistency; standard for CI |
| nginx add_header | nginx 1.27-alpine [VERIFIED: Dockerfile] | Set HTTP response headers | Native nginx directive, no module needed |
| Bicep roleAssignment | 2022-04-01 API | Grant RBAC role to managed identity | Standard Azure RBAC resource type |
| docker/login-action | v4 [VERIFIED: GitHub Marketplace] | DockerHub authentication in Actions | Official Docker action |
| docker/build-push-action | v6 [VERIFIED: azure-deploy.yml] | Already in use for ACR; reuse for DockerHub tags | Already in pipeline |

### Supporting

| Item | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `acrUseManagedIdentityCreds` | site config property | Tells App Service to use managed identity for ACR pulls | Required alongside role assignment — the role alone is insufficient [VERIFIED: learn.microsoft.com] |
| AcrPull role GUID | `7f951dda-4ed3-4680-a7ca-43fe172d538d` | Built-in role for pulling from ACR | Used in Bicep `roleDefinitionId` reference [VERIFIED: learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers] |

---

## Architecture Patterns

### System Architecture Diagram

```
[git push to main]
       |
       v
[GitHub Actions: azure-deploy.yml]
       |
       +-- npm ci (lockfile-enforced install)
       |
       +-- nuxt generate (static build)
       |
       +-- docker build (Dockerfile: npm ci stage)
       |
       +-- docker push --> [ACR: catftx1webacr.azurecr.io]
       |
       +-- docker push --> [DockerHub: mapoby/cat-ftx1]  <-- NEW
       |
       +-- az webapp deploy (points App Service at :sha tag)
              |
              v
       [Azure App Service]
              |
              | pulls via managed identity (system-assigned)  <-- CHANGED
              v
       [ACR: catftx1webacr.azurecr.io]
              |
              v
       [nginx container: serves static SPA]
              |
              | all responses include CSP header  <-- NEW
              v
       [browser: Chrome/Edge with Web Serial API]
```

### Recommended Project Structure

No structural changes. All modifications are to existing files:

```
.
├── Dockerfile           # line 7: npm install → npm ci
├── nginx.conf           # add CSP header in server block
├── package.json         # remove magic-regexp
├── package-lock.json    # regenerated after removing magic-regexp
├── README.md            # add local Docker + self-hosted Azure sections
├── infra/
│   ├── main.bicep       # managed identity + role assignment + adminUserEnabled: false
│   └── setup.sh         # add interactive/non-interactive mode
└── .github/
    └── workflows/
        └── azure-deploy.yml  # add DockerHub push step
```

### Pattern 1: nginx `add_header` in server block

**What:** CSP and other security headers placed directly in the `server {}` block apply to all responses from that server, including the SPA fallback and `/health`.

**When to use:** When a header must apply universally. Location-block headers do NOT inherit server-block headers in nginx (they replace the header set for that location context).

**Example:**
```nginx
# Source: VERIFIED: nginx documentation on add_header inheritance
server {
    listen 80;
    server_name _;

    # Security headers — apply to ALL responses
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.rsgb.online https://*.ukrepeater.net";

    # ...location blocks follow...
}
```

**Critical:** The static-asset location block already has its own `add_header Cache-Control` directive. Per nginx inheritance rules, this means that location block does NOT inherit the server-block security headers. The CSP header will NOT be present on `.js`, `.css`, `.woff2` etc. responses. This is acceptable — CSP is primarily enforced on HTML document responses, not static asset responses. If full coverage is needed, security headers must be duplicated into that location block or the `location` directive must be restructured.

### Pattern 2: Bicep system-assigned managed identity + AcrPull role assignment

**What:** Enable system-assigned identity on the Web App resource, remove `listCredentials()`, add a `roleAssignment` resource scoped to the ACR.

**Example:**
```bicep
// Source: VERIFIED: learn.microsoft.com/azure/app-service/configure-custom-container
// and learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers

// AcrPull built-in role definition ID (stable GUID, never changes)
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${appName}acr'
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false  // CHANGED: was true
  }
}

resource webapp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${appName}-app'
  location: location
  identity: {
    type: 'SystemAssigned'   // NEW: enables managed identity
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${appName}:latest'
      alwaysOn: true
      appSettings: [
        // REMOVED: DOCKER_REGISTRY_SERVER_URL
        // REMOVED: DOCKER_REGISTRY_SERVER_USERNAME
        // REMOVED: DOCKER_REGISTRY_SERVER_PASSWORD
        {
          name:  'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name:  'WEBSITES_PORT'
          value: '80'
        }
      ]
    }
  }
}

// NEW: Grant AcrPull to the webapp's managed identity on the ACR
resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, webapp.id, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      acrPullRoleId
    )
    principalId: webapp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// NEW: Tell App Service to use managed identity for image pulls (required in addition to role)
resource webappConfig 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webapp
  name: 'web'
  properties: {
    acrUseManagedIdentityCreds: true
  }
}
```

**Name generation:** `guid(acr.id, webapp.id, acrPullRoleId)` produces a deterministic GUID — idempotent across redeploys. [VERIFIED: standard Bicep pattern]

### Pattern 3: DockerHub push in GitHub Actions alongside ACR push

**What:** Use `docker/login-action@v4` to authenticate to DockerHub before the build step, then add DockerHub tags to the existing `docker/build-push-action` step.

**Example:**
```yaml
# Source: VERIFIED: github.com/marketplace/actions/docker-login (v4.1.0)

# Add after the existing ACR login step:
- name: Log in to Docker Hub
  uses: docker/login-action@v4
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}

# Extend the existing build-push step with additional tags:
- name: Build and push Docker image
  uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    build-args: APP_VERSION=v1.${{ github.run_number }}
    tags: |
      ${{ vars.ACR_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
      ${{ vars.ACR_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:latest
      mapoby/cat-ftx1:${{ github.sha }}
      mapoby/cat-ftx1:latest
```

**Note:** `docker/build-push-action` can push to multiple registries in one step if both registries are authenticated before the step runs. The image is built once and pushed to both destinations.

### Pattern 4: bash interactive/non-interactive mode with `DEFAULT_*` variables

**What:** A parameter block at the top of the script holds defaults. On start, ask the user whether to use defaults or prompt interactively.

**Example:**
```bash
# Source: [ASSUMED] — standard bash scripting pattern

# ── Default parameters ────────────────────────────────────────────────────────
DEFAULT_APP_NAME="catftx1"
DEFAULT_LOCATION="westeurope"
DEFAULT_GITHUB_REPO="mapoby/cat-ftx1v2"
DEFAULT_SKU="B1"

# ── Interactive/non-interactive mode ─────────────────────────────────────────
echo "Use default values? [y/N]"
read -r USE_DEFAULTS
USE_DEFAULTS="${USE_DEFAULTS:-n}"

if [[ "$USE_DEFAULTS" =~ ^[Yy]$ ]]; then
  APP_NAME="$DEFAULT_APP_NAME"
  LOCATION="$DEFAULT_LOCATION"
  GITHUB_REPO="$DEFAULT_GITHUB_REPO"
  SKU="$DEFAULT_SKU"
else
  read -rp "App name [$DEFAULT_APP_NAME]: " APP_NAME
  APP_NAME="${APP_NAME:-$DEFAULT_APP_NAME}"
  read -rp "Location [$DEFAULT_LOCATION]: " LOCATION
  LOCATION="${LOCATION:-$DEFAULT_LOCATION}"
  read -rp "GitHub repo [$DEFAULT_GITHUB_REPO]: " GITHUB_REPO
  GITHUB_REPO="${GITHUB_REPO:-$DEFAULT_GITHUB_REPO}"
  read -rp "SKU [$DEFAULT_SKU]: " SKU
  SKU="${SKU:-$DEFAULT_SKU}"
fi
```

**Existing pattern to preserve:** The current `setup.sh` already supports `APP_NAME="${APP_NAME:-catftx1}"` env-var override. The new interactive mode sits alongside this — if env vars are set before running, they should take precedence over both the defaults and any interactive input.

### Anti-Patterns to Avoid

- **`listCredentials()` in Bicep:** Currently used at line 39 of `main.bicep`. This materialises the admin password as a string in the ARM template deployment. Remove entirely when switching to managed identity.
- **`add_header` inside location blocks only:** The static-asset location block (`~* \.(js|css|...)$`) has its own `add_header`. If CSP is only added there, it will not appear on HTML responses. Add to `server` block.
- **Granting role without setting `acrUseManagedIdentityCreds`:** The role assignment alone does not change how App Service pulls. The `acrUseManagedIdentityCreds: true` site property is mandatory. [VERIFIED: learn.microsoft.com]
- **`npm install` in Dockerfile when lockfile exists:** `npm install --prefer-offline` ignores the lockfile for version resolution on clean installs. `npm ci` reads the lockfile exactly and fails if it disagrees with `package.json`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RBAC role assignment ID | Hand-write a GUID | `guid(acr.id, webapp.id, roleId)` | Deterministic, collision-free, idempotent across redeploys |
| ACR auth lookup | `listCredentials()` | System-assigned MI + AcrPull | Credentials rotate automatically; no secrets in app settings |
| Docker multi-registry push | Two separate `docker build` runs | Single `build-push-action` step with multiple `tags:` entries | Image built once, pushed to both; faster and guaranteed identical digest |

---

## Common Pitfalls

### Pitfall 1: nginx `add_header` inheritance breaks CSP on static assets

**What goes wrong:** Adding `add_header Content-Security-Policy` only in the `server` block means it is absent from responses matched by the `location ~* \.(js|css|...)$` block, because that block has its own `add_header Cache-Control` directive. nginx resets the inherited header set when any `add_header` is present in a child block.

**Why it happens:** nginx `add_header` directives are not additive across block scopes. A child scope that uses `add_header` for any header gets only the headers defined in that child scope.

**How to avoid:** For this phase, the CSP header not appearing on static assets is acceptable (CSP enforcement happens on the HTML document load). Document this limitation. If full coverage is required later, duplicate the security headers into the static-asset location block or restructure using `map` + `add_header` in `http` context.

**Warning signs:** Running `curl -I http://localhost:8080/assets/somefile.js | grep Content-Security` returns empty.

### Pitfall 2: Bicep redeploy removes credentials before managed identity pull is established

**What goes wrong:** If the Bicep redeploy removes `DOCKER_REGISTRY_SERVER_*` app settings before the managed identity has been granted `AcrPull`, the Web App restarts and fails to pull the image with an auth error.

**Why it happens:** Role propagation in Azure RBAC can take 1-5 minutes after assignment. The Bicep redeploy that removes admin credentials triggers a container restart immediately.

**How to avoid:** The `roleAssignment` resource in Bicep has an implicit dependency via `webapp.identity.principalId`. Because Bicep deploys in dependency order, the role assignment is created before the webapp config is updated. This means the `acrPullAssignment` resource is created before `webappConfig` removes the old credentials. Still, allow ~2 minutes after the deployment completes before the container pull succeeds.

**Warning signs:** App Service logs show `unauthorized: authentication required` immediately after Bicep redeploy. This is transient — wait 2-5 minutes and trigger a restart.

### Pitfall 3: magic-regexp still in package-lock.json after package.json removal

**What goes wrong:** `npm uninstall magic-regexp` removes it from `package.json` and regenerates the lockfile correctly. But if only `package.json` is edited by hand (removing the line), `package-lock.json` still references magic-regexp. Running `npm ci` then fails because lockfile and `package.json` are inconsistent.

**Why it happens:** `npm ci` enforces that `package.json` and `package-lock.json` are in sync. It does not auto-update the lockfile.

**How to avoid:** Always use `npm uninstall magic-regexp` (not manual edit) and then commit the regenerated `package-lock.json`. Alternatively, edit `package.json` and run `npm install` to regenerate the lockfile, then commit both.

**Warning signs:** `npm ci` output: `npm error \`npm ci\` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync`.

### Pitfall 4: README still references magic-regexp after removal

**What goes wrong:** `README.md` line 23 describes magic-regexp as an active dependency: "Pattern matching | magic-regexp v0.11 for CAT response parsing". After INFRA-02, this is stale and misleading.

**Why it happens:** Documentation not updated alongside code change.

**How to avoid:** Include README update in the same task/commit as INFRA-02.

### Pitfall 5: DockerHub push fails silently if secrets not configured

**What goes wrong:** If `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets are not added to the GitHub repo, `docker/login-action` fails and the workflow errors. With the inline approach (both push steps in one job), an ACR push that succeeds before the DockerHub login step would still be followed by a job failure.

**Why it happens:** Login action does not have a `continue-on-error` default.

**How to avoid:** Document in the README that both secrets must be set before the first push to `main`. The workflow file should document the required secrets inline as comments.

---

## Code Examples

### Verified: `npm ci` in multi-stage Dockerfile

```dockerfile
# Source: VERIFIED: npm docs — npm ci requires lockfile, fails on mismatch
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN npm run generate
```

Both `package.json` and `package-lock.json` must be copied before `npm ci` runs.

### Verified: AcrPull GUID

```
7f951dda-4ed3-4680-a7ca-43fe172d538d
```

Source: [VERIFIED: learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#acrpull]

### Verified: `subscriptionResourceId` for built-in role in Bicep

```bicep
// Source: VERIFIED: standard Bicep pattern for built-in role references
roleDefinitionId: subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)
```

### Verified: `acrUseManagedIdentityCreds` requirement

From official Microsoft docs: "Configure your app to use the managed identity to pull from Azure Container Registry":
```azurecli
az webapp config set --resource-group <group-name> --name <app-name> \
  --generic-configurations '{"acrUseManagedIdentityCreds": true}'
```

In Bicep, this maps to:
```bicep
resource webappConfig 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webapp
  name: 'web'
  properties: {
    acrUseManagedIdentityCreds: true
  }
}
```
Source: [VERIFIED: learn.microsoft.com/azure/app-service/configure-custom-container#use-managed-identity-to-pull-image-from-azure-container-registry]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ACR admin credentials in app settings | System-assigned managed identity + AcrPull role | Current Azure best practice | Eliminates stored credentials; identity lifecycle managed by Azure |
| `npm install` in Docker builds | `npm ci` with committed lockfile | Standard practice for reproducibility | Deterministic builds; fails fast on drift |
| No CSP header | Explicit CSP with `default-src 'self'` | Long-standing web security standard | Reduces XSS risk surface |

**Deprecated/outdated:**
- `acr.listCredentials()` in Bicep: superseded by managed identity. Still works but exposes passwords as plain-text ARM values visible to portal readers.
- `npm install --prefer-offline` in Dockerfile: does not guarantee reproducible builds when no local cache exists.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | bash interactive mode pattern (`read -rp "Prompt [default]: "`) works in the Azure Cloud Shell environment where `setup.sh` is typically run | Pattern 4, setup.sh | If Cloud Shell uses a non-interactive shell mode, the prompt would hang or be skipped; fallback: document that the script requires an interactive terminal |
| A2 | `docker/build-push-action@v6` pushes to all registries listed in `tags:` when multiple registries are logged in | Pattern 3, DockerHub push | If the action only pushes to the first authenticated registry, a second `build-push-action` step would be needed; this would duplicate the build |
| A3 | The `Microsoft.Web/sites/config` child resource `acrUseManagedIdentityCreds` property is supported on the `2023-12-01` API version used in the current Bicep | Code Examples | If not supported, the property would need to be set via `az webapp config set` post-deployment rather than in Bicep |

---

## Open Questions (RESOLVED)

1. **Does `docker/build-push-action@v6` push to multiple registries from a single step?**
   - What we know: The action accepts multiple `tags:` entries and both registries are authenticated via `docker/login-action` before the step.
   - What's unclear: Whether the action iterates all tags' registries or only the first one it identifies.
   - Recommendation: Test with a dry-run push in CI, or use two separate `docker/build-push-action` steps (one per registry) if ambiguous. The two-step approach is unambiguous and only marginally more YAML.
   - RESOLVED: Single-step multi-registry push accepted as standard approach (accepted risk). If CI reports a DockerHub auth failure, the fallback is a second `docker/build-push-action` step for DockerHub tags only — that two-step approach is unambiguous and requires no re-planning.

2. **Does the existing OIDC service principal have `Microsoft.Authorization/roleAssignments/write` permission on the ACR resource?**
   - What we know: The SP was granted `Contributor` on the resource group. Contributor does NOT include `Microsoft.Authorization/*` write.
   - What's unclear: Whether the Bicep deployment via this SP can create the `roleAssignment` resource, or whether the SP needs `Owner` or `Role Based Access Control Administrator` on the ACR.
   - Recommendation: The planner should include a step to verify/escalate the SP's permissions before running the Bicep redeploy. The role assignment step may require running separately with elevated credentials (e.g., `az role assignment create` from an Owner-privileged account) and then the Bicep redeploy omitting the `roleAssignment` resource if the SP cannot write role assignments.
   - RESOLVED: Plan 03 Task 1 is a checkpoint:human-verify gate that resolves this at execution time. The executor verifies SP permissions before running the Bicep redeploy; if `Microsoft.Authorization/roleAssignments/write` is absent from the SP, the executor runs `az role assignment create` manually with Owner-privileged credentials first, then redeploys Bicep without the `roleAssignment` resource.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm | INFRA-01 (lockfile regen) | ✓ | 10.9.2 [VERIFIED: local] | — |
| node:22-alpine | INFRA-01 (Dockerfile) | ✓ | in use [VERIFIED: Dockerfile] | — |
| nginx 1.27-alpine | INFRA-03 (CSP header) | ✓ | in use [VERIFIED: Dockerfile] | — |
| Azure CLI + Bicep | INFRA-04 (managed identity deploy) | ✓ [ASSUMED: infra is live] | — | Manual Azure portal config |
| DockerHub account `mapoby` | D-12 (DockerHub push) | ✓ [ASSUMED: user confirmed] | — | — |
| `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` secrets | D-12 | ✗ (not yet configured) | — | Must be added before first push |

**Missing dependencies with no fallback:**
- `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` GitHub Actions secrets — must be configured before the updated workflow runs.

**Missing dependencies with fallback:**
- None.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies To |
|-----------|-----------|
| No backend process — static SPA only | Confirmed: nginx serves static files, no server-side logic added |
| `nuxt generate` → static files in `.output/public` | INFRA-01: Dockerfile must copy `package-lock.json` before `npm ci` |
| Multi-stage Docker build: node:22-alpine builder → nginx:1.27-alpine | INFRA-01/INFRA-03: both stages affected (build stage: npm ci; serve stage: nginx.conf) |
| Azure App Service Linux container, B1 SKU | INFRA-04: managed identity is supported on all App Service SKUs including B1 |
| CI/CD via `.github/workflows/azure-deploy.yml` | D-12: DockerHub push added to this file (inline, not a new workflow) |
| nginx serves SPA with fallback to `index.html` | INFRA-03: CSP in `server` block applies to SPA fallback response |

---

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json` — this section is SKIPPED.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | App has no user auth |
| V3 Session Management | no | Stateless SPA, no sessions |
| V4 Access Control | yes (infra) | Azure RBAC — managed identity with least-privilege AcrPull |
| V5 Input Validation | no | No new input paths added |
| V6 Cryptography | no | TLS handled by Azure App Service front-end; not modified |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Exposed ACR admin credentials in Azure portal | Information Disclosure | Remove admin credentials; use managed identity (INFRA-04) |
| XSS via injected scripts | Tampering | CSP header `default-src 'self'; script-src 'self' 'unsafe-inline'` (INFRA-03) |
| Non-reproducible build output | Tampering / Supply Chain | `npm ci` with committed lockfile (INFRA-01) |
| DockerHub image tampered post-push | Tampering | SHA-tagged immutable image used for App Service deploy; `:latest` tag is advisory only |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#acrpull] — AcrPull role GUID `7f951dda-4ed3-4680-a7ca-43fe172d538d`
- [VERIFIED: learn.microsoft.com/azure/app-service/configure-custom-container] — `acrUseManagedIdentityCreds` requirement, managed identity setup steps
- [VERIFIED: learn.microsoft.com/azure/container-registry/container-registry-rbac-built-in-roles-overview] — AcrPull role confirmed for App Service image pull scenario
- [VERIFIED: github.com/marketplace/actions/docker-login] — `docker/login-action@v4` (v4.1.0), DockerHub auth with username + token secret
- [VERIFIED: local package-lock.json] — lockfileVersion 3, npm 10.9.2, magic-regexp present
- [VERIFIED: codebase grep] — zero imports of magic-regexp in .ts/.vue/.js files

### Secondary (MEDIUM confidence)
- [CITED: nginx documentation] — `add_header` inheritance behaviour (child block with any `add_header` does not inherit parent block headers)

### Tertiary (LOW confidence)
- [ASSUMED] — bash `read -rp` interactive prompt pattern works in Azure Cloud Shell
- [ASSUMED] — `docker/build-push-action@v6` pushes to all authenticated registries in a single step

---

## Metadata

**Confidence breakdown:**
- INFRA-01/02 (lockfile + npm ci): HIGH — codebase state verified, npm ci behaviour is well-documented
- INFRA-03 (nginx CSP): HIGH — nginx syntax is stable and verified against docs; header value decided in CONTEXT.md
- INFRA-04 (managed identity): HIGH — AcrPull GUID verified, Bicep pattern verified, `acrUseManagedIdentityCreds` verified
- DockerHub push: MEDIUM — `docker/login-action` usage verified; multi-registry push in single step is ASSUMED
- setup.sh interactive mode: MEDIUM — standard bash pattern, ASSUMED to work in Cloud Shell

**Research date:** 2026-05-09
**Valid until:** 2026-06-08 (Azure RBAC GUIDs and nginx syntax are stable; docker action version moves faster)
