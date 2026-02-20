# Equipment Soft-Delete Follow-Ups (2026-02-20)

## Context
- Phase 1 soft-delete (`is_deleted`) is implemented and validated.
- This note captures required backlog items that were intended to be filed in `bd`.
- `bd` CLI is unavailable in the current execution environment (`bd` command not found), so these are recorded here for manual issue creation.

## Follow-Up 1: Trash UI and Restore UX
- Goal: add a dedicated "Trash" view for deleted equipment and streamline restore actions.
- Scope:
  - add filter/view to list deleted equipment
  - provide restore action with confirmation and audit context
  - ensure RBAC parity with delete/restore RPC permissions
- Acceptance hints:
  - deleted rows are discoverable in UI without exposing them in active inventory lists
  - restore flow is role-gated and visible in audit trail

## Follow-Up 2: Retention-Based Hard Purge Job
- Goal: implement controlled physical purge for long-retained soft-deleted equipment.
- Scope:
  - define retention policy and safety windows
  - implement purge job with dry-run/report mode
  - ensure referential integrity handling is explicit and tested
- Acceptance hints:
  - purge only affects rows older than configured retention
  - auditability and rollback strategy are documented

## Follow-Up 3: Optional Partial Unique Index for Code Reuse
- Goal: enable optional reuse of `ma_thiet_bi` when previous row is soft-deleted.
- Scope:
  - evaluate migration from global unique constraint to partial unique index (`WHERE is_deleted = false`)
  - assess create/import/restore edge cases and conflict behavior
  - update operator guidance and tests
- Acceptance hints:
  - create/import supports intended reuse semantics without breaking restore safety
  - policy is explicitly documented before rollout
