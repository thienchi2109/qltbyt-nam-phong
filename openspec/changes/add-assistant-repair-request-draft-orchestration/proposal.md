## Why

The assistant UI already advertises a repair-request draft flow, but `/api/chat` never calls `buildRepairRequestDraft()`. As a result, the app can render `repairRequestDraft` artifacts but production cannot emit them, so the starter chip and follow-up copy promise a structured draft flow that currently dead-ends into plain chat.

## What Changes

- Add route-level orchestration in `/api/chat` to emit a structured `repairRequestDraft` after the normal read-only assistant pass completes.
- Keep `generateRepairRequestDraft` orchestration-only; it remains excluded from the model's runtime tool registry.
- Align repair-intent routing so explicit repair-draft starts keep `equipmentLookup` available instead of collapsing into the existing `repairSummary`-only request-status path.
- Add secondary structured extraction to normalize user-provided draft fields from the active repair-draft conversation.
- Support multi-turn repair-draft sessions with explicit start, continuation, and cancellation rules.
- Include the currently shipped starter-chip phrasing (`Tạo phiếu yêu cầu sửa chữa thiết bị`) in the explicit start contract so the advertised UI entry point starts the same draft flow.
- Require follow-up questions when `mo_ta_su_co` or `hang_muc_sua_chua` is missing instead of inferring missing required fields.
- Preserve the existing UI handoff: assistant draft card -> TanStack Query cache -> `/repair-requests?action=create`.

## Impact

- Affected specs: NEW `assistant-repair-drafts` capability
- Affected code:
  - `src/app/api/chat/route.ts`
  - `src/lib/ai/intent-routing.ts`
  - `src/lib/ai/draft/*`
  - `src/lib/ai/prompts/system.ts`
  - `src/lib/ai/prompts/starter-suggestions.ts`
  - `src/lib/ai/tools/registry.ts`
  - `src/lib/ai/__tests__/intent-routing.test.ts`
  - `src/lib/ai/prompts/__tests__/starter-suggestions.test.ts`
  - `src/app/api/chat/__tests__/*`
