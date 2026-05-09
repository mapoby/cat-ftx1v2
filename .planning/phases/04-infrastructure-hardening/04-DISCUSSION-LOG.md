# Phase 4: Infrastructure Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 4-infrastructure-hardening
**Areas discussed:** CSP script-src, Bicep infra deploy method, ACR credential transition risk, DockerHub distribution, open-source readiness, setup.sh interactivity, CSP connect-src domains

---

## CSP script-src

| Option | Description | Selected |
|--------|-------------|----------|
| `'unsafe-inline'` | Covers Nuxt inline runtime chunks and Phase 2 compat gate. Weakens XSS for scripts but required without build pipeline changes. | ✓ |
| Hash-based (strict) | SHA-256 hash per inline script. Fragile on Nuxt upgrades. | |
| You decide | Planner picks the pragmatic option | |

**User's choice:** `'unsafe-inline'`
**Notes:** Nuxt's static build injects inline script chunks and the Phase 2 browser compat gate is an inline script. Hash-based approach would require build pipeline changes and break on Nuxt upgrades.

---

## Bicep infra deploy method

| Option | Description | Selected |
|--------|-------------|----------|
| Bicep redeploy (`az deployment group create`) | Re-run Bicep against existing resource group. Azure updates in-place. | ✓ |
| Manual Azure portal | Enable identity and grant AcrPull via portal. Bicep stays as docs. | |
| Add to CI/CD pipeline | Automatic infra deploy on push to main. | |

**User's choice:** Bicep redeploy
**Notes:** Infrastructure is already live. Re-running Bicep is the correct IaC approach to maintain infrastructure as code.

---

## ACR credential transition risk

| Option | Description | Selected |
|--------|-------------|----------|
| Add role assignment before removing creds | Zero-downtime: managed identity authorized before admin credentials removed. | |
| Accept a short pull failure | Single-shot Bicep redeploy; Web App may fail to start once, then recovers. | ✓ |
| You decide | Planner handles sequencing | |

**User's choice:** Accept a short pull failure
**Notes:** Hobby/dev project. One restart cycle failure is acceptable. Plan still assigns AcrPull before removing credentials to minimize the window.

---

## Open-source distribution and DockerHub

**User's choice (free text):** Push Docker image to DockerHub on every deploy so the community can run it without building. Add instructions for running locally with Docker. Make `infra/setup.sh` support both hardcoded defaults and fully interactive mode. Document self-hosted Azure installation in README.

**Notes:** Image contains no secrets, API keys, or credentials — safe for public distribution. DockerHub username: `mapoby`. Credentials via `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` GitHub Actions secrets.

---

## DockerHub scope (Phase 4 vs. new phase)

| Option | Description | Selected |
|--------|-------------|----------|
| Add to Phase 4 | Extend Phase 4 with DockerHub push + README docs | ✓ |
| New phase after Phase 4 | Keep Phase 4 at 4 INFRA reqs, Phase 5 for distribution | |
| Skip DockerHub | Azure-only CI/CD | |

**User's choice:** Add to Phase 4

---

## CSP connect-src domains

| Option | Description | Selected |
|--------|-------------|----------|
| Include both explicitly | `connect-src 'self' https://api-beta.rsgb.online https://ukrepeater.net` | |
| Wildcard the domains | `connect-src 'self' https://*.rsgb.online https://*.ukrepeater.net` | ✓ |
| You decide | Planner picks based on least-privilege | |

**User's choice:** Wildcard the domains
**Notes:** More resilient to subdomain changes on these third-party beta APIs.

---

## Claude's Discretion

- Exact nginx CSP header placement within server block
- Whether to inline DockerHub push into `azure-deploy.yml` or separate workflow file
- Bicep role assignment syntax (built-in AcrPull GUID vs. name lookup)

## Deferred Ideas

None — discussion stayed within phase scope.
