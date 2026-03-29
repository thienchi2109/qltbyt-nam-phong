## 1. Backend/Data Layer
- [ ] 1.1 Verify RPC `equipment_list_enhanced` supports `p_page_size = NULL` for unlimited results (or create dedicated export RPC).
- [ ] 1.2 Add helper function `fetchAllFilteredEquipment` in `useEquipmentData.ts` or separate utility.

## 2. Export Hook Enhancement
- [ ] 2.1 Update `useEquipmentExport` to accept filter params and `total` count.
- [ ] 2.2 Implement `handleExportData` to fetch all filtered data (not just current page).
- [ ] 2.3 Add `isExporting` loading state to hook return.
- [ ] 2.4 Implement confirmation toast before export with item count and active filters.
- [ ] 2.5 Add warning for large exports (>5000 items) with user confirmation.

## 3. UI Integration
- [ ] 3.1 Update `use-equipment-page.tsx` to pass filter context to export hook.
- [ ] 3.2 Expose `isExporting` state for button disabled state.
- [ ] 3.3 Update export button to show loading spinner during export.

## 4. Toast Messages
- [ ] 4.1 Create helper to format active filters into readable Vietnamese text.
- [ ] 4.2 Implement pre-export confirmation toast showing count + filters.
- [ ] 4.3 Keep existing success/error toasts after export completes.

## 5. Verification
- [ ] 5.1 Run `npm run typecheck`.
- [ ] 5.2 Test export with various filter combinations.
- [ ] 5.3 Test export with large dataset (>100 items) to verify all items exported.
- [ ] 5.4 Test edge case: export when no filters applied (all data).
- [ ] 5.5 Verify template download still works unchanged.
