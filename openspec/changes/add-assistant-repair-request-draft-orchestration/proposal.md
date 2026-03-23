## Why

The assistant UI already advertises a repair-request draft flow, but `/api/chat` never calls `buildRepairRequestDraft()`. As a result, the app can render `repairRequestDraft` artifacts but production cannot emit them, so the starter chip and follow-up copy promise a structured draft flow that currently dead-ends into plain chat.

## What Changes

- Add route-level orchestration in `/api/chat` to emit a structured `repairRequestDraft` after the normal read-only assistant pass completes.
- Keep `generateRepairRequestDraft` orchestration-only; it remains excluded from the model's runtime tool registry.
- Add secondary structured extraction to normalize user-provided draft fields from the active repair-draft conversation.
- Support multi-turn repair-draft sessions with explicit start, continuation, and cancellation rules.
- Require follow-up questions when `mo_ta_su_co` or `hang_muc_sua_chua` is missing instead of inferring missing required fields.
- Preserve the existing UI handoff: assistant draft card -> TanStack Query cache -> `/repair-requests?action=create`.

## Impact

- Affected specs: NEW `assistant-repair-drafts` capability
- Affected code:
  - `src/app/api/chat/route.ts`
  - `src/lib/ai/draft/*`
  - `src/lib/ai/prompts/system.ts`
  - `src/lib/ai/tools/registry.ts`
  - `src/app/api/chat/__tests__/*`
