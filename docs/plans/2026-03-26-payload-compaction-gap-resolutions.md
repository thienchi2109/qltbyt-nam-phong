# Payload Compaction — Gap Resolutions (2026-03-26)

> Addendum to [2026-03-25-ai-tool-payload-compaction-design.md](./2026-03-25-ai-tool-payload-compaction-design.md).
> Resolves the four potential issues identified during codebase-verified review.

## Context

The original design identified four gaps during review. This document records the chosen resolution for each, along with rationale.

## Resolution 1: Draft flow evidence — followUpContext-only

**Problem:** `repair-request-draft-evidence.ts` reads `output.data[]` directly from `equipmentLookup` tool results. Migrating to `ToolResponseEnvelope` breaks this contract.

**Decision:** followUpContext-only.

Rules:
- Every tool that feeds draft flows **must** populate `followUpContext` with a fixed schema containing the evidence fields the draft builder needs.
- The evidence collector reads **only** `followUpContext` — never raw output, never `modelSummary`.
- `followUpContext` schema per tool is defined upfront as part of the tool contract.

Concrete schema for draft-eligible tools:

```ts
// equipmentLookup followUpContext
{
  equipment: Array<{
    thiet_bi_id: number
    ma_thiet_bi?: string
    ten_thiet_bi?: string
  }>
}

// repairSummary, maintenanceSummary, usageHistory, maintenancePlanLookup
{
  evidenceRef: string  // tool name, for evidence counting
}
```

**Rationale:** Enforces a clear contract between tool outputs and draft flows. No shape detection, no legacy fallback, no coupling between draft builder and raw RPC shape.

## Resolution 2: Legacy history — not applicable

**Problem:** Design §13.7 planned backward-compatibility for legacy tool outputs in existing chat histories.

**Decision:** Drop legacy handling entirely.

- No active users exist yet — chat history is in-memory (`useChat` state), not persisted.
- Deploying the envelope format is a clean slate.
- Remove from scope:
  - `legacyCompactionApplied` telemetry flag
  - Legacy shape detection logic
  - "Data no longer available" placeholder for old artifacts

These can be added later if persistence is introduced.

**Rationale:** YAGNI — no legacy data exists, no backward-compatibility code needed.

## Resolution 3: categorySuggestion ranking — FTS + trigram pre-filter

**Problem:** Design §5.2 says "deterministic, budget-aware ranked candidate set" but does not lock the ranking method.

**Decision:** FTS + trigram fallback as **pre-filter only**. The AI model does the semantic reasoning.

Architecture:
1. User provides `device_name` → tool sends to updated `ai_category_list` RPC.
2. RPC performs:
   - **FTS:** `plainto_tsquery('simple', device_name)` against existing `fts` column on `nhom_thiet_bi`.
   - **Trigram fallback:** If FTS returns < `top_k`, supplement with `extensions.word_similarity(device_name, ten_nhom) > 0.3` matches.
   - Merge, dedup, `LIMIT top_k` (default 10).
3. Model receives compact candidate set → reasons about best matches → outputs top 3 with explanations.

Excluded:
- **No vector embeddings** — avoids server pressure, embedding pipeline dependency.
- **No RRF hybrid search** — that infrastructure serves the Suggested Mapping UI feature, different use case.

**Rationale:** The AI model's reasoning capability replaces server-side semantic ranking. The SQL layer only needs to narrow the search space, not rank accurately.

## Resolution 4: departmentList — envelope without uiArtifact

**Problem:** `departmentList` shares the same architectural pattern (empty input, full list) as `categorySuggestion`, but its payload is much smaller.

**Decision:** Apply full `ToolResponseEnvelope` pattern with `uiArtifact = undefined`.

- Wrap output in envelope for platform consistency.
- All data fits in `modelSummary` + `followUpContext` (typically 10-50 items, no heavy fields).
- No artifact store entry needed.
- Declare `modelBudget` on the tool definition for enforcement consistency.

**Rationale:** Platform-consistent without overhead. Small payloads don't need artifact offloading but should still follow the shared contract.

## Updated Design Decisions Summary

| Gap | Resolution | Complexity |
|---|---|---|
| Draft flow regression | followUpContext-only with fixed schemas | Medium — requires defining `followUpContext` schema per draft-eligible tool |
| Legacy history detection | Not applicable (no active users) | None — removes code |
| categorySuggestion ranking | FTS + trigram pre-filter, model does reasoning | Medium — new SQL migration, update tool input schema |
| departmentList consistency | Envelope, no uiArtifact | Low — mechanical change |

## Impact on Original Design

- §13.7 (Backward compatibility): **Simplified** — drop legacy handling, `legacyCompactionApplied` flag, and "data no longer available" placeholder.
- §5.2 (categorySuggestion): **Clarified** — FTS + trigram pre-filter locked as ranking method.
- §5.1 (Tool output contract): **Extended** — `followUpContext` schemas are now mandatory for draft-eligible tools.
- §8 (Observability): **Reduced** — remove `legacyCompactionApplied` from telemetry requirements.
