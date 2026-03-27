## 1. Read-Only / RPC Compaction Contract
- [ ] 1.1 Red: add contract tests for a read-only / RPC tool output envelope plus client/server compaction behavior on follow-up turns
- [ ] 1.2 Green: implement shared compaction helpers and envelope typing for migrated read-only / RPC tools only
- [ ] 1.3 Refactor: keep draft-tool outputs on their current raw path and isolate the carve-out logic from generic compaction helpers

## 2. Draft Evidence Compatibility
- [ ] 2.1 Red: add tests proving repair-draft evidence still resolves correctly from both message-history and live-step paths after read-only / RPC tools migrate
- [ ] 2.2 Green: switch draft evidence collection to `followUpContext` for draft-eligible read-only / RPC tools
- [ ] 2.3 Refactor: centralize evidence parsing so route orchestration does not depend on raw RPC payload shapes

## 3. `categorySuggestion` Contract Migration
- [ ] 3.1 Red: add tests for missing `device_name`, bounded candidate retrieval, and compact model-visible fields
- [ ] 3.2 Green: update prompt, tool schema, and SQL contract together so `categorySuggestion` asks first and returns top-k candidates
- [ ] 3.3 Refactor: keep ranking/budget logic in shared helpers where practical, without widening pass-1 scope

## 4. `departmentList` Envelope Migration
- [ ] 4.1 Red: add tests for envelope shape and compact resend behavior
- [ ] 4.2 Green: migrate `departmentList` to the shared read-only / RPC envelope contract with `uiArtifact = undefined`
- [ ] 4.3 Refactor: align display names and summaries with the migrated tool contract

## 5. Transport and Server Guardrails
- [ ] 5.1 Red: add `/api/chat` tests for separate raw-request vs compacted-context budgets and for follow-up turns that previously exceeded the raw history budget
- [ ] 5.2 Green: wire `prepareSendMessagesRequest` into the client transport and compact validated read-only / RPC tool outputs again on the server before `convertToModelMessages`
- [ ] 5.3 Refactor: keep route orchestration thin by delegating compaction and budget enforcement to focused helpers

## 6. Remaining RPC Migration Gate
- [ ] 6.1 Red: add contract tests that lock the exact `migrationStatus` map for all read-only / RPC tools
- [ ] 6.2 Green: require `migrationStatus` and budget metadata on every read-only / RPC tool definition, with only `categorySuggestion` and `departmentList` marked `migrated` in pass 1
- [ ] 6.3 Refactor: document the remaining pending tools in registry-adjacent comments or helper constants so later audits cannot drift from the test gate

## 7. Verification
- [ ] 7.1 Run `node scripts/npm-run.js run verify:no-explicit-any`
- [ ] 7.2 Run `node scripts/npm-run.js run typecheck`
- [ ] 7.3 Run focused assistant route/tool/draft tests
- [ ] 7.4 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
- [ ] 7.5 Run `openspec validate refactor-assistant-tool-payload-compaction --strict`
