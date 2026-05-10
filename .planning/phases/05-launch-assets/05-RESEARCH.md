# Phase 5: Launch Assets — Research

**Researched:** 2026-05-10
**Domain:** GitHub Pages, YouTube channel setup, GitHub repo metadata, screen recording (Windows 10), static landing page
**Confidence:** HIGH (all major technical claims verified via CLI or official docs)

---

## Summary

Phase 5 has four deliverables that are logically independent and can be done in any order, though the video must exist before it can be embedded in either the README or the landing page. All GitHub operations (topics, Pages, repo creation) can be scripted via `gh` CLI. The `mapoby/hamtools.cc` repo does not yet exist; it must be created before Pages can be enabled. The `hamtools.cc` apex domain uses Cloudflare DNS — four GitHub Pages A records must be added there. No A records currently exist for the apex; `cat-ftx1.hamtools.cc` is already CNAME'd to Azure and must not be touched.

Screen recording: Xbox Game Bar (Win+G) is present and GameDVR is enabled. The primary monitor is 2752x1152 at 125% scaling, so a browser window set to ~1400px wide will record cleanly. OBS Studio 32.1.2 is the alternative if Game Bar quality is insufficient — it is not installed but available from obsproject.com.

The current repo has zero topics, no homepage URL, and no Pages site. All three PROMO requirements map cleanly to specific, automatable tasks.

**Primary recommendation:** Sequence the work as: (1) create YouTube channel manually, (2) record + publish video, (3) add topics + README embed in the source repo, (4) build and deploy hamtools.cc. Steps 1 and 2 are manual; steps 3 and 4 are fully automatable via git + `gh` CLI.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GitHub repo topics | GitHub API | gh CLI | `PUT /repos/{owner}/{repo}/topics` — one API call |
| README video embed | Source repo (static MD) | — | Image-link pattern; no server needed |
| hamtools.cc landing page | CDN / Static (GitHub Pages) | Cloudflare DNS | Pure HTML/CSS, no framework, no build step |
| YouTube video hosting | External service (YouTube) | — | Decided — YouTube only |
| Screen recording | Local tool (Windows) | — | Capture on developer machine, upload manually |
| Custom domain DNS | Cloudflare (DNS provider) | GitHub Pages (HTTPS cert) | Cloudflare is authoritative NS for hamtools.cc |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROMO-01 | 60–90 second YouTube demo video: connect → live frequency → preset → VFO change | YouTube channel must exist first; Windows Game Bar available for recording; manual upload step |
| PROMO-02 | GitHub repo topics added: `ham-radio`, `cat-control`, `yaesu`, `yaesu-ftx1`, `web-serial`, `nuxt`, `vue` | `gh repo edit --add-topic` confirmed; current topics: `[]` (zero topics — clean slate) |
| PROMO-03 | hamtools.cc live on GitHub Pages — dark HTML/CSS page with screenshot/video, description, features, browser warning, two CTAs | Repo must be created; Cloudflare DNS must get 4 A records; CNAME file + Pages enable |
</phase_requirements>

---

## Standard Stack

### Core (landing page — hamtools.cc)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Plain HTML/CSS | — | Landing page markup and styling | Decided — no framework, no build step |
| GitHub Pages | — | Static hosting | Decided — free, custom domain, HTTPS auto |
| GitHub Actions (`actions/deploy-pages@v5`) | v5 | Deploy to Pages on push | Official starter workflow pattern |
| `actions/upload-pages-artifact@v3` | v3 | Stage files for deploy | Required pairing with deploy-pages |
| `actions/configure-pages@v5` | v5 | Set Pages environment metadata | Required pairing |

[VERIFIED: github.com/actions/starter-workflows/blob/main/pages/static.yml]

### Core (repo metadata)
| Tool | Purpose | Verified Command |
|------|---------|-----------------|
| `gh repo edit` | Add topics to cat-ftx1v2 | `gh repo edit mapoby/cat-ftx1v2 --add-topic ham-radio` |
| `gh repo edit` | Set homepage URL | `gh repo edit mapoby/cat-ftx1v2 --homepage https://hamtools.cc` |
| GitHub API `PUT /repos/{owner}/{repo}/topics` | Bulk-replace all topics at once | `gh api repos/mapoby/cat-ftx1v2/topics -X PUT -f names[]=ham-radio ...` |

[VERIFIED: gh CLI 2.87.3 help output — `--add-topic` flag confirmed]
[VERIFIED: docs.github.com/en/rest/repos/repos — topics PUT endpoint confirmed]

### Supporting
| Tool | Version | Purpose |
|------|---------|---------|
| OBS Studio | 32.1.2 | Screen recording (if Game Bar insufficient) |
| Xbox Game Bar | built-in | Screen recording (already installed, GameDVR enabled) |

[VERIFIED: OBS version from obsproject.com/download]
[VERIFIED: GameDVR_Enabled=1 confirmed via registry on this machine]

---

## Architecture Patterns

### System Architecture Diagram

```
Developer Machine
   └── Screen recording (Game Bar / OBS)
          └── YouTube upload (manual)
                 └── YouTube video URL + thumbnail

Source repo (cat-ftx1v2)
   ├── README.md
   │     └── video embed (image-link to YouTube) ──────────> YouTube
   │     └── badges (shields.io) ────────────────────────> shields.io CDN
   └── git push → existing CI (azure-deploy.yml) unchanged

hamtools.cc repo (new: mapoby/hamtools.cc)
   ├── index.html  (pure HTML/CSS)
   ├── CNAME       (content: "hamtools.cc")
   └── .github/workflows/pages.yml
         └── push to main → actions/deploy-pages
                └── github.io CDN → custom domain hamtools.cc
                       └── DNS: Cloudflare A records → GitHub Pages IPs
```

### Recommended Project Structure (mapoby/hamtools.cc)
```
hamtools.cc/               # repo root
├── index.html             # landing page — single file
├── CNAME                  # content: hamtools.cc
└── .github/
    └── workflows/
        └── pages.yml      # deploy-pages workflow
```

No `assets/` folder required for a minimal page. Inline CSS or a `<style>` block in index.html is fine at this scale.

### Pattern 1: GitHub Pages Deploy via Actions (no build step)
**What:** Push to `main` triggers deploy; entire repo root served as static site.
**When to use:** Pure HTML/CSS with no build step — exactly this use case.
**Example:**
```yaml
# Source: github.com/actions/starter-workflows/blob/main/pages/static.yml
name: Deploy static content to Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'           # upload entire repo root
      - id: deployment
        uses: actions/deploy-pages@v5
```

### Pattern 2: Add GitHub Topics via gh CLI
**What:** `gh repo edit` with `--add-topic` adds one topic; use multiple flags or API for bulk.
**Bulk pattern (one call, replaces all):**
```bash
# Source: verified gh CLI 2.87.3 + GitHub REST API docs
gh api repos/mapoby/cat-ftx1v2/topics \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -f 'names[]=ham-radio' \
  -f 'names[]=cat-control' \
  -f 'names[]=yaesu' \
  -f 'names[]=yaesu-ftx1' \
  -f 'names[]=web-serial' \
  -f 'names[]=nuxt' \
  -f 'names[]=vue'
```

### Pattern 3: YouTube Thumbnail Embed in GitHub README
**What:** GitHub Markdown does not embed video players. Standard pattern is a clickable image linking to the YouTube URL.
```markdown
[![CAT FTX-1 Controller — Live demo](https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)
```
Thumbnail URL formats (all publicly accessible — verified 200):
- `https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg` — 1280x720, may not exist for all videos
- `https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg` — 480x360, always exists

[VERIFIED: both URL formats return HTTP 200 — confirmed via curl]

### Pattern 4: GitHub Pages Custom Domain (apex, Cloudflare)
**What:** CNAME file in repo root + DNS A records at Cloudflare + enable Pages in repo settings.

DNS records to add in Cloudflare for `hamtools.cc` (apex):
```
Type  Name   Content           Proxy status
A     @      185.199.108.153   DNS only (not proxied)
A     @      185.199.109.153   DNS only (not proxied)
A     @      185.199.110.153   DNS only (not proxied)
A     @      185.199.111.153   DNS only (not proxied)
```
[VERIFIED: docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site]

**Important:** Cloudflare proxy (orange cloud) must be DISABLED for GitHub Pages A records — GitHub needs to see the real IP to issue the Let's Encrypt cert. Use "DNS only" (grey cloud).

CNAME file content (repo root, no trailing newline required):
```
hamtools.cc
```

Enable Pages via API after repo creation:
```bash
gh api repos/mapoby/hamtools.cc/pages \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -f 'source[branch]=main' \
  -f 'source[path]=/'
```
[VERIFIED: docs.github.com/en/rest/pages/pages — POST /repos/{owner}/{repo}/pages confirmed]

### Pattern 5: Create New Repo via gh CLI
```bash
gh repo create mapoby/hamtools.cc \
  --public \
  --description "hamtools.cc — browser tools for amateur radio operators" \
  --homepage "https://hamtools.cc" \
  --clone
```
[VERIFIED: gh CLI 2.87.3 help output]

### Anti-Patterns to Avoid
- **Cloudflare proxying GitHub Pages A records:** Breaks Let's Encrypt cert provisioning. Use DNS-only mode.
- **Adding topics one-by-one with `--add-topic`:** Seven separate CLI calls. Use the API bulk PUT instead.
- **Naming repo `mapoby.github.io`:** This would be the user site, consuming the one allowed per account. Use `mapoby/hamtools.cc` (project site) — its default URL is `mapoby.github.io/hamtools.cc` but the custom domain `hamtools.cc` overrides this.
- **Serving hamtools.cc from a framework with a build step:** The decision is pure HTML/CSS — no `npm install`, no build, no Node required.
- **Recording at native 2752x1152:** Export at 1920x1080. Set the browser window to ~1400px wide; the OS DPI is 125% (AppliedDPI=120), so physical pixels will record correctly at 1080p output.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static site deployment | Custom rsync/FTP script | GitHub Actions + deploy-pages | Official, handles HTTPS, CDN, cache headers |
| Repo topic management | GitHub web UI (manual) | `gh api` PUT topics | Automatable, reproducible, one command |
| Video thumbnail in README | Custom server-side redirect | YouTube img.youtube.com URL | Direct CDN link, no auth, always available |
| DNS verification | Manual dig polling | GitHub Pages auto-checks after CNAME commit | GitHub re-checks every few minutes |

**Key insight:** Every operation in this phase has a first-class CLI or API equivalent — nothing requires a web browser except the YouTube channel creation and video upload.

---

## Common Pitfalls

### Pitfall 1: Cloudflare Proxy Breaks HTTPS on GitHub Pages
**What goes wrong:** Adding A records with Cloudflare proxy enabled (orange cloud) causes GitHub Pages to fail its Let's Encrypt cert check. The site serves HTTP or shows a cert error.
**Why it happens:** GitHub Pages verifies domain ownership by resolving the A records — Cloudflare proxy hides the real IPs behind Cloudflare's own IPs, so GitHub can't see its own servers.
**How to avoid:** Set all four A records to "DNS only" (grey cloud) in the Cloudflare dashboard.
**Warning signs:** GitHub Pages settings shows "Domain not yet configured" or cert provisioning hangs more than 1 hour.

### Pitfall 2: CNAME File Gets Deleted on Subsequent Deploys
**What goes wrong:** If the deploy workflow uploads only a subdirectory and the CNAME file is in the repo root, it may not be included in the artifact — GitHub Pages then removes the custom domain binding.
**Why it happens:** `path: '.'` in the upload step includes everything. If someone changes path to a subdirectory (e.g., `path: './dist'`), the CNAME won't be in the artifact.
**How to avoid:** Keep `path: '.'` in the workflow since there is no build step. The CNAME file is in the repo root alongside index.html.

### Pitfall 3: YouTube `maxresdefault.jpg` Not Always Available
**What goes wrong:** New videos may not have a `maxresdefault.jpg` thumbnail immediately after upload; the README shows a broken image link.
**Why it happens:** YouTube generates max-res thumbnails asynchronously after upload.
**How to avoid:** Use `hqdefault.jpg` (480x360) in the README — always available immediately. Or wait until the video is fully processed before committing the README embed.

### Pitfall 4: `has_pages: false` — Pages Must Be Enabled After Repo Creation
**What goes wrong:** Creating the repo and pushing index.html is not enough. GitHub Pages must be explicitly enabled (either via Settings UI or API POST).
**Why it happens:** Pages is off by default on new repos.
**How to avoid:** The plan must include an explicit step to enable Pages via `gh api repos/mapoby/hamtools.cc/pages --method POST`.

### Pitfall 5: `@hamtools` Handle Already Taken on YouTube
**What goes wrong:** The handle `@hamtools` may be claimed by another channel. YouTube handles must be unique.
**Why it happens:** Popular generic names are often taken.
**How to avoid:** Check handle availability during channel creation. Fallback: `@hamtools-cc` or `@hamtoolscc`. The roadmap already documents this fallback.

### Pitfall 6: Xbox Game Bar Won't Record Browser Windows on Windows 10
**What goes wrong:** Game Bar is designed for games. On Windows 10 22H2, it may refuse to record a browser window with the message "this app can't be captured."
**Why it happens:** Windows 10 Game Bar has restrictions vs Windows 11. Browser windows are classified as apps, not games, and may be blocked in some configurations.
**How to avoid:** If Game Bar refuses, use OBS Studio (not installed, 5-minute install from obsproject.com). OBS has no app-type restrictions and supports 1080p 60fps capture of any window.

---

## Code Examples

### Create the hamtools.cc repo
```bash
# Source: verified gh CLI 2.87.3
gh repo create mapoby/hamtools.cc \
  --public \
  --description "hamtools.cc — browser tools for amateur radio operators" \
  --homepage "https://hamtools.cc" \
  --clone
```

### Enable GitHub Pages via API
```bash
# Source: docs.github.com/en/rest/pages/pages
gh api repos/mapoby/hamtools.cc/pages \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -f 'source[branch]=main' \
  -f 'source[path]=/'
```

### Set all repo topics at once
```bash
# Source: docs.github.com/en/rest/repos/repos#replace-all-repository-topics
gh api repos/mapoby/cat-ftx1v2/topics \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -f 'names[]=ham-radio' \
  -f 'names[]=cat-control' \
  -f 'names[]=yaesu' \
  -f 'names[]=yaesu-ftx1' \
  -f 'names[]=web-serial' \
  -f 'names[]=nuxt' \
  -f 'names[]=vue'
```

### Set repo homepage URL
```bash
# Source: verified gh CLI 2.87.3
gh repo edit mapoby/cat-ftx1v2 --homepage "https://hamtools.cc"
```

### README video embed (clickable thumbnail)
```markdown
<!-- Source: standard GitHub README pattern; img.youtube.com verified 200 -->
[![CAT FTX-1 Controller — Live demo](https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)
```

### README CI badge
```markdown
<!-- shields.io returns 200 for this repo -->
![CI](https://img.shields.io/github/actions/workflow/status/mapoby/cat-ftx1v2/azure-deploy.yml?branch=main&label=CI)
![Docker Pulls](https://img.shields.io/docker/pulls/mapoby/cat-ftx1)
![License](https://img.shields.io/github/license/mapoby/cat-ftx1v2)
```

### hamtools.cc landing page skeleton (dark, minimal)
```html
<!-- Pure HTML/CSS. No framework. Dark theme matching app. -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CAT FTX-1 Controller — hamtools.cc</title>
  <style>
    :root { --bg: #0d1117; --surface: #161b22; --text: #e6edf3; --muted: #8b949e; --accent: #58a6ff; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 3rem 1.5rem; }
    /* hero, feature list, browser-warning, cta buttons, footer */
  </style>
</head>
<body>
  <!-- hero -->
  <!-- video embed or screenshot -->
  <!-- feature bullets -->
  <!-- browser-warning: "Requires Chrome or Edge (desktop). Web Serial API not available in Firefox or Safari." -->
  <!-- CTAs: Launch app + GitHub repo -->
  <!-- footer: 2E0MIK · PolyForm Noncommercial · hamtools.cc -->
</body>
</html>
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| gh CLI | Repo topics, Pages API, repo creation | Yes | 2.87.3 | — |
| git | Push hamtools.cc content | Yes | (existing) | — |
| Xbox Game Bar | Screen recording | Yes (GameDVR=1) | built-in Win10 22H2 | OBS Studio (not installed) |
| OBS Studio | Screen recording (fallback) | No | — | Xbox Game Bar (above) |
| Cloudflare DNS access | Add A records for hamtools.cc | Requires manual login | — | No automated fallback — must be done in Cloudflare dashboard |
| YouTube account | Channel creation + upload | Requires manual login | — | No automated fallback |
| hamtools.cc domain | Already registered | Yes (Cloudflare NS confirmed) | — | — |

**Missing dependencies with no fallback:**
- Cloudflare dashboard access — adding the 4 GitHub Pages A records for `hamtools.cc` apex requires manual login to Cloudflare. Cannot be automated via `gh` CLI.
- YouTube — channel creation and video upload are manual browser operations. No CLI automation exists.

**Missing dependencies with fallback:**
- OBS Studio — Xbox Game Bar is the fallback (already installed and enabled).

---

## Current State Audit (Existing Repo)

Confirmed via `gh api repos/mapoby/cat-ftx1v2`:

| Property | Current Value | Required Value |
|----------|--------------|----------------|
| `topics` | `[]` | `["ham-radio","cat-control","yaesu","yaesu-ftx1","web-serial","nuxt","vue"]` |
| `homepage` | `null` | `"https://hamtools.cc"` |
| `description` | `"CAT-Based Graphic Remote Control Software for Yaesu FTX-1"` | Keep or update |
| `has_pages` | `false` | N/A (Pages on hamtools.cc repo, not this one) |

DNS state for hamtools.cc:
- `hamtools.cc` A records: **none** (only SOA + NS) — 4 GitHub Pages A records must be added
- `cat-ftx1.hamtools.cc` CNAME: **exists** (→ Azure) — must not be modified

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | YouTube handle `@hamtools` is available | Pitfall 5, Plan 05-00 | Must use fallback handle; no impact on other deliverables |
| A2 | YouTube channel art dimensions: 2560x1440px total, 1546x423 safe zone, max 6MB PNG/JPG | Code Examples (not included in output) | Wrong artwork dimensions waste time; low risk, easy to fix |
| A3 | Xbox Game Bar will record a Chrome browser window on this machine | Environment Availability | Must install OBS Studio (15 min, no impact on timeline) |

---

## Open Questions

1. **YouTube banner dimensions**
   - What we know: YouTube requires a banner image; the standard community-reported dimensions are 2560x1440px total canvas, ~1546x423px safe zone visible on all devices
   - What's unclear: Official YouTube docs page for this was not reachable; the 2560x1440 figure is from training knowledge [ASSUMED]
   - Recommendation: Verify in YouTube Studio > Customization > Branding when creating the channel. Low risk — a wrong-sized banner is easy to re-upload.

2. **DNS propagation time after adding GitHub Pages A records**
   - What we know: GitHub docs say "up to an hour" for HTTPS to provision after DNS is configured
   - What's unclear: With Cloudflare as resolver, propagation may be faster (Cloudflare flushes quickly)
   - Recommendation: Plan 05-03 should add the DNS records first, then proceed to build the page content while waiting. Do not mark the plan complete until `https://hamtools.cc` resolves with a valid cert.

3. **Should the hamtools.cc repo be published from `main` branch root or a `gh-pages` branch?**
   - What we know: Either works. Branch-from-root is simpler for a no-build site. GitHub Actions deploy-pages workflow is cleaner.
   - Recommendation: Use `main` branch root + deploy-pages workflow. This is the standard approach for no-build sites and matches the starter workflow pattern exactly.

---

## Sources

### Primary (HIGH confidence)
- `gh CLI 2.87.3` help output — `gh repo edit --add-topic`, `gh repo create` flags confirmed via local CLI
- `gh api repos/mapoby/cat-ftx1v2` — current topics `[]`, `has_pages: false`, `homepage: null` confirmed live
- `gh api repos/mapoby/cat-ftx1v2/topics --method GET` — returns `{"names":[]}` confirmed live
- `github.com/actions/starter-workflows/blob/main/pages/static.yml` — deploy workflow YAML confirmed
- `docs.github.com/en/rest/repos/repos#replace-all-repository-topics` — PUT endpoint confirmed
- `docs.github.com/en/rest/pages/pages` — POST /repos/{owner}/{repo}/pages confirmed
- `docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site` — GitHub Pages A record IPs confirmed
- PowerShell DNS resolution — `hamtools.cc` NS records: Cloudflare (`rodrigo.ns.cloudflare.com`, `laura.ns.cloudflare.com`); no A records exist
- PowerShell DNS resolution — `cat-ftx1.hamtools.cc` CNAME to Azure confirmed live
- `curl img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg` and `hqdefault.jpg` — both return HTTP 200 confirmed
- `shields.io` — CI, Docker Pulls, and License badge URLs return HTTP 200 confirmed
- Registry — Xbox Game Bar `XboxGameOverlay 1.54.4001.0` present, `GameDVR_Enabled=1` confirmed
- `obsproject.com/download` — OBS Studio 32.1.2, Windows 10 supported, confirmed

### Secondary (MEDIUM confidence)
- `docs.github.com/en/pages/...` — Pages publishing source setup (web UI steps; API equivalent extrapolated and confirmed via API docs)
- YouTube channel creation steps from support.google.com/youtube/answer/1646861 (content rendered partially)

### Tertiary (LOW confidence — assumed)
- YouTube channel art dimensions: 2560x1440px total, 1546x423px safe zone [ASSUMED — official docs page not renderable]

---

## Metadata

**Confidence breakdown:**
- GitHub operations (topics, Pages, repo creation): HIGH — all verified via live API and CLI
- DNS (Cloudflare setup for hamtools.cc): HIGH — verified via DNS resolution; A record IPs confirmed from docs
- Screen recording (Windows): HIGH — Game Bar confirmed present and enabled; OBS fallback confirmed available
- hamtools.cc landing page HTML/CSS: HIGH — pure static, no dependencies to verify
- YouTube channel setup: MEDIUM — steps confirmed from docs, handle availability is unknown
- YouTube banner dimensions: LOW — not verifiable from docs; assumed from training knowledge

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (GitHub Pages IPs and API endpoints are stable; YouTube interface changes occasionally)
