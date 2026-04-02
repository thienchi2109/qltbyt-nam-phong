## 1. RED: Capture The Regression In Failing Tests

- [ ] 1.1 Add a failing test proving a completed or approved transfer detail dialog renders requester and approver after resolving dedicated detail data
- [ ] 1.2 Add a failing test proving a pending transfer detail dialog renders requester without an empty approver row when no approver exists
- [ ] 1.3 Add a failing test proving list-row payload with requester and approver IDs only still resolves related people through the detail read path
- [ ] 1.4 Run the focused Transfers detail-dialog tests and confirm they fail for the expected missing-related-people reason before implementation

## 2. GREEN: Implement The Minimal Detail Read Path

- [ ] 2.1 Add or update the transfer detail RPC contract so `nguoi_yeu_cau` and `nguoi_duyet` are included when resolvable
- [ ] 2.2 Whitelist any new transfer detail RPC in the RPC proxy if required
- [ ] 2.3 Update the Transfers detail dialog to fetch or receive the dedicated transfer detail payload when opened
- [ ] 2.4 Render `Người yêu cầu` and `Người duyệt` from the detail payload for transfer requests in any status while keeping non-people sections unchanged
- [ ] 2.5 Re-run the focused Transfers detail-dialog tests and confirm they pass

## 3. REFACTOR: Tighten Types And Boundaries Without Changing Behavior

- [ ] 3.1 Update frontend transfer types so the detail payload models nested requester and approver users explicitly
- [ ] 3.2 Remove or isolate redundant assumptions that related people come from list-row enrichment
- [ ] 3.3 Confirm list and kanban row payload consumers remain unaffected by the detail-only contract
- [ ] 3.4 Re-run the focused Transfers detail-dialog tests after refactor and confirm they stay green

## 4. Verification

- [ ] 4.1 Run `node scripts/npm-run.js run verify:no-explicit-any`
- [ ] 4.2 Run `node scripts/npm-run.js run typecheck`
- [ ] 4.3 Run focused tests for Transfers detail dialog behavior
- [ ] 4.4 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
- [ ] 4.5 Run `openspec validate update-transfer-detail-related-people --strict`
