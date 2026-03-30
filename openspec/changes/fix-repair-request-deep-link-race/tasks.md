## 1. Reproduce The Race In Tests

- [ ] 1.1 Red: add a failing hook test where `action=create&equipmentId=<id>` is present, `equipment_list` settles first, the targeted `equipment_get` resolves later, and the sheet must not open blank before targeted resolution completes.
- [ ] 1.2 Red: add a failing hook test where the targeted `equipment_get` resolves before any useful list state and the sheet still opens with the resolved equipment.
- [ ] 1.3 Red: add or tighten a test proving invalid or unresolved `equipmentId` degrades gracefully only after the resolution path reaches a terminal state.

## 2. Implement Terminal Resolution Gating

- [ ] 2.1 Green: update `useRepairRequestsDeepLink()` to track requested-equipment resolution explicitly instead of inferring readiness from `hasLoadedEquipment` and `isEquipmentFetchPending` alone.
- [ ] 2.2 Green: gate `openCreateSheet()` and URL cleanup for `action=create&equipmentId=<id>` until the requested equipment is resolved or definitively unavailable.
- [ ] 2.3 Green: preserve the existing immediate behavior for create intents without `equipmentId`.
- [ ] 2.4 Green: preserve assistant-draft handoff precedence and cache cleanup behavior.

## 3. Refactor And Regression Safety

- [ ] 3.1 Refactor: keep the hook logic readable by separating param parsing, requested-equipment state transitions, and final create-intent cleanup semantics.
- [ ] 3.2 Refactor: remove redundant mock setup in hook tests introduced by the new race-ordering coverage.
- [ ] 3.3 Refactor: keep assistant handoff assertions unchanged except where they need to prove the new gating did not interfere.

## 4. Verification

- [ ] 4.1 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 4.2 Run `node scripts/npm-run.js run typecheck`.
- [ ] 4.3 Run focused tests for `useRepairRequestsDeepLink` and assistant handoff regression coverage.
- [ ] 4.4 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`.
- [ ] 4.5 Run `openspec validate fix-repair-request-deep-link-race --strict`.
