## Context

The current assistant stack has three disconnected pieces:

1. `AssistantPanel` requests `generateRepairRequestDraft`.
2. `buildRepairRequestDraft()` can build the structured artifact that the UI already knows how to render.
3. `/api/chat` only runs the normal `streamText` tool loop and never orchestrates the draft builder.

This proposal closes that gap without turning repair-draft generation into a model-autonomous tool.

## Goals / Non-Goals

### Goals
- Emit a valid `repairRequestDraft` artifact from `/api/chat` when the conversation provides enough information.
- Keep the existing tool registry safety boundary intact.
- Support multi-turn draft collection until either success or explicit cancellation.
- Keep the route thin by extracting draft-session, evidence, and extraction logic into helper modules.
- Make the implementation TDD-first so the stream contract is proven before route wiring lands.

### Non-Goals
- Auto-create or auto-submit repair requests.
- Change the existing draft card UI or deep-link handoff.
- Add a loading-state tool card for the secondary extraction pass in v1.
- Infer missing required draft fields from historical data or system evidence alone.

## Decisions

### Decision 1: Two-phase orchestration
- The primary pass remains the existing read-only `streamText` execution.
- After the base stream finishes, the route evaluates whether the conversation is in an active repair-draft session and whether the evidence is sufficient.
- Only then does the route run a secondary structured extraction pass and call `buildRepairRequestDraft()`.
- Rationale: this preserves the existing read-only assistant behavior while enabling a structured artifact only when route-owned guards pass.

### Decision 2: Route-owned draft emission
- `generateRepairRequestDraft` remains excluded from `buildToolRegistry()`.
- The route appends synthetic `tool-input-available` and `tool-output-available` chunks only after a final draft exists.
- Rationale: the model should not be able to autonomously create advisory artifacts that look like completed forms without route-level validation.

### Decision 3: Explicit draft sessions with continuation and cancellation
- A draft session starts only on explicit draft-intent language such as `tạo phiếu sửa chữa`, `lập yêu cầu sửa chữa`, `soạn yêu cầu sửa chữa`, or `điền trước form sửa chữa`.
- The session stays active across follow-up turns until either a draft is emitted or the user cancels with language such as `thôi không tạo nữa`, `hủy tạo phiếu`, or `không cần tạo phiếu`.
- Rationale: this avoids surprise draft creation during general troubleshooting while still supporting natural multi-turn completion.

### Decision 4: Missing required fields trigger follow-up, not inference
- The route only emits a draft when a single equipment target is resolved and both `mo_ta_su_co` and `hang_muc_sua_chua` are present.
- Secondary extraction may normalize wording, but it must not invent missing required fields from repair history or equipment metadata.
- Rationale: the draft represents a user-submittable form, so required intent and content must come from the conversation itself.

## Module Boundaries

- `route.ts`
  - Runs the primary assistant stream.
  - Delegates post-stream repair-draft work to a single orchestration entrypoint.
  - Emits synthetic tool chunks only on the success path.
- `repair-request-draft-session.ts`
  - Detects explicit draft intent, active session continuation, and cancellation.
- `repair-request-draft-evidence.ts`
  - Reads accumulated tool results, collects `evidenceRefs`, and normalizes `equipmentLookup` down to exactly one equipment target.
- `repair-request-draft-extraction.ts`
  - Runs the secondary structured extraction over the active conversation slice and returns normalized user-provided draft fields plus missing-field signals.
- `repair-request-draft-orchestrator.ts`
  - Coordinates session, evidence, extraction, and final `buildRepairRequestDraft()` assembly.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Synthetic tool chunks may not match the current AI SDK UI message contract | Start with a writer-path spike test that proves the exact chunk contract before route wiring |
| Route logic could balloon into another large orchestration file | Keep route ownership to one helper call and extract all draft-specific logic into dedicated modules |
| The model may imply a draft is ready when required fields are still missing | Update prompt wording and gate artifact emission on route-owned validation |
| Ambiguous equipment matches could create incorrect drafts | Require exactly one normalized equipment result before any draft is emitted |

## Migration Plan

No data migration is required. This is a runtime orchestration change that unlocks an already-designed UI path without changing persisted schema or RPC contracts.
