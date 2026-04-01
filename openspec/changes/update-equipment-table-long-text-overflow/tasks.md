## 1. Discovery and Safeguards
- [ ] 1.1 Reconfirm the GitNexus impact for `createEquipmentColumns` before implementation starts.
- [ ] 1.2 Audit the Equipments desktop table render path and identify the narrowest safe place to add tooltip/focus affordances and bounded widths without affecting unrelated tables.

## 2. Desktop Table Tooltip Behavior
- [ ] 2.1 Add explicit desktop-table rendering rules for `ma_thiet_bi` so it preserves the current single-line truncation and exposes the full value via tooltip/focus.
- [ ] 2.2 Add explicit desktop-table rendering rules for `ten_thiet_bi` so it preserves the current single-line truncation and exposes the full value via tooltip/focus.
- [ ] 2.3 Add bounded width contracts for `ma_thiet_bi` and `ten_thiet_bi` so they stop over-expanding the desktop table.
- [ ] 2.4 Reuse or minimally extend the shared truncated-text primitive only as needed for the Equipments table path.

## 3. Regression Preservation
- [ ] 3.1 Confirm the change does not alter current responsive column visibility behavior.
- [ ] 3.2 Confirm row click, sorting, and action-menu interactions still behave as before.

## 4. Regression Coverage and Verification
- [ ] 4.1 Add or extend focused tests for the Equipments table tooltip behavior on truncated name/code cells.
- [ ] 4.2 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 4.3 Run `node scripts/npm-run.js run typecheck`.
- [ ] 4.4 Run focused tests for the changed table behavior.
- [ ] 4.5 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`.
