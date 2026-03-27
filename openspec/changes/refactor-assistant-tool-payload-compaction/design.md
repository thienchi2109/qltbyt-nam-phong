## Context

The assistant stack currently has an unsafe coupling between large tool outputs, in-memory chat history, full-history resend behavior in `useChat`/`DefaultChatTransport`, and a route-level input-size budget. The result is that a successful tool call can poison later turns by making the next `/api/chat` request too large to accept.

Two detailed design documents already capture the root cause and pass-1 scope:

- `docs/plans/2026-03-25-ai-tool-payload-compaction-design.md`
- `docs/plans/2026-03-26-payload-compaction-gap-resolutions.md`

This OpenSpec change proposal turns those implementation-oriented design notes into a spec-driven rollout with explicit boundaries.

There is also a live assistant-related change to preserve: `add-assistant-repair-request-draft-orchestration`. That change established raw draft artifact contracts that the current UI/session logic reads directly via `output.kind`, so pass 1 must not envelope those draft-producing outputs.

## Goals / Non-Goals

### Goals
- Prevent oversized follow-up assistant requests caused by large read-only / RPC tool outputs.
- Introduce a shared compaction contract for migrated read-only / RPC tools.
- Keep client and server compaction aligned with separate raw-request and compacted-context budgets.
- Migrate only `categorySuggestion` and `departmentList` in pass 1.
- Preserve the existing raw output contract for draft-producing tools.
- Enforce a hard migration-status gate so remaining RPC tools cannot be forgotten.

### Non-Goals
- Migrate every assistant tool in pass 1.
- Change the output contract of `generateTroubleshootingDraft` or synthetic `generateRepairRequestDraft`.
- Add protocol versioning, dual-shape compatibility, or client auto-reset on deploy.
- Introduce server-backed artifact persistence.
- Build client artifact rendering/storage in pass 1.

## Decisions

### Decision 1: Scope the envelope contract to read-only / RPC tools only
- `ToolResponseEnvelope` applies only to migrated read-only / RPC tools.
- Draft-producing tools remain on their current raw artifact path.
- Rationale: this fixes the payload-resend failure class without breaking the current draft UI/session contract.

### Decision 2: Clean-slate rollout for assistant chat
- No backward-compatibility layer is added for legacy tool-output shapes.
- No dual-shape server compaction or protocol-version reset is introduced.
- Rationale: the assistant feature currently has no real users, and chat history is not persisted server-side.

### Decision 3: Pass 1 migrates only `categorySuggestion` and `departmentList`
- `categorySuggestion` changes from catalog dump to ask-first, bounded candidate retrieval.
- `departmentList` adopts the same compact envelope contract without an artifact channel.
- All other read-only / RPC tools stay explicitly `pending`.
- Rationale: this is the narrowest slice that fixes the current failure and proves the shared compaction pattern.

### Decision 4: Compact twice, but only for migrated read-only / RPC tools
- Client transport compacts outgoing `messages` before serialization.
- Server compacts validated UI messages again before `convertToModelMessages`.
- Draft-producing outputs pass through untouched.
- Rationale: client compaction improves UX and request size; server compaction prevents drift and alternate-client regressions.

### Decision 5: Make follow-up orchestration depend on `followUpContext`
- Draft evidence collectors stop depending on raw `output.data` from migrated read-only / RPC tools.
- `equipmentLookup`, `repairSummary`, `maintenanceSummary`, `maintenancePlanLookup`, and `usageHistory` expose fixed `followUpContext` contracts for downstream draft flows.
- Rationale: the draft flow must survive history compaction and must not depend on raw RPC payload retention.

### Decision 6: Use a hard migration gate instead of memory
- Every read-only / RPC tool definition declares `migrationStatus` and budget metadata.
- Tests lock the exact migration-status map so new tools or status changes cannot bypass audit.
- Rationale: the remaining migration backlog must be enforced by the codebase, not by tribal memory.

### Decision 7: Defer `uiArtifact` storage/rendering
- `uiArtifact` remains optional in the envelope contract.
- Pass 1 does not add a client-side artifact store.
- Rationale: the current assistant UI renders tool status only, so artifact infrastructure adds complexity without immediate product value.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Over-broad envelope rollout breaks draft UI/session logic | Explicitly carve out draft-producing tools in both spec and implementation |
| `categorySuggestion` loses reasoning quality after payload trimming | Require ask-first behavior plus bounded candidate retrieval with critical identifying fields kept model-visible |
| Client and server compaction drift apart | Compact in both places and add route-level regression tests for follow-up turns |
| Remaining RPC tools never get audited | Lock the exact migration-status map in tests |
| Scope grows into artifact rendering or full-tool migration | Defer artifact store and keep all non-pass-1 RPC tools explicitly `pending` |

## Migration Plan

1. Land shared compaction primitives and the explicit draft-tool carve-out.
2. Switch draft evidence collection to `followUpContext` where required.
3. Ship `categorySuggestion` prompt/schema/SQL migration atomically.
4. Migrate `departmentList` to the shared envelope contract.
5. Add the hard registry/test gate for the remaining RPC tools.
6. Validate the OpenSpec change and implementation-specific checks before merge.

## Open Questions

- None at proposal time. Pass-1 product and rollout scope are already locked by the detailed design docs.
