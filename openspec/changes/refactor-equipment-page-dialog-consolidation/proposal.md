## Why
The `Equipments` page currently mounts both `EquipmentDetailDialog` and the legacy `EditEquipmentDialog`, even though the page action menu only opens the detail flow. This leaves page-specific dead state in the dialog context, duplicates update orchestration, and increases drift risk as active equipment changes keep extending both form surfaces.

Active pending equipment changes already widen this risk:
- `add-equipment-so-luu-hanh`
- `add-equipment-decommission-date`

Both change sets require equipment edit fields to stay aligned across detail and legacy edit surfaces. Without a consolidation change, the `Equipments` page will keep paying for two overlapping update paths while still depending on the same RPC-only contract.

## What Changes
- Make `EquipmentDetailDialog` the only detail and edit surface mounted by the `Equipments` page.
- Remove page-specific `EditEquipmentDialog` orchestration from the equipment page dialog tree and context state.
- Extract a shared equipment edit contract for schema, default-value mapping, and update mutation behavior so `EquipmentDetailDialog` and any remaining legacy consumers stay aligned.
- Keep the scope limited to the `Equipments` page. Dashboard and QR scanner migrations are explicitly deferred to follow-up issues:
  - `#183` Dashboard migration
  - `#182` QR scanner migration
- Track the final cleanup pass in a separate refactor follow-up:
  - `#184` retire the legacy `EditEquipmentDialog` after route migrations land
- Drive implementation with TDD:
  - write failing page-orchestration tests first,
  - write failing shared-contract tests first,
  - then implement the minimum consolidation to make those tests pass.
- Keep verification aligned with project rules for TypeScript / React diffs:
  - `node scripts/npm-run.js run verify:no-explicit-any`
  - `node scripts/npm-run.js run typecheck`
  - focused tests
  - `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

## Impact
- Affected specs: `equipment-catalog`
- Affected code:
  - `src/app/(app)/equipment/equipment-dialogs.tsx`
  - `src/app/(app)/equipment/_components/EquipmentDialogContext.tsx`
  - `src/app/(app)/equipment/_components/EquipmentDetailDialog/*`
  - `src/components/edit-equipment-dialog.tsx`
  - `src/components/edit-equipment-dialog.rpc.ts`
  - equipment-page and dialog regression tests
- Dependency review:
  - GitNexus reports `HIGH` upstream risk for `useEquipmentUpdate`, `updateEquipmentRecord`, and `equipmentToFormValues`
  - `dashboard` and `qr-scanner` still import `EditEquipmentDialog`, so this change must not remove the legacy component outright
  - full legacy-dialog retirement remains intentionally deferred until `#183`, `#182`, and `#184`
  - pending `equipment-catalog` changes that add fields to both dialog families must be kept compatible with the extracted shared contract
