## 1. Database & Types
- [ ] 1.1 Add DB column `ngay_ngung_su_dung` (TEXT, nullable) to `public.thiet_bi` via Supabase migration.
- [ ] 1.2 Update TypeScript types: `src/types/database.ts` + `src/lib/data.ts` to include `ngay_ngung_su_dung`.

## 2. Date Validation Helpers
- [ ] 2.1 Add `isValidFullDate`, `normalizeFullDateForForm`, `FULL_DATE_ERROR_MESSAGE` to `src/lib/date-utils.ts`.
- [ ] 2.2 Add `"ngay_ngung_su_dung"` to `TEXT_DATE_FIELDS` set in `src/lib/date-utils.ts`.

## 3. Equipment Table
- [ ] 3.1 Add `ngay_ngung_su_dung: 'Ngày ngừng sử dụng'` to `columnLabels` in `equipment-table-columns.tsx`.
- [ ] 3.2 Add dedicated cell renderer for ISO → DD/MM/YYYY display.
- [ ] 3.3 Set default column visibility `ngay_ngung_su_dung: false` in `useEquipmentTable.ts`.

## 4. Import / Export
- [ ] 4.1 Add `ngay_ngung_su_dung: 'Ngày ngừng sử dụng'` to `EQUIPMENT_COLUMN_LABELS` in `excel-utils.ts`.
- [ ] 4.2 Add header mapping `'Ngày ngừng sử dụng': 'ngay_ngung_su_dung'` to `import-equipment-dialog.tsx`.
- [ ] 4.3 Add `'ngay_ngung_su_dung'` to `dateFields` Set in `import-equipment-dialog.tsx`.

## 5. UI Forms (schema + field + auto-set)
- [ ] 5.1 Add `ngay_ngung_su_dung` to schema in `add-equipment-dialog.tsx` using `isValidFullDate` + `.superRefine()`.
- [ ] 5.2 Add auto-set `useEffect` + `<FormField>` in `add-equipment-dialog.tsx`.
- [ ] 5.3 Add `ngay_ngung_su_dung` to schema in `edit-equipment-dialog.tsx` + `.superRefine()`.
- [ ] 5.4 Add auto-set `useEffect` + `<FormField>` in `edit-equipment-dialog.tsx`.
- [ ] 5.5 Add `ngay_ngung_su_dung` to `equipmentFormSchema` in `EquipmentDetailTypes.tsx` + `.superRefine()`.
- [ ] 5.6 Add auto-set `useEffect` + `<FormField>` in `EquipmentDetailEditForm.tsx`.
- [ ] 5.7 Add `ngay_ngung_su_dung` to `emptyEquipment` + `equipmentToFormValues` in `EquipmentDetailDialog/index.tsx`.

## 6. Print & Display
- [ ] 6.1 Add "Ngày ngừng sử dụng" row to print template in `equipment-print-utils.ts`.

## 7. AI Layer
- [ ] 7.1 Add `ngay_ngung_su_dung` to `troubleshooting-schema.ts`.
- [ ] 7.2 Add `ngay_ngung_su_dung` to `repair-request-draft-schema.ts`.
- [ ] 7.3 Update equipment schema description in `system.ts` AI prompt.

## 8. Tests
- [ ] 8.1 Update mock fixtures in `equipment-dialogs.crud.test.tsx`.
- [ ] 8.2 Update mock fixtures in `import-equipment-validation.test.ts`.
- [ ] 8.3 Update mock fixtures in `import-equipment-dialog.test.tsx`.
- [ ] 8.4 Update mock fixtures in `qr-action-sheet.test.tsx`.
- [ ] 8.5 Update mock fixtures in `useAddTasksEquipment.test.ts`.

## 9. Verification
- [ ] 9.1 Run `npm run typecheck`.
- [ ] 9.2 Run all affected tests: `npx vitest run --reporter=verbose` on 5 test files.
- [ ] 9.3 Manual: verify auto-set and cross-field validation in UI.
