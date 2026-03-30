## 1. Shared Create Intent API

- [ ] 1.1 Red: add focused tests proving the shared helper generates the canonical create contract for no-equipment and with-equipment entry cases.
- [ ] 1.2 Green: implement the shared repair-request create intent helper that returns the canonical deep-link with optional `equipmentId`.
- [ ] 1.3 Refactor: if needed for component ergonomics, add a thin shared navigation wrapper that delegates to the canonical helper without reintroducing route-string duplication.

## 2. Source Surface Adoption

- [ ] 2.1 Red: add or tighten source-surface tests that expect Equipment desktop/mobile, Dashboard, QR scanner, and AssistantPanel to navigate through the shared create intent API.
- [ ] 2.2 Green: refactor Equipment desktop/mobile, Dashboard, QR scanner, and AssistantPanel to use the shared create intent API.
- [ ] 2.3 Refactor: remove remaining hardcoded create-repair route strings from source surfaces and keep call sites grep-friendly around the shared helper/hook.

## 3. Repair Requests Sink Validation

- [ ] 3.1 Red: add or tighten deep-link tests for `action=create` with no `equipmentId`, with a valid `equipmentId`, and with an invalid `equipmentId`.
- [ ] 3.2 Green: confirm and adjust `useRepairRequestsDeepLink` so it accepts the canonical create contract and still opens the create sheet while preserving graceful degradation.
- [ ] 3.3 Refactor: keep deep-link parsing and create-sheet opening logic isolated and readable without changing form submission semantics.

## 4. Submission And Regression Safety

- [ ] 4.1 Red: keep or add focused create-sheet submission tests that assert the existing `createMutation` payload and submission path remain unchanged after the navigation refactor.
- [ ] 4.2 Green: make the source/sink navigation refactor pass while keeping the create-form submission assertions green.
- [ ] 4.3 Refactor: remove redundant fixtures or setup duplication across helper, deep-link, source-surface, and create-sheet submission tests.

## 5. Verification

- [ ] 5.1 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 5.2 Run `node scripts/npm-run.js run typecheck`.
- [ ] 5.3 Run focused tests for shared create intent, Repair Requests deep-link flow, Dashboard, Equipment, and QR scanner entry points.
- [ ] 5.4 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`.
- [ ] 5.5 Run `openspec validate centralize-repair-request-create-intent --strict`.
