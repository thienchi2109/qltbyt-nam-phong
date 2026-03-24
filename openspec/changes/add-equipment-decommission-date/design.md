## Context
The equipment module already tracks lifecycle-related dates such as `ngay_nhap`, `ngay_dua_vao_su_dung`, and `han_bao_hanh`. Those fields support flexible partial dates, but `ngay_ngung_su_dung` represents a concrete lifecycle event and therefore needs full-date precision. The field must flow through DB/RPC writes, date utilities, import/export, UI forms, table/detail displays, and print output.

## Goals / Non-Goals
- Goals:
  - Record when a device stops being used with strict full-date precision.
  - Preserve data integrity by validating at both client and RPC layers.
  - Prevent invalid combinations where a non-decommissioned device still carries a decommission date.
  - Support the field in CRUD, import, export, detail, table, and print flows.
- Non-Goals:
  - No automatic backfill of existing `"Ngưng sử dụng"` records.
  - No search/filter work for this field in this change.
  - No AI integration in this change.
  - No changes to general equipment read RPC projections beyond what is already returned via `SELECT *` / `to_jsonb(tb.*)`.

## Decisions
- Decision: **Use client + RPC validation**, not client-only validation.
  - Rationale: bulk import and any future callers must obey the same rule set as the UI.
- Decision: **`ngay_ngung_su_dung` is only valid when `tinh_trang_hien_tai = "Ngưng sử dụng"`**.
  - Rationale: a decommission date on an active or non-decommissioned device is contradictory lifecycle data.
- Decision: **Reject invalid import/save attempts instead of silently clearing the field**.
  - Rationale: silent correction would hide source-data problems and make imports harder to audit.
- Decision: **Existing decommissioned records may be manually backfilled, but never auto-backfilled on load**.
  - Rationale: users need a path to correct historical records without the system inventing dates for them.
- Decision: **Strict full-date handling uses dedicated helpers**, not the permissive partial-date helpers or generic import fallback.
  - Rationale: `MM/YYYY`, `YYYY`, and broad `Date.parse` fallback would weaken the agreed requirement.
- Decision: **Auto-set is transition-aware**.
  - Rationale: the field should auto-fill only when the user changes status to `"Ngưng sử dụng"` in the current session, not when an existing legacy record simply loads with that status.
- Decision: **Excel template validation is UX guidance only; import + RPC remain authoritative**.
  - Rationale: users can still paste data from external files or bypass template hints.
- Decision: **Bulk import remains fail-fast at file level in the current UI flow**.
  - Rationale: `useBulkImportState` currently blocks submission when validation errors exist; changing that generic behavior would expand scope beyond adding this field.
- Decision: **AI is out of scope for now, but explicitly noted for a future follow-up**.
  - Rationale: current product need is equipment CRUD/import/display; AI lookup can be added in a focused subsequent change.

## Helper Contracts (Strict Full-Date)
- `isValidFullDate(value: string | null | undefined): boolean`
  - Accept: `DD/MM/YYYY`, `DD-MM-YYYY`, or ISO `YYYY-MM-DD`.
  - Reject: partial formats (`MM/YYYY`, `YYYY`) and permissive parser-only inputs.
- `normalizeFullDateForForm(value: string | null | undefined): string | null`
  - Input: strict user value.
  - Output: ISO `YYYY-MM-DD` or `null` for empty.
- `normalizeFullDateForImport(value: unknown): { value: string | null; rejected: boolean }`
  - Accept only strict full-date representations and Excel serial dates that map to a full date.
  - MUST NOT use generic `Date.parse` fallback.
- `FULL_DATE_ERROR_MESSAGE`
  - `Định dạng ngày không hợp lệ. Sử dụng: DD/MM/YYYY`

## RPC Validation Contract
Validation order for `equipment_create` and `equipment_update`:
1. Extract normalized `ngay_ngung_su_dung` and effective status.
2. If date has value and status is not `"Ngưng sử dụng"`: reject.
3. If both dates exist:
   - Compare only when `ngay_dua_vao_su_dung` is full-date ISO (`YYYY-MM-DD`).
   - Skip chronological comparison for partial commission dates (`YYYY` or `YYYY-MM`) to avoid false negatives and preserve current partial-date capability.

Recommended error text (consistent across layers):
- Status dependency: `Ngày ngừng sử dụng chỉ được phép khi tình trạng là "Ngưng sử dụng"`.
- Chronological rule: `Ngày ngừng sử dụng phải sau hoặc bằng ngày đưa vào sử dụng`.

## Transition-aware Auto-set Contract
Auto-set happens only when:
- prior status in this form session is not `"Ngưng sử dụng"`,
- current status becomes `"Ngưng sử dụng"`,
- `ngay_ngung_su_dung` is currently empty.

Auto-set MUST:
- Use timezone `Asia/Ho_Chi_Minh`.
- Set display value in `DD/MM/YYYY` (form input format).
- Not trigger on initial load of an already decommissioned record.
- Not overwrite user-entered value.

## Risks / Trade-offs
- Validation now exists in more than one layer (form, import, RPC), so rules must stay synchronized.
  - Mitigation: use shared helper semantics and add explicit tests for import and RPC behavior.
- Transition-aware auto-set is slightly more complex than a naive `watch()` effect.
  - Mitigation: track prior status per session and document the non-backfill rule clearly.
- Excel template custom validation improves usability but will not stop every malformed external file.
  - Mitigation: surface row-indexed validation errors and block file submission until invalid rows are corrected.
- Existing read RPCs and list payloads have mixed projection styles (`SELECT *` / explicit `jsonb_build_object` / `to_jsonb(tb.*)`).
  - Mitigation: include explicit regression checks for table/detail/export/import and avoid assuming every read path auto-includes the new field.
- Equipment module types are split across shared and feature-local type files.
  - Mitigation: update `src/types/database.ts`, `src/lib/data.ts`, and `src/app/(app)/equipment/types.ts` together.

## Migration Plan
1. Add the nullable DB column.
2. Update equipment write RPCs to persist and validate the field.
3. Add strict full-date helpers for forms/import.
4. Wire the field through import/export, forms, table/detail, and print output.
5. Add verification coverage for form/import/RPC behavior.

## Test Strategy (TDD-first)
- Unit tests (logic-level):
  - `src/lib/__tests__/*` for strict full-date helper behavior and invalid-input rejection.
  - `src/app/api/rpc/__tests__/equipment-status-validation.unit.test.ts` for validation-contract parity.
- Component/integration tests:
  - `src/components/__tests__/import-equipment-validation.test.ts` for strict import rules and row-level errors.
  - `src/components/__tests__/equipment-dialogs.crud.test.tsx` and detail-dialog tests for transition-aware auto-set and form validation.
  - `src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts` and `src/lib/__tests__/excel-template-generation.test.ts` for export/template regressions.

Minimum acceptance before implementation completion:
- New tests fail first, then pass after implementation.
- No regression in existing equipment import/export/dialog suites.

## Follow-up Note
- Future AI-focused change:
  - Update `ai_equipment_lookup` projection to include `ngay_ngung_su_dung`.
  - Add AI query guidance/examples for decommission-date questions.
- Non-blocking maintainability cleanup:
  - `react-doctor` flagged 3 large React files after implementation:
    - `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailEditForm.tsx` (`444` lines)
    - `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx` (`443` lines)
    - `src/components/add-equipment-dialog.tsx` (`406` lines)
  - These warnings do not block the feature PR, but they are good extraction candidates for a follow-up refactor PR.
  - Recommended extraction order:
    1. `EquipmentDetailEditForm.tsx`
    2. `EquipmentDetailDialog/index.tsx`
    3. `add-equipment-dialog.tsx`
  - Recommended extraction shape:
    - Split `EquipmentDetailEditForm.tsx` by cohesive field groups that consume `useFormContext`, not by one-field-per-component.
    - Split `EquipmentDetailDialog/index.tsx` by moving form-state mapping/defaults and the action footer into sibling files while keeping the dialog state orchestration local.
    - Split `add-equipment-dialog.tsx` by extracting a data/mutation hook and a few larger field sections, not leaf components.
