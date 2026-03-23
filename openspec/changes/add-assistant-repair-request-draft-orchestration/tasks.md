## 1. Stream Contract Spike
- [ ] 1.1 Red: add an isolated stream test proving synthetic `tool-input-available` and `tool-output-available` chunks become a `tool-generateRepairRequestDraft` message part
- [ ] 1.2 Green: implement the minimum writer helper needed for that test to pass without changing repair-draft behavior yet
- [ ] 1.3 Refactor: extract reusable stream assertion helpers and document the chunk contract

## 2. Draft Session Detection
- [ ] 2.1 Red: add tests for explicit draft intent, multi-turn continuation, cancellation, non-draft repair conversations, and the shipped starter-chip phrase `Tạo phiếu yêu cầu sửa chữa thiết bị`
- [ ] 2.2 Green: implement repair-draft session helpers with explicit start and cancel phrase lists plus shared helpers that `routeChatIntent()` can consult
- [ ] 2.3 Refactor: centralize phrase constants and keep matching conservative across session detection, intent routing, and prompt-facing copy

## 3. Evidence Normalization
- [ ] 3.1 Red: add tests for zero, one, and multiple `equipmentLookup` results plus accumulated `evidenceRefs`
- [ ] 3.2 Green: implement evidence collection and single-equipment normalization helpers
- [ ] 3.3 Refactor: isolate tool-result parsing from orchestration entrypoints

## 4. Structured Extraction
- [ ] 4.1 Red: add tests for complete fields, missing required fields, and canceled draft sessions
- [ ] 4.2 Green: implement the secondary extraction schema/prompt and `RepairRequestDraftInput` assembly
- [ ] 4.3 Refactor: move extraction prompt/schema helpers into a dedicated module

## 5. Route Orchestration
- [ ] 5.1 Red: add end-to-end `/api/chat` tests for successful draft emission, for preserving `equipmentLookup` on explicit draft-intent turns, and for no emission when fields are missing or equipment is ambiguous
- [ ] 5.2 Green: wire `buildRepairRequestDraft()` into the route wrapper, update repair-intent routing to preserve draft evidence collection, and emit synthetic tool chunks on the success path
- [ ] 5.3 Refactor: keep `route.ts` thin by delegating all repair-draft logic to one orchestration helper

## 6. Prompt Contract Alignment
- [ ] 6.1 Red: update prompt tests to assert that missing required fields trigger follow-up questions and that the model does not assume direct access to `generateRepairRequestDraft`
- [ ] 6.2 Green: revise the repair-request draft section in `src/lib/ai/prompts/system.ts`
- [ ] 6.3 Refactor: align prompt wording with the final orchestration contract and capability naming

## 7. Verification
- [ ] 7.1 Run `npm run typecheck`
- [ ] 7.2 Run `npm run lint`
- [ ] 7.3 Run focused route/session/extraction tests
- [ ] 7.4 Run `openspec validate add-assistant-repair-request-draft-orchestration --strict`
