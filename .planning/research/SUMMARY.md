# Research Summary — CAT FTX-1 Production Hardening

**Project:** CAT FTX-1 Controller — Production Hardening
**Domain:** Browser-native hardware serial controller (Chromium-only SPA)
**Researched:** 2026-05-08
**Confidence:** HIGH

## Executive Summary

The app is production-capable but blocked from public release by three compounding problems: zero automated test coverage on the most complex logic in the codebase (30+ CAT frame decoders in `_parseResponse`), several silent data-corruption paths in memory read/write operations, and missing browser-compatibility gates that will confuse non-Chromium users before a single Vue component renders.

All three are solvable with focused, incremental work — no architectural rewrites required.

The prerequisite for all testing work: extract `_parseResponse` into a pure function (`composables/catParser.ts`) that accepts `current: TransceiverState` and returns `Partial<TransceiverState>`. This makes all 30+ decoders testable in a Node environment with zero mocking.

## Stack

**Test tooling (2025):**
- `vitest@^4.1.5` — Vite-native runner; no Jest/Babel needed
- `@vitest/coverage-v8@^4.1.5` — V8 coverage, fast and low-memory
- `@types/w3c-web-serial@^1.0.8` — types for any stub setup files

**Critical config note:** `package.json` has no `"type": "module"` field — add it, or name the vitest config `vitest.config.mts`, or the ES module config will fail.

**Do not use:** Jest, Vitest Browser Mode (500 MB Playwright dep, wrong for parser logic), `test.workspace` config key (deprecated since Vitest 3.2 — use `test.projects`).

## Table Stakes for Public Release

1. Pre-bundle browser-compatibility gate (inline `<script>` before Nuxt bundle; distinguishes wrong browser from HTTP-served page)
2. Named error surface for every command — `?;` and timeouts surfaced with originating command name, not silently dropped
3. Clean disconnect/reconnect — `navigator.serial` event wiring; zero stale state shown after disconnect; no page reload required
4. Per-slot memory write feedback — explicit "Channel 42 written / failed" per slot
5. CSV import validation — freq range, mode code, slot 1–999, tag length; error summary before any rows applied
6. Delete/Wipe protocol disclosure — persistent UI label: "delete = overwrite with blank values, slot number not removed"
7. Scan VFO save/restore — try/finally; TX disabled during scan; radio not left on last-scanned channel after error
8. HTTP vs HTTPS detection — actionable message when secure context missing

## Architecture for Testing

Extract `_parseResponse` verbatim into `composables/catParser.ts`. Change signature from `void` (mutates global state) to `(cmd, params, current: TransceiverState, sourceCmd?) => Partial<TransceiverState>`. Remove `_patch()` call from the function body; caller does `_patch(parseResponse(...))`.

The four decode maps (`MODE_MAP`, `MODE_CODE`, `AGC_MAP`, `FUNC_KNOB`) move with the function. The `FD` async side-effect is lifted into a private `_fireScopeRequery(side)` in `useSerial.ts`.

The diff to `useSerial.ts` is narrow: four constant deletions, one function body replacement, two call-site updates in `_handleResponse`, one new private helper. Zero observable behaviour change.

**`defaultState()` must be exported** from `useSerial.ts` to give tests a valid base state.

**Build order:**
1. Create `composables/catParser.ts` (copy + signature change)
2. Update `composables/useSerial.ts` (import + call sites)
3. Verify `npx tsc --noEmit` clean
4. Install Vitest, write tests
5. Wire `npx vitest run` into CI before Docker build step

**Priority test cases:** `MR` (channel merge, most complex), `MZ` (splitMem guard), `RI` (8-bit field), `CT`/`SH`/`NA`/`SM` (sourceCmd disambiguation), `EX` (prefix dispatch), `VE` (firmware spread).

## Critical Pitfalls

1. **FD side-effect lost during extraction** — must lift `_fireScopeRequery` before closing PR; write a test that confirms `parseResponse('FD', '1...', base())` returns only `{ scopeSide: 1 }`
2. **Unsolicited frames consumed as solicited** — 2-char prefix-only match; fix: disable AI mode (`AI0`) before bulk memory reads, re-enable (`AI1`) after
3. **CTCSS read from global state after async gap** — read return value of `_sendAndWait` directly instead of reading `state.value.mainCtcssTone`
4. **No try/finally in `scanMemoryChannels`** — save VFO before loop; restore in `finally`
5. **ACR admin credentials in Bicep history** — migrate to managed identity in two deploys: assign identity + `AcrPull` + `acrUseManagedIdentityCreds: true` first; remove credential app settings second

## Recommended Phase Structure

| Phase | Name | Key Deliverables |
|-------|------|-----------------|
| 1 | Testing Foundation + Bug Fixes | `catParser.ts` extraction, Vitest, CI, VFO restore, CTCSS race fix, RF/SQL guard fix |
| 2 | Browser Compatibility + Error Surface | Pre-bundle gate, HTTP/HTTPS detection, named errors, disconnect event wiring |
| 3 | Data Integrity — Memory Operations | CSV validation, per-slot write feedback, Delete/Wipe disclosure, slot/tag guards |
| 4 | Infrastructure Hardening | ACR managed identity, lockfile, `npm ci`, CSP header, `magic-regexp` removal |
| 5 | Post-Release Differentiators | Auto-reconnect, persistent status header, busy lockout |

**Research flags:** Phase 3 needs CTCSS/DCS index bounds and clarifier range confirmed against `CAT-FTX1.pdf` before writing validation code. All other phases follow standard patterns.

## Confidence

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified npm 2026-05-08 |
| Features (table stakes) | HIGH | From codebase audit + WICG spec |
| Architecture | HIGH | Extraction derived from reading actual code |
| Pitfalls (serial/Azure) | HIGH | Direct audit + official docs |
| CTCSS/DCS/clarifier bounds | MEDIUM | Needs FTX-1 manual confirmation |

---
*Research completed: 2026-05-08*
