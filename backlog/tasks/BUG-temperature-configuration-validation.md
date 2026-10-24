# BUG — Explain blocked temperature configuration saves

- Status: Done (source fix verified; production deployment not verified)
- Evidence: `docs/reports/temperature-monitoring-configuration-submit-2026-10-24.md`

The configuration form's native required-field validation can prevent submission without updating the application's status message. A user can mistake the checked local draft for a persisted configuration and reopen the dialog to find monitoring OFF.

## Acceptance

- Blocked native validation displays a clear unsaved message mentioning the required change reason.
- The draft remains intact, and correcting the reason permits a normal save and success message.
- Preserve native/server validation, role scope, and future effective dates.
- Reuse the existing TanStack pending state and Loader2 pattern; show saving feedback and prevent duplicate saves through page cache refetch.
- Verify existing invalidation refreshes the Equipment page and configuration queries using a real QueryClient, and reopening uses authoritative server data.
- Keep a user-click regression and pass the repository TypeScript/React checks and independent review.

## Progress

Read-only live/browser reproduction and RED → GREEN regressions completed. The owner requested loading and Equipment-page cache integration using existing facilities. The expanded patch passes all four tests, formatting, no-any, diff-only dedupe, typecheck, React Doctor diff scan (100/100), and renewed independent review without blocking findings. The existing mutation state/cache invalidation and Loader2 pattern are reused. Production deployment of the new frontend has not been verified. The target equipment has not been configured by this investigation.
