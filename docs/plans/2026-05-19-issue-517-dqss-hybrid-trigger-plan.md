# Issue 517 Phase 4D - DQSS Hybrid Job Trigger

## Decision

Use a hybrid no-cron trigger for Device Quota suggested mapping jobs.

When the user clicks `Gợi ý phân loại`, the web UI creates or reuses a suggestion job, then processes 1-5 chunks per request while the dialog/page remains active. The UI polls job state through that same active session until the job succeeds or fails. Processing stops when the user closes the dialog or leaves the active session.

No Vercel cron is added for this phase. Vercel Hobby cron is still unsuitable for this workflow because the current cron usage/pricing documentation limits Hobby cron to once per day with hourly precision:

- https://vercel.com/docs/cron-jobs/usage-and-pricing

The existing synchronous `/api/device-quota/mapping/suggest` path remains as the explicit opt-out fallback when async suggestion jobs are disabled with `NEXT_PUBLIC_DEVICE_QUOTA_SUGGESTION_ASYNC_JOBS=false`.

## UX Contract

- The dialog must enter a processing state immediately after open/click.
- Existing queued or processing jobs must be shown as processing, not as cooldown or an error.
- Progress must use the job's processed unique-name count against total unique names when available.
- Copy must be honest: processing continues while this dialog/session is active.
- Failed jobs must show a safe actionable error and expose a retry action.
- The grouped review and save flow remains unchanged after suggestions are ready.

## Implementation Scope

- Add `POST /api/device-quota/mapping/suggest/jobs/[jobId]/process`.
- Process 1-5 chunks per request, with the exact limit determined by request parameters or defaults.
- Verify the current user can read the target job before processing its chunks.
- Do not add scheduler, cron, or new persistence schema unless existing job/chunk records cannot support job-scoped selection.
- Keep DQSS provider/ranking behavior unchanged.

## Verification

- TDD first for route, service, hook, and dialog behavior.
- Required gates for TypeScript/React diffs:
  - `node scripts/npm-run.js run verify:no-explicit-any`
  - `node scripts/npm-run.js run verify:dedupe`
  - `node scripts/npm-run.js run typecheck`
  - focused Vitest for affected hook/dialog/routes/services
  - React Doctor diff against `main`
  - `next build` if route/UI changes remain non-trivial
