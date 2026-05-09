# Phase 4: Infrastructure Hardening - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock the build pipeline (committed lockfile + `npm ci`), remove the unused `magic-regexp` dependency, add a Content Security Policy header to nginx, migrate ACR image pulls from admin credentials to managed identity, push the Docker image to DockerHub for community distribution, and add documentation for local Docker deployment and for third-party Azure self-hosting.

</domain>

<decisions>
## Implementation Decisions

### Build reproducibility (INFRA-01)
- **D-01:** Remove `magic-regexp` from `package.json` first (`npm uninstall magic-regexp`), then run `npm install` locally to generate `package-lock.json`, then commit the lockfile.
- **D-02:** Switch `Dockerfile` line 7 from `npm install --prefer-offline` to `npm ci` — fails the build if the lockfile is absent or inconsistent.

### Unused dependency (INFRA-02)
- **D-03:** `magic-regexp` is a listed production dependency but has zero imports in the codebase. Remove it. No code changes needed beyond `package.json` and regenerating the lockfile.

### Content Security Policy (INFRA-03)
- **D-04:** Add CSP header in `nginx.conf` server block (applies to all responses). Header value:
  `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.rsgb.online https://*.ukrepeater.net`
- **D-05:** `'unsafe-inline'` in `script-src` is required — Nuxt's static build injects inline runtime chunks and the Phase 2 browser compat gate is an inline `<script>` in `app.head.script`. Hash-based CSP is not pursued; it would be fragile across Nuxt upgrades.
- **D-06:** `connect-src` uses wildcards (`https://*.rsgb.online`, `https://*.ukrepeater.net`) to be resilient to subdomain changes on these third-party beta APIs.
- **D-07:** The CSP `add_header` directive must be placed in the `server` block (not inside a `location` block) so it applies to all responses including the SPA fallback and `/health`. nginx's `add_header` inheritance means headers in a `location` block do NOT inherit server-block headers.

### ACR managed identity (INFRA-04)
- **D-08:** Enable system-assigned managed identity on the Web App and grant it the `AcrPull` built-in role on the ACR. Set `adminUserEnabled: false` in Bicep. Remove the three `DOCKER_REGISTRY_SERVER_*` app settings.
- **D-09:** Deploy via `az deployment group create` (Bicep redeploy) against the existing resource group. The Web App restarts once during the transition; a brief pull failure during that restart cycle is acceptable.
- **D-10:** Sequencing: assign `AcrPull` role to the managed identity first, then run the Bicep redeploy that removes admin credentials — this minimizes the failure window to a single restart.
- **D-11:** After the Bicep redeploy, the `azure-deploy.yml` workflow step `Log in to Azure Container Registry` uses `az acr login` (which uses the OIDC Azure token from the workflow), not admin credentials. The push path is already credential-free. The App Service pull path is what changes. No CI/CD workflow changes are required for the push side — only the Web App pull side is affected.

### DockerHub community distribution (new scope)
- **D-12:** Add a DockerHub push step to `azure-deploy.yml` after the existing ACR push. Push to `mapoby/cat-ftx1:latest` and `mapoby/cat-ftx1:<sha>` on every push to `main`.
- **D-13:** DockerHub credentials stored as GitHub Actions secrets: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`. Document in README that fork maintainers must add these secrets.
- **D-14:** The built image contains no Azure credentials, no API keys, and no user data — it is safe for public distribution.

### Local Docker documentation (new scope)
- **D-15:** Add a "Run locally with Docker" section to `README.md` covering: `docker pull mapoby/cat-ftx1:latest`, `docker run -p 8080:80 mapoby/cat-ftx1:latest`, and the note that Web Serial API requires Chrome/Edge on `localhost` (not just any HTTP origin).

### Self-hosted Azure installation (new scope)
- **D-16:** Improve `infra/setup.sh` with a parameter block at the top and an interactive/non-interactive mode toggle:
  - A `USE_DEFAULTS` block at the top of the script with all hardcoded values (appName, location, sku, subscription).
  - On script start: ask `"Use default values? [y/N]"`. If `y`, use the hardcoded values without prompting. If `n`, prompt for each parameter interactively.
- **D-17:** Add a "Self-hosted on Azure" section to `README.md` documenting: prerequisites (az CLI, Docker, GitHub account), the `infra/setup.sh` run, and the GitHub secrets/variables to configure after provisioning.

### Claude's Discretion
- Exact nginx CSP header placement (within server block but above or below existing headers) — planner decides.
- Whether to create a separate DockerHub workflow file or add to existing `azure-deploy.yml` — inline is preferred to keep CI changes in one place.
- Bicep role assignment syntax (using `roleDefinitionId` for the built-in `AcrPull` GUID vs. looking up by name) — planner picks idiomatic Bicep.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Infrastructure files (modify in this phase)
- `infra/main.bicep` — ACR and Web App resource definitions; managed identity goes here
- `infra/setup.sh` — provisioning script; add interactive/non-interactive mode
- `nginx.conf` — nginx server block; CSP header goes here
- `Dockerfile` — build stage; switch to `npm ci`
- `.github/workflows/azure-deploy.yml` — CI/CD pipeline; add DockerHub push step
- `package.json` — remove `magic-regexp`

### Documentation files (create/update)
- `README.md` — add local Docker run section and self-hosted Azure installation section

### Codebase context
- `.planning/codebase/CONCERNS.md` — documents the exact issues being fixed (ACR admin creds §Infrastructure, no lockfile §Infrastructure, no CSP §Security)
- `.planning/codebase/STACK.md` — confirms no lockfile present, npm as package manager
- `.planning/REQUIREMENTS.md` — INFRA-01 through INFRA-04 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nginx.conf` server block already has three `add_header` directives (X-Frame-Options, X-Content-Type-Options, Referrer-Policy) — CSP is a fourth header in the same pattern.
- `azure-deploy.yml` already uses `docker/build-push-action@v6` — DockerHub push can reuse the same action with a second tags block or a second step.

### Established Patterns
- GitHub Actions OIDC auth is already used for Azure (`azure/login@v2` with `id-token: write`) — DockerHub uses a different auth mechanism (`docker/login-action`) but the pattern of injecting credentials via secrets is established.
- Bicep uses `acr.listCredentials()` today — system-assigned identity replaces this with a `roleAssignment` resource and `identity: { type: 'SystemAssigned' }` on the webapp resource.

### Integration Points
- The browser compat gate (Phase 2) is an inline `<script>` injected via `nuxt.config.ts` `app.head.script` — this is why `'unsafe-inline'` in `script-src` is non-negotiable without a Nuxt build pipeline change.
- After removing `magic-regexp`, `npm install` must be run locally to regenerate `package-lock.json` before the Dockerfile can use `npm ci`. This is a local dev action, not a CI action.

</code_context>

<specifics>
## Specific Ideas

- DockerHub image: `mapoby/cat-ftx1` (user's DockerHub account). Secrets: `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` stored in GitHub Actions secrets.
- `infra/setup.sh` interactive mode: block of `DEFAULT_*` variables at the top of the script; prompt `"Use default values? [y/N]"` on start; if `n`, prompt each variable with the default shown in brackets.
- README local Docker section must note: Chrome or Edge required (Web Serial API), `localhost` origin satisfies the HTTPS requirement so plain `docker run -p 8080:80` works.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-infrastructure-hardening*
*Context gathered: 2026-05-09*
