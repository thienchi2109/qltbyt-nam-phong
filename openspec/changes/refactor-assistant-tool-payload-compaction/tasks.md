## 1. Batch 1: Foundations and Compatibility
- [x] 1.1 Red: add contract tests for a read-only / RPC tool output envelope and for draft evidence surviving migration through `followUpContext`
- [x] 1.2 Green: implement shared compaction helpers and envelope typing for migrated read-only / RPC tools only
- [x] 1.3 Green: switch draft evidence collection to `followUpContext` for draft-eligible read-only / RPC tools without changing draft-tool output shape
- [x] 1.4 Refactor: keep draft-tool outputs on their current raw path and isolate the carve-out/evidence parsing logic from generic compaction helpers

## 2. Batch 2: Pass-1 Tool Migrations
- [ ] 2.1 Red: add tests for missing `device_name`, bounded `categorySuggestion` candidate retrieval, compact model-visible fields, and `departmentList` envelope resend behavior
- [ ] 2.2 Green: update `categorySuggestion` prompt, tool schema, and SQL contract together so it asks first and returns top-k candidates
- [ ] 2.3 Green: migrate `departmentList` to the shared read-only / RPC envelope contract with `uiArtifact = undefined`
- [ ] 2.4 Green: update system prompt §4 to guide model reading envelope-shaped tool output (`modelSummary.itemCount` for counts, `uiArtifact.rawPayload.data` for lists) — required because Batch 1 changed the output shape from `{ data, total }` to `ToolResponseEnvelope`
- [ ] 2.5 Refactor: align ranking/budget helpers and tool display metadata without widening pass-1 scope beyond the two migrated tools

## 3. Batch 3: Transport and Server Guardrails
- [ ] 3.1 Red: add `/api/chat` tests for separate raw-request vs compacted-context budgets and for follow-up turns that previously exceeded the raw history budget
- [ ] 3.2 Green: wire `prepareSendMessagesRequest` into the client transport and compact validated read-only / RPC tool outputs again on the server before `convertToModelMessages`
- [ ] 3.3 Refactor: keep route orchestration thin by delegating compaction and budget enforcement to focused helpers

## 4. Batch 4: Migration Gate and Final Verification
- [ ] 4.1 Red: add contract tests that lock the exact `migrationStatus` map for all read-only / RPC tools
- [ ] 4.2 Green: require `migrationStatus` and budget metadata on every read-only / RPC tool definition, with only `categorySuggestion` and `departmentList` marked `migrated` in pass 1
- [ ] 4.3 Refactor: document the remaining pending tools in registry-adjacent comments or helper constants so later audits cannot drift from the test gate
- [ ] 4.4 Run `node scripts/npm-run.js run verify:no-explicit-any`
- [ ] 4.5 Run `node scripts/npm-run.js run typecheck`
- [ ] 4.6 Run focused assistant route/tool/draft tests
- [ ] 4.7 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
- [ ] 4.8 Run `openspec validate refactor-assistant-tool-payload-compaction --strict`
