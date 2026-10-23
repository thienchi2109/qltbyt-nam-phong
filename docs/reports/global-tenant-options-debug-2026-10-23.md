# Global/admin tenant options regression — 2026-10-23

Status: **LIVE APPLY / READ-BACK PASS under explicit owner-approved gate bypass; qltbyt_test catch-up PASS. Formal DB Gate INCOMPLETE.**

Source inspected: `edaca7fab41ba8835777718092e5f7c45466dc55`. Two read-only scouts used `gpt-6-luna` with `max` reasoning. The owner subsequently approved writing the repair migration. No application code or applied migration was edited.

## Root cause

`public.get_facilities_with_equipment_count(text)` uses `tb.nguon_kinh_phi` in its global-branch count subquery, but that subquery declares only `FROM public.thiet_bi`, without alias `tb`.

- Broken source: `supabase/migrations/20261014120000_equipment_dataset_scope.sql:2582–2583`.
- Introduced by `502a50a039c52f42860aaca2cbf926a60ce60ccf` (`feat: add server equipment dataset scope`, October 14).
- Activated for the shared selector by `6c64d79251ee51588257e634c70069d76e80fe41` (`fix: exclude placed equipment from reports and exports`, October 15), which changed its arguments from `{}` to `{ p_equipment_dataset: "regular" }`.
- The October 21 usage-log fix, October 22 Excel-export fix, and October 23 Temperature Monitoring scope fix do not modify this function or the shared selector call.

PostgreSQL returns `42P01: missing FROM-clause entry for table "tb"`. This happens for all three valid datasets, including `all`: PostgreSQL must resolve the column reference before evaluating the OR predicate.

## Why the roles differ

1. `src/auth/server-claims.ts` correctly normalizes raw `admin` to the `global` app-role claim. Both accounts reach the broken global SQL branch.
2. `TenantSelectionContext.tsx:107–125` requests the dataset overload and defaults an unsuccessful query's facilities to `[]`.
3. `TenantSelectionContext.tsx:131–139` blocks privileged users' data requests until they have a selection. With no saved selection and no facility options, the gate stays closed.
4. `to_qltb` does not use the multi-tenant selector and can fetch immediately after authentication. The server still enforces its tenant claim.

A previously saved facility or explicit “all facilities” selection can keep the fetch gate open even when the options RPC fails. The proven failure is the facility list and the resulting gate for an unresolved selection, not every data RPC for every session.

Reports and the unified inventory chart also call this RPC directly. The shared tenant-selection gate is consumed by Equipment, Reports, Repair Requests, Transfers, and Maintenance. Code Review Graph was refreshed to the inspected HEAD. GitNexus remained at `8394991a`; the narrowed source/caller search was verified with text search rather than treating that stale index as current evidence.

## Reproduction and test evidence

New runnable SQL regression: `supabase/tests/facility_options_dataset_behavior.sql`.

```bash
psql "$DISPOSABLE_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -f supabase/tests/facility_options_dataset_behavior.sql
```

The test uses a read-only transaction and local JWT claims, executes the actual RPC for `regular`, `placed`, and `all`, and compares options/counts to the source tables. It does not mock or duplicate the RPC implementation.

| Check                                                          | Observed result                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Live catalog inspection through Supabase MCP                   | Dataset overload exists; zero defaults; caller supplies its required argument |
| Live read-only EXPLAIN of the broken global subquery           | `42P01`, missing alias `tb`                                                   |
| Local disposable PostgreSQL 17 with the source function/helper | RED for all three valid datasets; psql exit 3                                 |
| Oracle disposable clone of `qltbyt_test`                       | Same three RED failures; psql exit 3                                          |
| Global legacy zero-argument RPC on Oracle clone                | PASS, 28 facilities                                                           |
| `to_qltb` dataset RPC on Oracle clone                          | PASS, one permitted facility                                                  |
| Existing admin normalization / proxy claims tests              | PASS, two files / 24 tests                                                    |
| Named Oracle clone cleanup                                     | PASS, remaining database count 0                                              |

The faulty dataset function and safe tenant helper have identical `pg_get_functiondef` MD5 values on live and the baseline used for the clone: `ae852a93b90080ef2d32f0cf9ccc3a18` and `aa5a99a85b0164e3304f63f4f5ac2824` respectively. Live inspection was read-only. No authenticated browser smoke has been claimed.

Existing dataset smoke tests check this function's overload/privileges but do not execute its global dataset branch. Existing context tests mock the RPC; that explains why they missed the SQL error.

## Prepared repair and verification

`supabase/migrations/20261023150000_fix_global_facility_options_dataset_alias.sql` replaces the existing dataset overload and adds only the missing `tb` alias to its function definition. It uses `CREATE OR REPLACE`, preserving the existing function's ACL. The applied October 14 migration is unchanged. The regression is registered as mandatory for this migration.

On a fresh clone of the caught-up 397-migration baseline, the unchanged global assertions failed for all three datasets before applying the candidate, then passed for `regular`, `placed`, and `all`. Review added a durable `to_qltb` assertion that its response contains exactly its permitted tenant. The authenticated global RPC returned 28 facilities. The signature, owner, SECURITY DEFINER flag, search_path, ACL, and authenticated `to_qltb` response were checked before/after and remained identical. A source comparison proves the function definition differs only by the intended alias. The clone was removed; remaining count 0. This is **DISPOSABLE ONLY PASS**, not a live fix or aggregate DB Gate PASS.

The user-requested `gpt-6-astra/medium` independent read-only review found no actionable migration, regression, or registry defect. An additional standards review noted the existing lack of a `user_id` claim guard. This behavior predates the alias bug; changing authentication semantics is deferred to a separate hardening task rather than silently broadening this repair. No claim of complete standards/security certification is made.

The preliminary static command `timeout 90s node scripts/npm-run.js run db:quality-gate:local` did not finish and produced no digest-bearing result: **INCOMPLETE**. Exact-commit gate outcomes are recorded separately in the handoff. The known unhealthy baseline state blocks formal baseline-forward certification. The catch-up exception does not waive the repair's gate or authorize live application; that requires separate operation-specific approval through Supabase MCP.

Separate findings, excluded from this minimal repair: the non-global branch counts all funding types despite the dataset argument; Reports/chart facility cache keys omit parts of user scope; and the selector presents an RPC error as an empty result. These need their own scoped tests before changing behavior.

## Oracle baseline maintenance

The owner separately approved an explicit exception for manual catch-up of the 22 migrations already confirmed live, plus the missing date-parser prerequisite, preserving historical metadata and the unhealthy gate state. All 22 source files matched live SQL byte-for-byte before execution. They were first applied to a disposable clone, where all seven registered default-safe Temperature Monitoring suites passed, and then applied to persistent `qltbyt_test` with atomic DDL/metadata transactions and exact SQL hash read-back.

- Migration count: **375 → 397**; high-water: **20261015081559 → 20261023023010**.
- Historical metadata hash, 5,025 equipment rows, and baseline state-file SHA-256 remained unchanged. Invalid indexes and unvalidated constraints remain zero; `postgres` has no residual CREATE privilege on public. Clone removal and lease release were verified.
- The 34 TM function bodies, owners, security modes and search paths match live. Direct EXECUTE grantee lists still differ under the Oracle defaults, including missing implicit service_role grants. No unrelated ACL reconciliation, AI reader-role creation, or full AI schema restoration was performed. These limitations remain formal-gate debt.
- Evidence: `docs/reports/oracle-baseline-manual-catchup-2026-10-23.json`; local operation files: `/root/Oracle/tenant-debug-catchup-20261023/`.

## Authorized live apply and final test catch-up

After reviewing the migration, the owner explicitly authorized bypassing this repair's gate, applying it to live through Supabase MCP, then catching up `qltbyt_test` manually. Source commit: `5d7c58a3d82d5989771dfc371fac0c3386047d22`.

- Live apply succeeded as `20261023150839/fix_global_facility_options_dataset_alias`; migration count **397 → 398**. Stored SQL SHA-256 is `4312b0c5ef387651eb94d02ce23ff2276dc5d643e163beeb419a07b0d53cc428`, matching the reviewed source bytes.
- All four registered read-only behavior checks passed on live: `to_qltb` tenant isolation plus global regular/placed/all options and counts. Owner, signature, SECURITY DEFINER, search_path and ACL remain unchanged; equipment count remains **5,507**. No browser smoke was performed.
- Advisors show no added or removed findings: security **564 → 564**, performance **190 → 190**.
- Manual catch-up applied exactly this now-confirmed live migration to `qltbyt_test`, also **397 → 398**, with high-water **20261023150839**. Exact SQL hash/body read-back and all four read-only behavior checks passed. Historical migration metadata hash, 5,025 equipment rows, ACL, and unhealthy gate-state hash remain unchanged; invalid indexes/unvalidated constraints remain zero; no temporary CREATE privilege remains. The lease was released.
- This is successful authorized live apply and test catch-up, not formal static/baseline-forward certification. No application data was synchronized from live.

Evidence: `docs/reports/global-tenant-options-live-apply-2026-10-23.json`. The original static result remains timeout/exit 124; baseline-forward remains blocked at stale-environment preflight (digest `800e68b73d275b1153d212db9151510a564a10ca7e27fb474d27b6aade813088`).
