## 1. Discovery and Safeguards
- [ ] 1.1 Reconfirm the GitNexus impact for `createEquipmentColumns` before implementation starts.
- [ ] 1.2 Audit the Equipments desktop table render path and identify the narrowest safe place to add tooltip/focus affordances and bounded widths without affecting unrelated tables.

## 2. RED: Write Failing Tests First
- [ ] 2.1 Add or extend focused tests that describe the expected `ma_thiet_bi` behavior: single-line truncation, full-text hover/focus access, and bounded width.
- [ ] 2.2 Add or extend focused tests that describe the expected `ten_thiet_bi` behavior: single-line truncation, full-text hover/focus access, and bounded width.
- [ ] 2.3 Add or extend a focused regression test that proves current responsive column visibility behavior remains unchanged.

## 3. VERIFY RED
- [ ] 3.1 Run the focused test files and confirm the new assertions fail for the intended missing behavior, not for harness/setup issues.
- [ ] 3.2 Fix any test-harness problems until the failures are clean and behavior-specific.

## 4. GREEN: Minimum Implementation
- [ ] 4.1 Add explicit desktop-table rendering rules for `ma_thiet_bi` so it preserves the current single-line truncation and exposes the full value via tooltip/focus.
- [ ] 4.2 Add explicit desktop-table rendering rules for `ten_thiet_bi` so it preserves the current single-line truncation and exposes the full value via tooltip/focus.
- [ ] 4.3 Add bounded width contracts for `ma_thiet_bi` and `ten_thiet_bi` so they stop over-expanding the desktop table.
- [ ] 4.4 Reuse or minimally extend the shared truncated-text primitive only as needed for the Equipments table path.

## 5. VERIFY GREEN
- [ ] 5.1 Re-run the focused test files and confirm the new assertions pass.
- [ ] 5.2 Confirm row click, sorting, and action-menu interactions still behave as before.
- [ ] 5.3 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 5.4 Run `node scripts/npm-run.js run typecheck`.
- [ ] 5.5 Run the focused tests for the changed table behavior.
- [ ] 5.6 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`.

## 6. REFACTOR
- [ ] 6.1 Refactor any duplicated cell-rendering or tooltip plumbing only after all focused tests are green.
- [ ] 6.2 Re-run the focused tests after refactoring to confirm behavior remains unchanged.
