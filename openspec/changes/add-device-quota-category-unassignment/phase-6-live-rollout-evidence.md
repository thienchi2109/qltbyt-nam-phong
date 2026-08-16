# Phase 6 Live Rollout Evidence

## Checkpoint

- Phase base: `bc61d55094ec8449e0100558008b883f08120677`
- Live Supabase project: `cdthersvldpnlbvpufrr`
- Approved local migration:
  `20260815105027_harden_device_quota_unlink_contract.sql`
- Applied migration version: `20260816044031`
- Applied migration name: `harden_device_quota_unlink_contract`
- Production mutation permission: not requested or granted
- Production unlink mutations performed by this rollout: none

The maintainer explicitly approved the named live migration on August 16, 2026.
That approval was treated as migration-only and did not authorize a production
unlink smoke.

## Live Backend Verification

The migration was applied through Supabase MCP before the frontend landed.
Read-only catalog checks then confirmed:

- exactly one `dinh_muc_thiet_bi_unlink` overload remains;
- the remaining signature is
  `dinh_muc_thiet_bi_unlink(bigint[],bigint,bigint)`;
- the unsafe two-argument overload is absent;
- the function is `SECURITY DEFINER` with
  `search_path = public, pg_temp`;
- `anon` and `public` cannot execute it, while `authenticated` can;
- missing-role, missing-user, write-role, category-tenant, equipment-tenant, and
  expected-category guards are present;
- the deployed definition inserts the confirmed affected IDs into
  `thiet_bi_nhom_audit_log` with `previous_nhom_id` metadata.

Supabase security and performance advisors ran after the migration. They returned
project-wide baseline notices, including the expected lint class for authenticated
access to guarded `SECURITY DEFINER` RPCs. The migration did not introduce a
mutable search path, broad `anon`/`public` execution, a table, or an index change.

## Frontend Landing

- PR: `#930`
- Merge method: squash
- Landed commit: `eeba80af376a656b9ce697c23d51e1659ed970b5`
- Merged at: `2026-08-16T04:45:28Z`
- Production deployment:
  `dpl_5JmkZz3QjMvZ2obaVR6RysKgThKA`
- Production deployment state: `READY`
- Vercel commit status completed successfully at
  `2026-08-16T04:46:45Z`.

GitGuardian, SonarCloud, Vercel deployment, and Vercel preview checks passed.
CodeRabbit reported success with its repository-specific review skip. Cubic
remained pending without a finding; `main` had no branch protection requiring
that external check, and the required custom Phase 5 reviewer had already
returned `Zero findings`.

## Production Observation

The maintainer explicitly waived browser testing on August 16, 2026. No
authenticated UI smoke and no production unlink mutation were performed.

The post-deployment Supabase API sample showed normal HTTP 200 RPC traffic.
Postgres logs showed the successful migration statement and normal application
activity without an unlink-related error. Because no unlink action was exercised,
the production window cannot provide evidence about stale-state feedback or
duplicate unlink requests; repository integration tests remain the evidence for
those contracts.

## Issue And Rollback State

- Wayfinder map `#928`: closed
- Decision `#929`: closed
- Implementation PR `#930`: merged
- Remaining issue-owned work: none identified

Rollback removes or hides the frontend action first. Database compatibility
rollback must use a new guarded forward migration; live migration history and
metadata must not be edited manually.

## Final Review

The Phase 6 closeout commit is reviewed from fixed base
`bc61d55094ec8449e0100558008b883f08120677`. The exact final reviewer result and
reviewed commit are recorded after the required independent review completes.
