# TM-01 — Domain contract and seam survey

- Status: Todo
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
- A detailed implementation plan for TM-02 onward is proposed only after this task's survey; it does not silently replace each task's own takeover plan.
- No production code, migration or live data is changed by this task.

## Takeover gate

Before work starts, the agent must perform the mandatory read-only survey and write a task-specific detailed plan for TM-01. The master spec is direction only.
