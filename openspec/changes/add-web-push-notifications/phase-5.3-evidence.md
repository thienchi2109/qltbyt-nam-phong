# Chunk 5.3 - Evidence

Updated 2026-09-14 after dynamic diff review.

## Scope

- Frontend/UI only on authenticated `/notifications`.
- Added browser Web Push opt-in with explicit user gesture, permission handling, public key/version consumption, lock-screen preview, and iPhone/iPad Home Screen guidance.
- Reused the existing `/sw.js` registration through `navigator.serviceWorker.ready`; no second worker registration, identity payload, Go/provider call, API/RPC/SQL change, migration, or live operation.
- `tasks.md` remains unchanged; Chunk 5.4 and later remain unchecked.
- Approved Stitch V2 direction: rounded primary panel, one current status, compact lock-screen preview, collapsed iOS guidance.

## Behavioral evidence

- Focused user-event suite: `NotificationsPushOptIn.test.tsx`, 8/8 tests PASS; combined notifications UI suite: 32/32 tests PASS.
- Covered permission/subscription only after click, loading/live feedback, enabled/disabled/error/unsupported/blocked states, denied-permission behavior, server-disabled registration, public key decoding/version payload, existing worker reuse, no client identity field, explicit `key_version_mismatch` resubscribe, lock-screen preview, and iOS/iPadOS guidance.
- Resubscribe behavior unsubscribes the existing browser subscription before creating a new one when the stored/public-key version differs or the server explicitly requires a new key version.

## Repository gates

- `format:check`: PASS
- `verify:no-explicit-any`: PASS
- `verify:dedupe`: PASS (diff-only)
- `typecheck`: PASS
- `react-doctor`: diff-only 84/100 with 3 findings in the new opt-in component (fetch in effect, PushManager subscription cleanup heuristic, and control-flow complexity); full-repository baseline remains 49/100 with 296 existing findings.
- `openspec validate add-web-push-notifications --strict`: PASS

Verification bundle: `/tmp/web-push-53-verification/manifest-v3.txt`, captured
2026-09-14 14:16:25-14:16:54 UTC; every listed command exited 0. The final
focused log is `/tmp/web-push-53-green.log` (SHA-256
`93612aa26d1516c16da685f02c420084a15d9b40c36f522215fc3aa0e9c62dbf`) and
reports 2 files / 31 tests PASS. The opt-in-only log is
`/tmp/web-push-53-green-opt-in.log` (SHA-256
`e47040c9a7fafd7aa1e4a14787ffbff11bd43bdd749c7a62015a464ad4bb314d`) and
reports 1 file / 7 tests PASS. The RED baseline log is
`/tmp/web-push-53-red.log` (SHA-256
`5882d80fa000bf9e6e6e4d769aaafddb11a9efa43128f86ec14985661305fde3`): the
same new opt-in suite ran against `origin/main` and failed 7/7 because the
runtime card and guidance were absent.

The explicit full-repository React Doctor scan used `--scope full` and is
recorded at `/tmp/web-push-53-verification/react-doctor-full-final.log`
(SHA-256 `0f54e0874db6803c518d7a4372e0c7bfce67f63bc5d45e0799631ed7f8f10d4c`):
exit 1, 49/100 with 296 pre-existing repository findings. The diff-only gate
is the scoped PASS above; the full scan is retained as baseline context.

## Limits

- Browser-authenticated/platform matrix was not run; evidence covers DOM/user-event contracts only.
- No live database operation, migration, provider delivery, or DB quality gate was run.
- Dynamic review found and Luna addressed stale-key retry and initial public-key error dead-end; these are covered by the added regression tests.
