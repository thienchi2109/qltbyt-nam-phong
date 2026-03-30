## 1. Shared Create Intent API

- [ ] 1.1 Add a shared repair-request create intent helper that returns the canonical create deep-link with optional `equipmentId`.
- [ ] 1.2 Add focused tests proving the helper generates the same contract for no-equipment and with-equipment entry cases.
- [ ] 1.3 If needed for component ergonomics, add a thin shared navigation wrapper that delegates to the canonical helper instead of duplicating route strings.

## 2. Source Surface Adoption

- [ ] 2.1 Refactor Equipment desktop repair actions to use the shared create intent API.
- [ ] 2.2 Refactor Equipment mobile repair actions to use the shared create intent API.
- [ ] 2.3 Refactor Dashboard repair actions to use the shared create intent API.
- [ ] 2.4 Refactor QR scanner repair actions to use the shared create intent API.

## 3. Repair Requests Sink Validation

- [ ] 3.1 Confirm `useRepairRequestsDeepLink` accepts the canonical create contract and still opens the create sheet.
- [ ] 3.2 Add or tighten tests for `action=create` with and without `equipmentId`.
- [ ] 3.3 Add or tighten tests that verify equipment prefill reaches the create sheet when the deep-link resolves successfully.

## 4. Regression Coverage

- [ ] 4.1 Add focused regression tests for at least one desktop source surface and one mobile source surface using the shared create intent.
- [ ] 4.2 Add focused regression coverage for Dashboard and QR scanner create-repair entry points.
- [ ] 4.3 Verify no existing create-form submission behavior changes as part of the navigation refactor.

## 5. Verification

- [ ] 5.1 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 5.2 Run `node scripts/npm-run.js run typecheck`.
- [ ] 5.3 Run focused tests for shared create intent, Repair Requests deep-link flow, Dashboard, Equipment, and QR scanner entry points.
- [ ] 5.4 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`.
- [ ] 5.5 Run `openspec validate centralize-repair-request-create-intent --strict`.
