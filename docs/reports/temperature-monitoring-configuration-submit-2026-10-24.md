# Temperature configuration save feedback — 2026-10-24

## Observed symptom and evidence

The owner reported that equipment `NHM.2.92004.16-01-R0009`, tenant 17, reopened with monitoring OFF after trying to save, and saw no message. Read-only live inspection identified equipment 3779 with zero configuration rows and zero configuration versions; no successful save had reached this database for that equipment.

An isolated `agent-browser` session authenticated as `ntchi2` reproduced a matching silent failure: checking monitoring and clicking the configuration save button while `reason` was empty caused native HTML validation to block submission. The browser emitted an invalid event for `reason`, the submit handler never ran, no mutation request was created, and the existing status region stayed empty. This demonstrates the missing feedback; it does not establish which fields the owner had entered during the original attempt.

With thresholds, primary staff, and reason supplied, the form produced the expected enable payload for equipment 3779. A page-local fetch guard intercepted every configuration-upsert attempt before network transmission and returned a diagnostic error. The application then displayed its existing failure message. No successful production write was attempted. Post-check confirmed zero configuration/version rows for equipment 3779. The isolated browser session was closed.

The read-only configuration choices response proposed `2026-10-24T17:00:00Z` (00:00 on October 25 in Asia/Ho_Chi_Minh). A saved future version is separate from current effective monitoring state; this patch does not change effective-dating rules.

## Minimal repair

Reuse the configuration hook's existing message state to report native form validation failures through the existing live status region:

> Chưa lưu cấu hình: vui lòng điền các trường bắt buộc, gồm Lý do thay đổi.

The form's `onInvalid` callback reports that message while native validation still blocks invalid saves. Existing drafts, RPC payloads, authorization, server validation, and effective dates are unchanged. No database migration is needed.

The save button now renders the existing `Loader2` icon and `Đang lưu…` label from the existing TanStack mutation's `isPending`, with `aria-busy` and the existing disabled behavior. No loading state, helper, or component was introduced. The existing `useTemperatureMutation` already awaits invalidation of `temperature-monitoring`, the page's `equipment_list_enhanced` prefix, and notification counts; that shared hook remains unchanged.

Code Review Graph/GitNexus plus text search found no existing equivalent inline-feedback handler. `focusTemperatureField` handles custom validity and focus, not a status message for a native invalid event, so it was not reused. No shared helper or dependency was added. Impact analysis rated the hook/component change LOW; the hook's only direct caller is the equipment configuration tab.

## Verification

Base commit: `e655d1be6543037de9232e41f4c7b044fd156313`.

- RED: the added user-click regression failed because the status region was empty after native validation blocked the save.
- GREEN: all three tests in `src/hooks/__tests__/temperature-configuration-selection.test.tsx` pass, including correcting the reason, saving once with the expected equipment/enable payload, and showing success afterward.
- Loading RED → GREEN: `src/hooks/__tests__/temperature-configuration-persistence.test.tsx` uses the real mutation/query hooks, QueryClient, and an active observer for the Equipment page query prefix. It verifies pending feedback, duplicate-save prevention, waiting for the page refetch before success, authoritative cache refresh, and closing/reopening the tab with the server configuration. Its clock advances across the fixture policy's effective boundary; it does not assert that future monitoring is immediately active.
- The final required sequence passed after the loading extension: formatting, `verify:no-explicit-any`, diff-only `verify:dedupe`, typecheck, both focused files (4/4 tests), and React Doctor diff scan (3 files, 100/100, no issues).
- Independent standards/specification review of the expanded patch found no blocking findings. The shared mutation/cache hook was reused unchanged; no extra loading state or component was introduced.
- No live configuration, measurement, or DB definition was modified. No Oracle container/image/service or persistent baseline operation was performed.

The live browser established the original behavior; it did not run the patched frontend. Production deployment of the new feedback is not certified by local tests or a Git push.
