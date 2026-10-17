# TM-05 — Confirmation, amendment and audit history

- Status: Todo
- Milestone: Temperature Monitoring / Core workflow
- Depends on: TM-04
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Make confirmed readings traceable and immutable while supporting controlled correction.

## Scope

- `Chờ xác nhận` review for abnormal readings and amendments.
- Approve/reject amendment flow with mandatory reason and distinct operator/approver.
- Reopen by authorized manager with mandatory reason.
- Domain history plus audit events that retain original and effective values.

## Acceptance criteria

- Confirmed readings cannot be updated or physically deleted through normal RPCs.
- An amendment preserves the original, records reason/actors/timestamps and becomes effective only after approval.
- Reopen creates an auditable event and returns the slot to the correct review state.
- History is tenant-safe and separate from broad equipment lifecycle history.

## Takeover gate

The agent must survey repair/maintenance terminal guards, audit helpers, role normalization and change-history UI, then submit a detailed TM-05 plan before coding.
