# Issue #388 Login Page Static Assets TDD Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore login-page public assets and PWA public files for unauthenticated visitors without weakening auth protection on real app routes.

**Architecture:** Narrow the fix to the middleware matcher in `src/middleware.ts`, keeping the auth redirect logic unchanged while broadening the matcher exclusions for obvious public static assets. Cover the regression with matcher-focused Vitest cases first, then clean up the mislabeled login illustration asset so the file name and content type agree.

**Tech Stack:** Next.js 15 App Router, NextAuth middleware, Vitest, TypeScript, React Doctor

---

## Summary

- Root cause matches Issue #388: `src/middleware.ts` protects too broadly after #369, so unauthenticated requests for public-root assets like `/Logo master.png` and `/login-illustration.webp` are redirected to `/`.
- This also breaks the `/_next/image` optimizer's internal upstream fetch path, plus public PWA paths like `/sw.js`, `/icons/*`, and `/screenshots/*`.
- Blast radius is narrow in code and broad in anonymous UX:
  - Direct edit set: `src/middleware.ts`, `src/__tests__/middleware.auth-gate.test.ts`, `src/app/_components/LoginIllustrationPanel.tsx`, and the login illustration file in `public/`
  - Affected behavior: login logo, login illustration, service worker registration, and manifest-driven icons/screenshots
  - Must not regress: protected app routes like `/dashboard`, `/equipment`, `/reports`
- Chosen scope: fix the matcher generically for current and future public static assets, and fold the login illustration asset cleanup into the same issue.

## File Map

- Modify: `src/middleware.ts`
  - Broaden public-asset exclusions while preserving protected-route coverage and current auth redirect logic.
- Modify: `src/__tests__/middleware.auth-gate.test.ts`
  - Add RED/GREEN matcher assertions for current broken asset paths and one generic file-extension case.
- Modify: `src/app/_components/LoginIllustrationPanel.tsx`
  - Update the illustration path to the corrected filename.
- Replace/rename: `public/login-illustration.webp`
  - Make filename and actual file type consistent.

## Task 1: Lock the regression with matcher tests

**Files:**
- Modify: `src/__tests__/middleware.auth-gate.test.ts`
- Read for reference: `src/middleware.ts`, `public/manifest.json`

- [ ] **Step 1: Extend `publicPaths` with the broken anonymous asset routes**

Add matcher exclusion coverage for:

- `/Logo master.png`
- `/login-illustration.png` (the post-Task-3 corrected path)
- `/sw.js`
- `/workbox-runtime.js` (future-proofing; serwist may emit helper chunks on upgrade)
- `/icons/icon-192x192.png`
- `/icons/icon-maskable-512x512.png`
- `/screenshots/placeholder-mobile.png`
- `/_next/data/abc/dashboard.json` (pin the broader `_next` prefix, not just `_next/static`/`_next/image`)
- `/robots.txt`
- `/sitemap.xml`

- [ ] **Step 2: Add generic extension-based public-path assertions**

Add representative nested paths so the matcher cannot silently regress to today's fixed filenames only:

- `/some/nested/example.webp`
- `/deeply/nested/path/with.dots/resource.svg`

- [ ] **Step 3: Keep protected-path assertions unchanged**

Do not weaken coverage for:

- `/dashboard`
- `/equipment/123`
- `/repair-requests/new`
- `/reports`

- [ ] **Step 4: Run the focused test before implementation**

Run:

```bash
node scripts/npm-run.js run test:run -- src/__tests__/middleware.auth-gate.test.ts
```

Expected:

- the new public-asset matcher assertions fail against the current matcher
- existing protected-path assertions still pass

## Task 2: Fix matcher scope without changing auth behavior

**Files:**
- Modify: `src/middleware.ts`
- Test: `src/__tests__/middleware.auth-gate.test.ts`

- [ ] **Step 1: Replace the narrow exclusion with a broader public-asset exclusion**

Update the matcher so it still protects app routes but skips:

- `api`
- all `/_next/*` (covers `_next/static`, `_next/image`, `_next/data`, and any future `_next/*` segments)
- `favicon.ico`
- `manifest.json`
- `sw.js` and `workbox-*.js`
- public asset folders used by the repo today: `assets`, `icons`, `screenshots`
- explicit extension allow-list, applied at the path tail, for any nested public file:

  ```
  png | jpg | jpeg | webp | svg | gif | ico |
  css | js | map | json | txt | xml |
  woff | woff2 | ttf | otf |
  mp4 | webm | pdf
  ```

  Notes:
  - `.json` is safe to allow because App Router API routes live under `/api/*` (already excluded) and App Router pages never end in `.json`.
  - The allow-list is applied to the pathname tail only. If this tradeoff needs explicit test coverage later, model it with a URL/pathname-based helper instead of passing query strings directly into today's regex-only matcher harness.
  - Tradeoff: any URL whose pathname ends in one of these extensions bypasses middleware. This is safe because Next App Router never matches a route ending in a static-file extension; non-matching extension URLs return 404 from Next's static handler with no app data exposure.

- [ ] **Step 2: Preserve the existing auth contract**

Do not change:

- `authorized: ({ token }) => Boolean(token?.id)`
- redirect target `/`
- `callbackUrl` behavior
- non-production `AUTH_MIDDLEWARE_ENABLED` kill-switch semantics from #369

- [ ] **Step 3: Run the focused matcher test again**

Run:

```bash
node scripts/npm-run.js run test:run -- src/__tests__/middleware.auth-gate.test.ts
```

Expected:

- all matcher tests pass
- protected app-route coverage remains intact

## Task 3: Clean up the login illustration asset

**Files:**
- Modify: `src/app/_components/LoginIllustrationPanel.tsx`
- Replace/rename: `public/login-illustration.webp`

- [ ] **Step 1: Correct the asset filename/content-type mismatch**

The current file named `public/login-illustration.webp` is actually PNG data. Replace or rename it to a `.png` file so the path and bytes agree.

- [ ] **Step 2: Update the component to reference the corrected path**

Change `src/app/_components/LoginIllustrationPanel.tsx` to the corrected illustration filename. Do not change sizing or layout behavior unless needed for the rename.

- [ ] **Step 3: Grep for stale references**

Run:

```bash
rg -n "login-illustration\.webp" src public
```

Expected:

- after Step 2 and before Step 4, the only legitimate remaining hit is inside generated `public/sw.js`
- after Step 4, there are zero hits under `src` and `public`

- [ ] **Step 4: Regenerate the PWA precache manifest**

`public/sw.js` is a generated file (committed to the repo) whose precache manifest hardcodes the asset filename and its content revision hash. After renaming the illustration, regenerate it so the precache manifest and the actual asset name agree:

```bash
node scripts/npm-run.js run build
```

Commit the regenerated `public/sw.js` alongside the rename in the same commit so reviewers and the deployed SW stay in sync.

## Task 4: Verification

**Files:**
- Verify edits in `src/middleware.ts`
- Verify edits in `src/__tests__/middleware.auth-gate.test.ts`
- Verify edits in `src/app/_components/LoginIllustrationPanel.tsx`

- [ ] **Step 1: Run TypeScript safety gate**

Run:

```bash
node scripts/npm-run.js run verify:no-explicit-any
```

Expected: pass

- [ ] **Step 2: Run typecheck**

Run:

```bash
node scripts/npm-run.js run typecheck
```

Expected: pass

- [ ] **Step 3: Run focused middleware regression tests**

Run:

```bash
node scripts/npm-run.js run test:run -- src/__tests__/middleware.auth-gate.test.ts
```

Expected: pass

- [ ] **Step 4: Run React Doctor for the diff**

Run:

```bash
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected: clean scan

- [ ] **Step 5: Manual anonymous smoke verification**

Verify in local dev or preview with no session.

Direct static-file paths (must NOT redirect):

```bash
curl -sI "http://localhost:PORT/Logo%20master.png"            # → HTTP 200, image/png
curl -sI "http://localhost:PORT/login-illustration.png"       # → HTTP 200, image/png
curl -sI "http://localhost:PORT/sw.js"                        # → HTTP 200, application/javascript
curl -sI "http://localhost:PORT/icons/icon-192x192.png"       # → HTTP 200, image/png
```

Next image optimizer paths — this is the actual production failure mode triggered by `fetchInternalImage` in Next 15 routing through middleware. These MUST return real image bytes (not the login-page HTML the optimizer fell back to before the fix):

```bash
curl -sI "http://localhost:PORT/_next/image?url=%2FLogo%20master.png&w=128&q=75"
# → HTTP 200, Content-Type starts with image/

curl -sI "http://localhost:PORT/_next/image?url=%2Flogin-illustration.png&w=640&q=75"
# → HTTP 200, Content-Type starts with image/
```

Protected-route regression check (must STILL redirect):

```bash
curl -sI "http://localhost:PORT/dashboard"
# → HTTP 307, Location: /?callbackUrl=%2Fdashboard
```

UI check: open `/` in an incognito tab and confirm both the CVMEMS logo and the medical illustration render.

## Rollback

Production has no middleware kill switch by design (#363). The `AUTH_MIDDLEWARE_ENABLED=false` flag is intentionally ignored in production and only honored in non-production environments. Therefore:

- **Rollback path in production = revert the PR.** No runtime flag will disable middleware in production.
- If the matcher fix accidentally exposes a real app route (regression test in Task 1 Step 3 should catch this pre-merge), revert and re-plan rather than attempting a runtime flag flip.

## Assumptions And Defaults

- Use a single generic public-asset exclusion strategy rather than enumerating only today's broken files.
- Excluding all `/_next/*` is preferred over separate `/_next/static` and `/_next/image` fragments so future Next internals are not missed.
- Asset cleanup stays intentionally narrow: correct the file name/content mismatch, but do not expand scope into unrelated image optimization work.
- No DB, API, NextAuth callback, or PWA logic changes are part of this issue.
- The matcher's static-file-extension allow-list is a deliberate, documented tradeoff: any pathname ending in one of the listed extensions bypasses middleware. This is acceptable because Next App Router never matches a route ending in a static-file extension, so non-existent extension paths return a Next 404 and cannot leak app data.
- Middleware matchers operate on pathname only; query strings (e.g. `?format=png`) cannot be used to evade protection on a real app route.
- Serwist in this repo currently emits only `public/sw.js` and no `workbox-*.js` runtime helpers. Excluding `workbox-*.js` is future-proofing in case serwist's runtime caching strategy changes; the `.js` extension allow-list would also cover it.
- `public/sw.js` is a generated, committed file. The illustration rename in Task 3 requires `npm run build` (Task 3 Step 4) to refresh its precache manifest; the rename and the regenerated `public/sw.js` belong in the same commit.
