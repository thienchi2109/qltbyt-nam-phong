## 1. Implementation
- [ ] 1.1 Red: add a failing equipment-page dialog orchestration test proving `/equipment` no longer mounts or depends on `EditEquipmentDialog`, while row actions still open `EquipmentDetailDialog`.
- [ ] 1.2 Red: add failing shared edit-contract tests for validation schema, `equipment -> form values` normalization, and update-mutation behavior used by both detail and legacy edit surfaces.
- [ ] 1.3 Red: add a failing regression test proving a successful save from the `Equipments` page refreshes the active `equipment_list_enhanced` data contract and keeps the visible detail payload in sync until refetch completes.
- [ ] 1.4 Verify Red: run only the new focused tests and confirm they fail for the expected missing-consolidation reasons before writing production code.
- [ ] 1.5 Green: extract shared equipment edit modules for schema/types, form defaults/normalization, and update orchestration, then rewire `EquipmentDetailDialog` and `EditEquipmentDialog` to those modules without changing dashboard or QR scanner entrypoints.
- [ ] 1.6 Green: remove `EditEquipmentDialog` mounting plus `editingEquipment` page-state orchestration from the `Equipments` page dialog tree and context, keeping detail-dialog-driven view/edit behavior intact.
- [ ] 1.7 Refactor: delete dead page-only edit plumbing, reduce duplicated tests where behavior is now shared, and keep touched files within project file-size limits.

## 2. Verification
- [ ] 2.1 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 2.2 Run `node scripts/npm-run.js run typecheck`.
- [ ] 2.3 Run focused tests for touched behavior, including:
  - `node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/EquipmentDialogContext.test.tsx src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx src/app/(app)/equipment/__tests__/equipmentMutations.test.ts src/components/__tests__/equipment-dialogs.crud.test.tsx`
- [ ] 2.4 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`.

## 3. Dependency Follow-up
- [ ] 3.1 Confirm `dashboard` route migration remains tracked under issue `#183` and is not pulled into this change.
- [ ] 3.2 Confirm `qr-scanner` route migration remains tracked under issue `#182` and is not pulled into this change.
- [ ] 3.3 Confirm final legacy-dialog retirement remains tracked under refactor issue `#184` and is not pulled into this change.
