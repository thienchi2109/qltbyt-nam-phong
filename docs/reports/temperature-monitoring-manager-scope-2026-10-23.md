# Temperature Monitoring manager scope repair — 2026-10-23

Status: **LIVE APPLY / READ-BACK PASS under explicit DB Gate bypass; formal DB Gate INCOMPLETE.**

Owner authorization on 2026-10-23: integrate the repair, bypass the DB Gate for this batch, and apply exactly the three migrations below sequentially to live through Supabase MCP. This approval does not change the gate results to PASS.

## Problem and intended behavior

`ntchi2` has role `to_qltb`. A read-only live RPC replay rejected same-tenant equipment with SQLSTATE `42501` because Temperature Monitoring also required the equipment department to match the manager's department claim. The Equipment module and `docs/specs/temperature-monitoring.md` require tenant-wide scope for equipment managers.

The configuration choices failure also causes the UI to display its disabled-monitoring fallback. No account, department, or UI change is needed for the permission repair.

## Applied changes

Source commit: `c2f1c9c3b368edd624ed0424cbd8cc94bbd7c38c`, integrated and pushed to `main`; base: `0dacaadacf1458366a6e3f9c6cb07b0f708a772e`. The clean temporary implementation worktree and merged local fix branch were removed after integration.

These new migrations were applied sequentially through Supabase MCP after explicit authorization:

1. `20261023030000_temperature_monitoring_manager_tenant_scope.sql`: shared equipment scope and configuration history.
2. `20261023030100_temperature_monitoring_manager_slot_scope.sql`: slots and workspace scope.
3. `20261023030200_temperature_monitoring_manager_data_scope.sql`: measurement creation, exports, and deviation listing.

`to_qltb` still requires the equipment's tenant. Other non-global roles retain their department restrictions and action permissions. Staff assignment still requires the target equipment's tenant and department. Global/admin behavior, row locks, pagination, capture-time checks, and audit behavior are preserved. Existing applied migration files are unchanged.

Review identified a pre-existing missing-role/user guard in configuration history. The repaired function delegates to the shared scope helper; an added regression proves missing identity claims are denied.

## Live verification

| Local migration timestamp | Recorded live version |
| ------------------------- | --------------------- |
| `20261023030000`          | `20261023022933`      |
| `20261023030100`          | `20261023022954`      |
| `20261023030200`          | `20261023023010`      |

- All three MCP apply calls succeeded. Exact SQL read-back matched the landed files. Migration history increased from 394 to 397 and preserved every previous version. MCP generated the live versions above; local filenames remain unchanged.
- All eight replaced function bodies match the candidate source. Function signatures, SECURITY DEFINER flags, search paths, and ACLs are unchanged.
- Account-claims replay for active `ntchi2` (`to_qltb`, tenant 17) loaded configuration choices for equipment 2895, whose department differs from the account's. Configuration get/history/staff choices, slots, workspace, export, and deviations read RPCs completed without a permission error.
- Negative live read checks returned the expected `42501`: manager accessing another tenant, ordinary user accessing a different department, and configuration history with no role claim.
- Live configuration, configuration-version, and reading counts remained zero. No measurement/configuration write or browser smoke was performed in production; the complete write flow was validated only in a disposable clone.
- Advisors introduced no new findings: security 564 → 564; performance 193 → 192, with one existing performance finding removed.
- Evidence: `docs/reports/temperature-monitoring-manager-scope-live-apply-2026-10-23.json`; full SQL read-back and snapshots are retained locally at `/root/Oracle/tm-manager-scope-live-20261023/read-back.json`.

## Evidence

- Original RED: clone `tm_scope_20261023021240_1a275052`, 19 original TM migrations, new manager-scope regression rejected same-tenant/different-department choices with `42501`. Exact clone removal confirmed, remaining count 0.
- History-guard RED: clone `tm_scope_20261023022135_7543d731`, missing-role history request unexpectedly succeeded before delegation to the shared helper. Exact clone removal confirmed, remaining count 0.
- Final GREEN: clone `tm_scope_20261023022201_8bf50bc5`, all 22 TM migrations, exit 0. New regression plus all nine existing suites below passed. Exact clone removal confirmed, remaining count 0.
- New regression covers configure, history, current slots, save a 9.2°C reading, workspace, export, and deviation listing across departments within a tenant; populated foreign-tenant fixtures exercise unfiltered list isolation. It also covers missing department, missing tenant, missing identity, and ordinary-role department boundaries.
- Existing suites: export behavior; schedules/slots smoke and behavior; measurements; review; deviations; configuration smoke; configuration replacement; workspace behavior.
- Independent implementation review completed against the base SHA above, covering standards and specification. No remaining concrete findings after the history guard repair. Formatting and `git diff --check` passed. No TypeScript/React files changed.
- Tests ran using `/tmp/tm-manager-scope-check.py green` against disposable databases cloned from `qltbyt_test`. Only each clone received the archived `ai_readonly.try_parse_iso_date` prerequisite and temporary schema privileges needed by the old baseline. This prerequisite adjustment is another reason these results are not formal baseline-forward certification.

## Gate and operational limits

| Check                                                                        | Result                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Focused SQL regression and nine existing suites                              | DISPOSABLE ONLY PASS                                                |
| Static lane: `timeout 45s node scripts/npm-run.js run db:quality-gate:local` | INCOMPLETE, exit 124, no digest-bearing report                      |
| Formal baseline-forward                                                      | INCOMPLETE; not executed against the known unhealthy baseline state |
| Aggregate certification                                                      | INCOMPLETE                                                          |
| Live apply                                                                   | PASS, three migrations applied and read back                        |

No baseline refresh, persistent-baseline migration, Docker build/restart/prune, or changes to other containers/images/services were performed. Operations used `docker exec` in the existing PostgreSQL container and created/dropped only the generated test databases. Live database access for diagnosis was read-only.

The owner explicitly approved a new DB Gate bypass and live write for these three migrations on October 23. Formal static/baseline-forward certification remains INCOMPLETE; successful apply and RPC read-back are not certification. Commit/push hooks remained enabled and passed, including typecheck on push. No app deployment, Oracle maintenance, or unrelated migration was performed.

## Migration SHA-256

| Migration timestamp | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `20261023030000`    | `c3a8d76e00e90fb4b53d8dc28d8b9d1d9f583c9df85cadcb7fb4f120b520f73a` |
| `20261023030100`    | `b75b55b9325078649050b9e82dae645d742cf93785e295db55b43998c2a4baa4` |
| `20261023030200`    | `e9ccf231ab83c010d3f187d6a937bfb081846df4252f76158dd499cdbbdff286` |
