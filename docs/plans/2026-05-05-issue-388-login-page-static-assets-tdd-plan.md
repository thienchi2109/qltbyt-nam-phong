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
- `/login-illustration.png` (or the final corrected path chosen during implementation)
- `/sw.js`
- `/icons/icon-192x192.png`
- `/screenshots/placeholder-mobile.png`

- [ ] **Step 2: Add one generic extension-based public-path assertion**

Add a representative path such as `/foo/bar/example.webp` or `/foo/bar/example.png` so the matcher cannot silently regress back to today's fixed filenames only.

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
- all `/_next/*`
- `favicon.ico`
- `manifest.json`
- `sw.js`
- public asset folders used by the repo today: `assets`, `icons`, `screenshots`
- common static file extensions at root or nested paths so future public files do not require another matcher edit

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

- [ ] **Step 3: Sanity-check references**

Confirm there are no remaining repo references to the old `.webp` path after the update.

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

Verify in local dev or preview with no session:

- `/` renders both the logo and illustration
- direct GET for `/Logo master.png` returns image bytes, not a redirect
- direct GET for the corrected illustration path returns image bytes, not a redirect
- direct GET for `/sw.js` and one `/icons/*` path returns asset content, not a redirect
- `/dashboard` still redirects to `/?callbackUrl=...`

## Assumptions And Defaults

- Use a single generic public-asset exclusion strategy rather than enumerating only today's broken files.
- Excluding all `/_next/*` is preferred over separate `/_next/static` and `/_next/image` fragments so future Next internals are not missed.
- Asset cleanup stays intentionally narrow: correct the file name/content mismatch, but do not expand scope into unrelated image optimization work.
- No DB, API, NextAuth callback, or PWA logic changes are part of this issue.
