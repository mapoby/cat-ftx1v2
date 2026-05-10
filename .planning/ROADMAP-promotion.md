# Roadmap: CAT FTX-1 Controller — Community Launch

**Milestone:** v2 Community Launch
**Granularity:** Coarse
**Goal:** Get the app in front of FTX-1 operators and ham radio developers; build an initial user base that can provide feedback and spread word-of-mouth.

---

## Phases

- [ ] **Phase 5: Launch Assets** - Create the demo video, finalize repo metadata, and publish the hamtools.cc catalog page — the foundation every promotion post links to
- [ ] **Phase 6: Ham Radio Communities** - Post to the core ham radio forums and mailing lists where FTX-1 operators are active
- [ ] **Phase 7: Extended Reach** - Reach Yaesu-specific Facebook groups, developer communities (Show HN, dev.to), and eham.net

---

## Phase Details

### Phase 5: Launch Assets
**Goal**: Every promotion post links to a polished, self-explanatory repo and a live demo video — no user has to ask "what does it do?"
**Depends on**: Nothing (v1 Production Hardening complete)
**Deliverables**:
  1. 60–90 second screen recording hosted on YouTube: connect → live frequency → preset → VFO change
  2. GitHub repo topics added: `ham-radio`, `cat-control`, `yaesu`, `yaesu-ftx1`, `web-serial`, `nuxt`, `vue`
  3. README updated: demo video embed, shields/badges (CI, license, DockerHub pulls), callsign credit
  4. hamtools.cc — dark minimal landing page (GitHub Pages, separate repo `mapoby/hamtools.cc`):
     - Hero: app name + 1-line description
     - Screenshot or embedded YouTube demo
     - Short description + key features bullet list
     - Browser requirement notice (Chrome/Edge only)
     - Two CTAs: Launch app (cat-ftx1.hamtools.cc) + GitHub repo
     - Footer: callsign, license note, link to more apps as catalog grows
     - Custom domain `hamtools.cc` via GitHub Pages CNAME
     - Pure HTML/CSS — no framework, fast, no build step

**Plans**: 4 plans
- [ ] 05-00-PLAN.md — Create YouTube channel (manual prerequisite, do before recording)
- [ ] 05-01-PLAN.md — Record and publish YouTube demo video
- [ ] 05-02-PLAN.md — Add GitHub topics + README badges + video embed (cat-ftx1v2 repo)
- [ ] 05-03-PLAN.md — Build hamtools.cc landing page and deploy to GitHub Pages (new repo)

---

### YouTube Channel Spec

**Channel name**: `hamtools`
- Matches the brand domain (hamtools.cc) — scales as more apps are added
- Searchable by topic, not just by callsign (broader reach beyond UK operators)
- Alternative considered: `2E0MIK` — authentic ham identity but limits discoverability to people who already know the callsign; better as a secondary tag in video descriptions

**Handle**: `@hamtools` (or `@hamtools-cc` if taken)

**Channel description** (About section):
> Open-source browser tools for amateur radio operators. Built by 2E0MIK.
> hamtools.cc

**Channel art / branding**:
- Dark background (#0d1117 — same as app) with `hamtools.cc` wordmark in white
- Subtle radio wave or antenna motif — minimal, not clipart
- No bright colors; consistent with the app's aesthetic

**Profile icon**: stylized "HT" monogram or simple antenna icon, dark background

**Default upload settings**:
- Category: Science & Technology
- Tags on every video: `ham radio`, `amateur radio`, `CAT control`, `yaesu`, name of the radio model
- Language: English (UK)
- License: Creative Commons Attribution (allows embedding and sharing)

**Playlist structure** (set up from day one, even with one video):
- `CAT FTX-1 Controller` — all FTX-1 demos and tutorials
- Future apps each get their own playlist

**Video style for demo recordings**:
- 60–90 seconds, no voiceover — captions only (accessible, no mic required)
- Screen recording at 1080p, browser at ~1400px wide so controls are legible
- Title format: `[App name] — [what it shows]` e.g. `CAT FTX-1 Controller — Live demo`
- Description template:
  ```
  Browser-based CAT controller for the Yaesu FTX-1. No drivers, no backend — just Chrome and a USB cable.

  Try it: https://cat-ftx1.hamtools.cc
  Source: https://github.com/mapoby/cat-ftx1v2
  Requires Chrome or Edge (desktop) — Web Serial API not available in Firefox/Safari.

  #hamradio #amateurradio #yaesu #catcontrol
  ```
- Thumbnail: static screenshot of the UI with the app name overlaid — dark, no stock imagery

### Phase 6: Ham Radio Communities
**Goal**: Posts are live on the three highest-traffic ham radio text forums; early feedback is collected and responded to
**Depends on**: Phase 5 (launch assets must exist before posting)
**Deliverables**:
  1. r/amateurradio post published (problem-first framing, video linked)
  2. QRZ.com Software/Digital forum post published (callsign included, Web Serial limitation addressed upfront)
  3. RSGB Community Forum post published (UK angle, 2E0MIK callsign)
  4. Groups.io Yaesu list announcement sent (plain-text, no hype)
  5. r/hamradio cross-post published (3–5 days after r/amateurradio)

**Plans**: 2 plans
- [ ] 06-01-PLAN.md — Draft and schedule Reddit posts (r/amateurradio + r/hamradio)
- [ ] 06-02-PLAN.md — Draft QRZ, RSGB, and Groups.io posts

### Phase 7: Extended Reach
**Goal**: App is discoverable by Yaesu Facebook group members, Hacker News readers, and frontend developers who are also hams
**Depends on**: Phase 6 (initial feedback absorbed and any rough edges fixed before HN)
**Deliverables**:
  1. Facebook "Yaesu Radio" group post published (video-forward)
  2. eham.net software listing submitted
  3. Show HN post published (Tue–Thu 9–11am ET, Web Serial angle as hook)
  4. dev.to technical article published: "Building a browser-based ham radio controller with Web Serial API"

**Plans**: 3 plans
- [ ] 07-01-PLAN.md — Facebook Yaesu groups + eham.net listing
- [ ] 07-02-PLAN.md — Show HN post
- [ ] 07-03-PLAN.md — dev.to technical article

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Launch Assets | 0/3 | Not started | — |
| 6. Ham Radio Communities | 0/2 | Not started | — |
| 7. Extended Reach | 0/3 | Not started | — |

---

## Key Decisions

- Lead every post with callsign 2E0MIK — signals operator, not marketer
- Web Serial limitation (Chrome/Edge only) must be stated upfront in every post — sets correct expectations
- Wait until Phase 6 feedback is absorbed before Show HN — HN audience is unforgiving of rough edges
- hamtools.cc catalog first — every post needs a landing page beyond the GitHub repo

---
*Roadmap created: 2026-05-10*
