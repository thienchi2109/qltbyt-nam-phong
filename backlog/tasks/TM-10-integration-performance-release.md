# TM-10 — Integration, performance and release verification

- Status: Todo
- Checkpoint 2026-10-19: owner stopped testing; staging run removed after preserving smoke and cleanup evidence. Remaining UAT and formal static/baseline-forward gates are INCOMPLETE; see `docs/reports/temperature-monitoring-tm10-staging-smoke-2026-10-19.md`. A new isolated run is required to continue.
- Milestone: Temperature Monitoring / Release
- Depends on: TM-02, TM-03, TM-04, TM-05, TM-06, TM-07, TM-08, TM-09
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Verify the complete feature across data integrity, permissions, mobile UX, performance and operational handoff.

## Scope

- Cross-seam acceptance for configuration → slot → reading → confirmation/amendment → deviation → chart/export.
- Query-window, cursor-pagination, cache invalidation and concurrency checks.
- Tenant/RBAC and admin/global normalization checks.
- Focused UI, RPC, accessibility and export verification.
- Documentation of known limitations: manual readings are not continuous sensor monitoring.

## Acceptance criteria

- All task-level acceptance evidence is linked and no task dependency is bypassed.
- Interactive queries remain bounded by the selected maximum 90-day window.
- Long-range exports work independently of the UI window and remain permission-safe.
- No new regression is found in existing Equipment, repair request or chart workflows.
- Release handoff records rollout assumptions, monitoring metrics, fallback behavior and unresolved risks.

## Takeover gate

The agent must survey the landed seams and current verification harness, then write a detailed TM-10 integration/release plan. This task must not be used to absorb unfinished implementation from earlier tasks without updating dependencies and scope.

## Planning checkpoint — 2026-10-19

- Detailed plan: [`2026-10-19-temperature-monitoring-tm10-plan.md`](../../docs/plans/2026-10-19-temperature-monitoring-tm10-plan.md), surveyed against local `main` `834aafee8059c7142a629a01d5f24b6992ecf71c` and the current TM-09 handoff.
- Reuse existing Vitest, registered SQL suites, disposable Oracle clones and real-session race runners; authenticate browser UAT against a separately provisioned candidate API/app. The preview workflow is build-only; a functioning isolated staging app and observed capacity are not yet established.
- Formal `static` and `baseline-forward` remain **INCOMPLETE**; prior 19-migration/six-suite replay is **DISPOSABLE ONLY**. Separate harness/baseline maintenance is an explicit prerequisite decision, not silently included in TM-10. TM-09 remains In Progress.
- **PLAN ONLY**: no runtime/test/SQL implementation, test/gate execution, DB operation, deployment, install, commit, push or live mutation. Status stays Todo pending plan review and execution authorization.
- Subsequent user authorization covers staging setup with a disposable clone, owned by the lead; the planning worker remains docs-only. General TM-10 behavior implementation, formal baseline maintenance, live writes and production deployment remain outside that authorization. Status stays Todo; staging readiness requires actual evidence.
- Owner requests retaining the clone's production-derived records and existing accounts/passwords: no deletion/masking, synthetic-account creation or password reset. Use cloned snapshot accounts without claiming they match today's live state; any optional test-data additions need separately scoped tests. Keep access through a private SSH tunnel with isolated localhost origin/cookies, and exclude real records/secrets from shared artifacts. The lead reports no clone had been created or purged at this decision checkpoint.
- Subsequent staging checkpoint: lead reports a separate candidate clone/app/API provisioned with build and unauthenticated app/API smoke PASS. Reusable [staging runbook](../../docs/runbooks/temperature-monitoring-staging.md) records exact identity, tunnel/restart/stop and recreation procedure. Existing data/accounts retained. Status remains Todo for TM-10 acceptance.
- Initial browser smoke: existing-account vault login reaches `/dashboard` with role `to_qltb`; Equipment and empty Temperature Monitoring/Lịch sử 30-day UI load, mobile 375×812 has no horizontal overflow. Empty export and actual ExcelJS reload validate empty-workbook structure. Two dashboard snapshot RPC gaps (`usage_log_list`, `equipment_department_distribution`) remain unresolved.
- Subsequent user-authorized fixture smoke supersedes zero-device/measurement-NOT-RUN status: authenticated BFF creates labeled equipment `9679` (not Equipment add UI), UI config saves 2–8°C with next-midnight activation; separately explained clone-only historical policy fixture permits today's capture without changing future immutable policy/source/roles. UI saves 5.2°C; History shows Đã ghi, chart renders (exact point fidelity unasserted), self-review is blocked. Actual 11,129-byte XLSX reload confirms six sheets, one matching reading with 5.2/snapshot2/8 and one reading event. Existing out-of-scope Equipment was correctly rejected403; no accounts/permissions changed. Fixture/reading retained; see [smoke report](../../docs/reports/temperature-monitoring-tm10-staging-smoke-2026-10-19.md). Amendments/deviations/independent review/high-load/races/full download UX remain unproven; full UAT and formal DB remain INCOMPLETE. No app-wide PASS or baseline repair is claimed.
