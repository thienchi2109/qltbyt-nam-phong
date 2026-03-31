## Context
The equipment catalog route currently mounts a full-screen detail dialog and a standalone legacy edit dialog at the same time. On the `Equipments` page, row actions route users into `EquipmentDetailDialog`, while `EditEquipmentDialog` remains mounted through page-level dialog context state that no longer has an active UI entrypoint on that route.

This leaves three dependency pressures:
- page-specific dead orchestration in `EquipmentDialogContext`
- duplicated edit contracts between detail and legacy dialogs
- active `equipment-catalog` changes (`so_luu_hanh`, `ngay_ngung_su_dung`) that must keep both dialog families aligned while `dashboard` and `qr-scanner` still depend on the legacy dialog

GitNexus impact for the relevant update symbols is `HIGH`, but inbound React component edges are incomplete in the current index. For this change, GitNexus blast-radius data is combined with direct source review and grep results.

## Goals / Non-Goals
- Goals:
  - make the `Equipments` page rely on one canonical details/update surface
  - remove page-only legacy edit state and dialog mounting from the equipment catalog route
  - reduce duplication by sharing edit schema/default/update contracts between detail and legacy consumers
  - preserve current `dashboard` and `qr-scanner` behavior until follow-up changes land
- Non-Goals:
  - migrate `dashboard` to `EquipmentDetailDialog`
  - migrate `qr-scanner` to `EquipmentDetailDialog`
  - delete `EditEquipmentDialog` from the codebase in this change
  - change non-`/equipment` route UX in the same release

## Decisions
- Decision: Consolidate the `Equipments` page on `EquipmentDetailDialog`
  - The catalog page already routes row-level inspection through the detail dialog and supports inline edit there.
  - Removing the page-level legacy edit mount is the narrowest way to eliminate dead path behavior on this route.

- Decision: Keep `EditEquipmentDialog` alive temporarily, but only as a downstream consumer of a shared edit contract
  - This avoids widening scope into `dashboard` and `qr-scanner`.
  - It also prevents active equipment-field changes from drifting between detail and legacy edit flows while follow-up migrations remain open.

- Decision: Extract shared edit contracts into route-agnostic modules before removing page-level legacy orchestration
  - Shared concerns:
    - validation schema and inferred form types
    - `equipment -> form values` normalization/defaults
    - update mutation / toast / invalidation contract boundaries
  - Route-specific concerns remain local:
    - detail dialog tab orchestration and optimistic display state
    - dashboard / QR scanner entrypoint UX

- Decision: Keep invalidation semantics aligned with the active equipment catalog data source
  - The `Equipments` page uses `equipment_list_enhanced`.
  - Consolidation must not keep page behavior dependent on legacy `equipment_list` invalidation.

## Risks / Trade-offs
- Pending equipment changes may touch the same field lists and tests
  - Mitigation: align the extracted shared contract with the full active field set already present in both dialog families.

- Removing page-level legacy state could break overlooked code paths in the equipment route
  - Mitigation: add failing orchestration tests before deleting context members or dialog mounts.

- Shared-contract extraction may tempt a larger refactor
  - Mitigation: keep the extraction limited to schema/default/update concerns; do not redesign all dialog UI in this change.

## Migration Plan
1. Add failing tests for `Equipments` page dialog orchestration and shared edit contracts.
2. Extract shared schema/default/update modules used by both detail and legacy dialogs.
3. Rewire `EquipmentDetailDialog` and `EditEquipmentDialog` to the shared contract.
4. Remove `EditEquipmentDialog` mounting and page-only legacy edit state from the equipment catalog route.
5. Run project verification in the required order for TS/React diffs.
6. Leave `dashboard` and `qr-scanner` route migrations to follow-up issues `#183` and `#182`.
7. Leave final legacy-dialog retirement and cleanup to refactor issue `#184`.

## Open Questions
- None for proposal scope. External-route migration is intentionally deferred to follow-up issues.
