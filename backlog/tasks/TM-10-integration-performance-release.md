# TM-10 — Integration, performance and release verification

- Status: Todo
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
