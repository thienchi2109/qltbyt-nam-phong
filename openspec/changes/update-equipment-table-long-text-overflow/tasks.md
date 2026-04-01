## 1. Discovery and Safeguards
- [ ] 1.1 Reconfirm the GitNexus impact for `createEquipmentColumns` and `useEquipmentTable` before implementation starts.
- [ ] 1.2 Audit the Equipments desktop table render path and identify the narrowest safe place to apply bounded-width behavior without affecting unrelated tables.

## 2. Desktop Table Overflow Behavior
- [ ] 2.1 Add explicit desktop-table rendering rules for `ma_thiet_bi` so it stays single-line, truncated, and exposes the full value via tooltip/focus.
- [ ] 2.2 Add explicit desktop-table rendering rules for `ten_thiet_bi` so it shows at most two lines, then clamps and exposes the full value via tooltip/focus.
- [ ] 2.3 Add bounded-width contracts for the long-text columns so they cannot dominate the table width on smaller desktop screens.

## 3. Responsive Column Priority
- [ ] 3.1 Update equipment-table responsive visibility rules so `serial` hides earlier on narrower desktop widths.
- [ ] 3.2 Keep existing user-controlled column visibility behavior compatible with the responsive auto-hide logic.

## 4. Regression Coverage and Verification
- [ ] 4.1 Add or extend focused tests for the Equipments table long-text behavior and responsive column-priority behavior.
- [ ] 4.2 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 4.3 Run `node scripts/npm-run.js run typecheck`.
- [ ] 4.4 Run focused tests for the changed table behavior.
- [ ] 4.5 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`.
