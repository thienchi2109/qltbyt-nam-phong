# TM-06 — Deviation and corrective action workflow

- Status: Todo
- Milestone: Temperature Monitoring / Core workflow
- Depends on: TM-04, TM-05
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Turn every out-of-range reading into a trackable deviation with mandatory corrective action.

## Scope

- One deviation per out-of-range reading, with Nhẹ/Nghiêm trọng/Khẩn cấp severity.
- Immediate action, owner, due date, cause, evidence and verification result.
- Open, awaiting confirmation, in progress, resolved and closed behavior as needed by the reviewed contract.
- Optional two-way link to an existing repair request; no automatic repair request creation.

## Acceptance criteria

- An out-of-range save creates or safely returns its deviation without duplicate creation under retry.
- The deviation shows the measurement and threshold snapshot that triggered it.
- Closing is blocked until immediate action and verification result are present.
- Repair links preserve independent lifecycles and permissions.

## Takeover gate

Before implementation, the agent must survey repair request create/approve/complete flows, notification/event patterns and equipment scope checks, then write a detailed TM-06 plan.
