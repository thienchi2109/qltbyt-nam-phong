# TM-01 — Domain contract and seam survey

- Status: Done with concerns
- Milestone: Temperature Monitoring / Foundation
- Depends on: None
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Convert the agreed business rules into a reviewed domain contract without implementing the feature yet.

## Scope

- Confirm equipment, tenant, department, role and timezone boundaries.
- Define terms and invariants for monitoring configuration, shift, slot, reading, amendment, deviation and audit event.
- Identify the highest existing seams for RPC, query hooks, Equipment detail, mobile workspace, chart and export.
- Map focused test seams and unresolved assumptions.

## Acceptance criteria

- A reviewed contract lists states, transitions, immutable fields and conflict behavior.
- A seam map names the existing modules to reuse and explicitly records gaps.
- High-level dependency guidance for TM-02 onward is recorded after this task's survey; each TM-02..TM-10 task must perform its own read-only survey and write a detailed task-specific plan before implementation. This contract does not replace those takeover plans.
- No production code, migration or live data is changed by this task.

## Takeover gate

Before work starts, the agent must perform the mandatory read-only survey and write a task-specific detailed plan for TM-01. The master spec is direction only.

## TM-01 result

- Contract artifact: [`docs/specs/temperature-monitoring-domain-contract.md`](../../docs/specs/temperature-monitoring-domain-contract.md)
- Survey mode: read-only code/schema/RPC/RBAC/timezone/query/UI/test seam inspection; no TypeScript, SQL, migration, RPC or live data changed.
- Evidence anchors include the RPC proxy/allowlist and session claims, `isGlobalRole()`, Equipment detail/types/history, repair query invalidation, mobile action/tab seams, lazy Recharts utilities, export hook and focused existing tests.
- Dependency guidance for TM-02..TM-10 is recorded in the contract only at handoff level; each task still requires its own takeover survey and detailed plan.

### Concerns carried forward

- Temperature-specific RPC names, tables, conflict payload, capability matrix, numeric precision and deviation policy do not exist yet and must be resolved by the owning implementation tasks.
- Every configuration version now requires a non-null display timezone with `Asia/Ho_Chi_Minh` as the master-spec default; whether later versions may choose another timezone remains an owner decision.
- The slot state remains exactly `Chưa ghi`, `Đã ghi`, `Bất thường` or `Chờ xác nhận`; deviation closure is a separate lifecycle and never creates a `Closed` slot state.
- v1 notifications are explicitly in-app badge/inbox plus audit; Web Push remains deferred.
