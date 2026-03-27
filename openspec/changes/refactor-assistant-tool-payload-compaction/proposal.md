## Why

The assistant currently re-sends raw tool outputs in `messages` on every follow-up turn. Large RPC payloads, especially `categorySuggestion`, can push `/api/chat` past the input-size budget and break normal assistant conversations with `Request exceeds input size limit`.

The fix needs to be architectural, but the rollout must stay scoped. Pass 1 should harden read-only / RPC tools without destabilizing the existing draft-tool UI/session contract.

## What Changes

- Introduce a payload-compaction contract for assistant read-only / RPC tools using compact model-visible summaries plus follow-up context.
- Compact migrated read-only / RPC tool outputs on both the client transport and the server before model execution, with separate raw-request and compacted-context budgets.
- Redesign `categorySuggestion` so it asks for `device_name` first, then returns a bounded candidate set instead of the full category catalog.
- Migrate `departmentList` to the same envelope contract without requiring an artifact channel in pass 1.
- Explicitly carve out `generateTroubleshootingDraft` and synthetic `generateRepairRequestDraft` so they keep their current raw draft artifact outputs.
- Keep rollout clean-slate for the assistant chat feature: no backward-compatibility layer, no protocol versioning, no dual-shape compaction.
- Add a hard registry/test gate so every read-only / RPC tool must declare migration metadata; pass 1 marks only `categorySuggestion` and `departmentList` as `migrated`, while all other RPC tools remain explicitly `pending`.
- Defer `uiArtifact` client storage/rendering until a later pass.

## Impact

- Affected specs: NEW `assistant-tool-payload-safety` capability
- Related changes:
  - `openspec/changes/add-assistant-repair-request-draft-orchestration/`
- Affected code:
  - `src/components/assistant/AssistantPanel.tsx`
  - `src/app/api/chat/route.ts`
  - `src/lib/ai/limits.ts`
  - `src/lib/ai/prompts/system.ts`
  - `src/lib/ai/tools/registry.ts`
  - `src/lib/ai/tools/rpc-tool-executor.ts`
  - `src/lib/ai/draft/repair-request-draft-evidence.ts`
  - `src/lib/ai/draft/repair-request-draft-orchestrator.ts`
  - `supabase/migrations/*category*`
  - `src/app/api/chat/__tests__/*`
  - `src/lib/ai/tools/__tests__/*`
  - `docs/plans/2026-03-25-ai-tool-payload-compaction-design.md`
  - `docs/plans/2026-03-26-payload-compaction-gap-resolutions.md`
