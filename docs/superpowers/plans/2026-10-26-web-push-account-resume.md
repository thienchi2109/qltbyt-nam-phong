# Web Push Account Resume Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Preserve per-account opt-in and restore only the current account's Web Push after account switching.

**Architecture:** Extend the existing browser lifecycle and deduplicated registration path. Persist opt-in independently from revocation; drive bounded, cancellable restore from the authenticated owner lifecycle. Preserve server ownership checks and local isolation.

**Tech Stack:** Next.js, React, browser Push API/localStorage, existing Vitest/jsdom. No new dependency or SQL.

## Chunk 1: Browser lifecycle change

### Task 1: Remember consent and restore the active owner

**Files:** Existing `src/lib/web-push/browser-lifecycle.ts`, `src/providers/session-provider.tsx`, `src/app/(app)/notifications/NotificationsPushOptIn.tsx`, and its lifecycle module; extract a narrowly scoped shared browser module only when required for reuse/file ceilings. Existing tests under these modules plus focused regression tests. Originating contract: `docs/superpowers/specs/2026-10-26-web-push-account-resume-design.md`.

- [x] Add valuable failing regressions for A → B → A restoration, disable/cancel and forced-password-change cleanup remaining off after return/reload, legacy ambiguous `revoking` not becoming consent, no automatic permission prompt, and failed restore retaining retry intent with a visible reconnect action. Assert that invoking reconnect with permission already granted skips another native permission prompt. Owner-change races must assert owner-bound deferred cleanup and that a late stale registration cannot leave a receiving endpoint. Execute and record RED before implementation.
- [x] Implement the smallest shared consent/restore behavior using existing registration, validation, cleanup, deduplication, and pending states. Do not copy registration/network helpers or couple shared lib code to an app route.
- [x] Run focused tests to GREEN, then simplify the diff and review owner/revision/abort boundaries.
- [x] Run formatting, no-explicit-any, diff-only dedupe, typecheck, focused tests, and React Doctor in repository order through one context-mode batch.
- [x] Obtain independent spec and code-quality review against base `8859e3c322771ce15732061c816f20faa6195416`; fix valid findings and rerun affected checks.
- [ ] Commit and push the isolated feature branch with hooks enabled. Leave production deployment and iPhone real-device verification explicitly pending.

## Verification and handoff

The A → B → A regression failed before the change and passes afterward. Final affected suites: 120 tests passed, one guarded worker integration test skipped. Formatting, no-explicit-any, diff-only dedupe, full incremental typecheck, browser import boundary, and strict OpenSpec validation passed. Typecheck used a process-local 768 MiB heap after reclaiming idle local analysis tools; no system Node/runtime or application configuration changed. React Doctor scanned 12 changed files and scored 93/100 with no findings. Independent spec and code-quality reviews approved after retry fixes.

Shared registration was extracted, not copied: manual opt-in and authenticated account restoration use the same validation, request single-flight and owner-bound cleanup. Ambiguous legacy revoking records do not gain automatic opt-in and may need one explicit enable action. Actual iPhone Safari PWA verification remains tracked in [issue #1008](https://github.com/thienchi2109/qltbyt-nam-phong/issues/1008). No live writes, notification sends, worker changes, or deployment were performed.
