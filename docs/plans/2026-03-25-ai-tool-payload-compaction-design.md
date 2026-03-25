# AI Tool Payload Compaction Design (2026-03-25)

## 1. Summary

This document records the root cause of the assistant bug that throws `Request exceeds input size limit` after the user asks for category assignment suggestions, and it locks in the architectural fix direction.

The chosen fix is to separate **UI-visible tool artifacts** from **model-visible chat context**. Raw tool payloads must no longer flow back into `messages` unchanged on subsequent turns. Instead, every tool response must be normalized into a compact model-safe summary plus an optional artifact reference for UI rendering.

This is a cross-tool platform fix, not a one-off patch for `categorySuggestion`.

## 2. Problem Statement

### Reproduction
1. User asks: `Gợi ý gán thiết bị vào danh mục định mức của đơn vị`
2. The assistant calls `categorySuggestion`
3. The assistant asks a follow-up question requesting the device name
4. User replies: `bàn mổ`
5. The app throws: `Request exceeds input size limit`

### Observed Root Cause
- The chat route rejects requests when `JSON.stringify(messages).length` exceeds `AI_MAX_INPUT_CHARS` in [src/app/api/chat/route.ts](../../src/app/api/chat/route.ts).
- `categorySuggestion` currently maps to `ai_category_list`, which returns the full facility category catalog, including `mo_ta`, `tu_khoa`, and `parent_name`, aggregated as JSON in [supabase/migrations/20260314164300_add_ai_category_list_rpc.sql](../../supabase/migrations/20260314164300_add_ai_category_list_rpc.sql).
- The tool executor returns the RPC payload as-is in [src/lib/ai/tools/rpc-tool-executor.ts](../../src/lib/ai/tools/rpc-tool-executor.ts).
- The chat UI uses `useChat` with `DefaultChatTransport` in [src/components/assistant/AssistantPanel.tsx](../../src/components/assistant/AssistantPanel.tsx), and the transport re-sends the full `messages` array on each turn.
- Tool outputs are persisted in `message.parts[*].output` and therefore remain part of the serialized history.

### Why This Will Recur
- The failure is caused by an architectural coupling between:
  - large tool outputs,
  - persistent message history,
  - full-history resend behavior in AI SDK UI transport,
  - a route-level input-size budget.
- Any current or future tool that returns large lists, verbose JSON, or rich artifacts can trigger the same class of failure.

## 3. Decision

Adopt a **balanced payload safety architecture** that combines temporary mitigation with shared compaction infrastructure:

1. **Phase 0 mitigation layer**
   - Raise the raw chat request budget from `40_000` to `120_000` characters as a temporary mitigation.
   - This reduces immediate user-facing failures but does not replace compaction.

2. **Tool contract layer**
   - Tools return normalized envelopes with `modelSummary`, `followUpContext`, and `uiArtifact`.
   - Large raw responses are treated as artifacts, not resendable chat history.

3. **Transport compaction layer**
   - Before `/api/chat` requests are sent, the transport compacts `messages` so model context contains summaries and follow-up context instead of full tool payloads.

4. **Server guardrail layer**
   - The chat route enforces both a raw request budget and a compacted model-context budget.
   - The server compacts and validates incoming history again before model execution.

This is the default policy for all assistant tools. Raising the limit is part of the design, but only as a mitigation step.

## 4. Design Principles

### 4.1. Model context is not a database dump
- `messages` sent to the model must contain only reasoning-grade context.
- Raw lists, full result sets, and verbose structured payloads must not be kept in model-visible history.

### 4.2. UI, follow-up workflows, and model needs are different
- The UI may need detailed payloads to render cards, previews, and review workflows.
- Follow-up orchestration may need compact machine-readable identifiers or evidence summaries.
- The model usually needs only:
  - a short summary,
  - selected fields,
  - a count,
  - a top-k subset,
  - follow-up-safe structured context,
  - or artifact metadata.

### 4.3. No tool-specific exceptions
- Payload control must live in shared infrastructure.
- A tool should not be able to bypass compaction merely because it uses a different RPC or output shape.

### 4.4. Server-side enforcement is mandatory
- Client-side compaction improves UX and request efficiency.
- Server-side compaction prevents regressions, drift, alternate client breakage, and oversized raw request abuse.

### 4.5. Keep the wire contract stable in this phase
- The AI SDK tool-part stream shape should remain stable.
- Normalize payloads inside `message.parts[*].output` rather than redesigning the stream protocol during this fix.

## 5. Chosen Remediation Strategy

### 5.0. Raise the raw input limit as temporary mitigation

- Increase the raw request budget from `40_000` to `120_000` characters.
- Introduce a separate compacted model-context budget of `40_000` characters.
- Raw and compacted budgets must remain independent.
- Raising the raw budget is a temporary mitigation step, not the primary fix.

### 5.1. Introduce a normalized tool output contract

Every tool result should be normalized inside the existing AI SDK tool-part shape:

```ts
type ToolResponseEnvelope = {
  modelSummary: {
    summaryText: string
    importantFields?: Record<string, unknown>
    itemCount?: number
    truncated?: boolean
  }
  followUpContext?: Record<string, unknown>
  uiArtifact?: {
    artifactId: string
    kind: string
    metadata?: Record<string, unknown>
    legacy?: boolean
  }
}
```

Rules:
- The AI SDK wire-level part shape remains stable: `message.parts[*].output` carries `ToolResponseEnvelope`.
- `modelSummary` is the only part eligible to flow back into model-visible `messages`.
- `followUpContext` stores compact machine-readable context used by orchestration and follow-up flows.
- `uiArtifact` points to the richer payload used for UI rendering.
- Raw payload may exist only transiently long enough to hydrate the client-side artifact store and must be stripped before any history is resent.
- Rich artifact payloads live in an in-memory `Map<artifactId, unknown>` scoped to the current `AssistantPanel` / chat session.
- If the UI cannot resolve a referenced artifact, it must render a graceful "data no longer available" placeholder.
- Full raw tool payloads must not be embedded directly into persistent or resendable chat history after execution.

### 5.2. Convert `categorySuggestion` from catalog dump to candidate retrieval

`categorySuggestion` should stop returning the full category tree for a facility.

New behavior:
- `categorySuggestion` requires `device_name: string` in its input schema.
- If the user has not provided a device name, the assistant asks for it first and does not call the tool.
- When a device name is available, the tool receives it as input and performs server-side candidate retrieval.
- The server returns a deterministic, budget-aware ranked candidate set rather than the full category tree.
- The model-visible fields are locked to:
  - `ma_nhom`
  - `ten_nhom`
  - `parent_name`
  - `phan_loai`
  - optional `match_reason`
  - optional `score` or `rank`
- `top_k = 10` for model-visible candidates.
- Heavy fields such as `mo_ta` and `tu_khoa` are limited to `top_3` when needed for reasoning, or moved to the artifact channel.
- The model sees a compact candidate set, not the full facility catalog.

This shifts the tool from:
- `list all categories so the model can search client-side`

to:
- `retrieve the best candidate categories for the provided device name`

That change removes the current failure mode and reduces token/input waste.

### 5.3. Add shared payload budgets for all tools

Each tool definition should declare or inherit budgets such as:
- maximum model-visible items
- maximum model-visible bytes
- allowed model-visible fields
- allowed follow-up fields
- artifact-eligible payload types

Recommended shared shape:

```ts
type ReadOnlyToolDefinition = {
  description: string
  rpcFunction: string
  inputSchema: z.ZodType<Record<string, unknown>>
  modelBudget?: {
    maxItems?: number
    maxBytes?: number
    modelVisibleFields?: string[]
    followUpFields?: string[]
  }
  artifactKind?: string
}
```

Recommended defaults:
- `maxItems = 20`
- `maxBytes = 4000`

Shared request budgets:
- `AI_MAX_RAW_INPUT_CHARS = 120_000`
- `AI_MAX_COMPACTED_INPUT_CHARS = 40_000`

If a tool output exceeds budget:
- summarize it,
- truncate it to top-k,
- preserve only required `followUpContext`,
- or move the raw payload to an artifact channel.

Budget enforcement belongs in shared tool execution plumbing, not scattered across individual tools.

### 5.4. Compact message history before transport

The chat transport should compact outgoing messages before they are serialized and sent to `/api/chat`.

Compaction behavior should:
- use `prepareSendMessagesRequest` in `DefaultChatTransport`,
- compact a copy of `messages` before serialization,
- replace raw or legacy tool outputs with `modelSummary`, `followUpContext`, and `uiArtifact` metadata,
- preserve enough metadata for continuity,
- keep artifact-store state outside resendable history,
- avoid rewriting `useChat` internal state as the primary mechanism.

This lowers payload size early and prevents avoidable 400 responses.

### 5.5. Compact and validate again on the server

The server must perform the same class of protection before converting UI messages to model messages.

Server responsibilities:
- retain an independent raw request budget,
- compute model-context size based on compacted history, not raw UI transcript,
- compact both legacy and current tool outputs,
- reject malformed or non-compactable payloads,
- log the largest contributing message parts,
- log whether legacy compaction was applied,
- keep the compacted input limit as a safety rail rather than the first line of defense.

Updated server order:
1. Parse request
2. Enforce raw request budget
3. Validate schema and UI messages
4. Compact validated `UIMessage[]`
5. Enforce compacted model-context budget
6. Convert to model messages
7. Execute model

## 6. Cross-Tool Guardrail Policy

The following rules should apply to every assistant tool:

1. No tool may persist large raw query results directly in resendable or model-visible history.
2. Every tool must produce a compact model-safe summary.
3. A tool may produce `followUpContext` when downstream logic needs compact structured evidence.
4. Every large or rich output must be artifact-capable.
5. No downstream flow may assume raw payloads survive in history; it must depend on `followUpContext` or artifact lookup.
6. Shared executor logic must enforce payload budgets.
7. The transport must compact before sending.
8. The server must compact again before model execution.
9. Prompt instructions must not force premature broad retrieval when required user input is still missing.

If a new tool cannot satisfy these rules, it is not ready to ship.

## 7. Prompt and Product Behavior Changes

The system prompt for `categorySuggestion` should change from:
- mandatory pre-fetch of all categories before clarification

to:
- ask for the device name first when it is missing,
- call the tool only after the minimum identifying input is available,
- reason over top candidates returned by the server.

Prompt and tool contract must stay aligned:
- the prompt should no longer require pre-fetching the full category catalog,
- the prompt may require the answer to cite `Mã nhóm + Tên nhóm`,
- the tool contract must therefore keep `ma_nhom` model-visible.

More generally:
- prompts must not force broad retrieval before required disambiguation inputs are known,
- because premature retrieval multiplies payload size and token waste.

## 8. Observability Requirements

To prevent recurrence, add structured telemetry for each assistant turn:
- `rawBytes`
- `compactedBytes`
- `largestPartBytes`
- `largestToolName`
- `artifactUsed`
- `truncated`
- `legacyCompactionApplied`
- whether server-side compaction differed from client-side compaction

These metrics should make payload regressions visible before users hit hard limits and make the Phase 0 mitigation observable.

## 9. Rollout Plan

### Phase 0. Temporary mitigation
- Raise the raw request limit from `40_000` to `120_000`.
- Keep telemetry on payload growth while compaction work lands.
- Do not treat this phase as a sufficient fix.

### Phase 1. Shared budgets and compaction scaffolding
- Introduce separate raw and compacted input budgets.
- Add client-side compaction in transport.
- Add server-side compaction in the chat route.
- Add structured logging for payload contributors and legacy compaction.

### Phase 2. Tool contract migration
- Migrate large-output tools to the envelope pattern with `modelSummary`, `followUpContext`, and `uiArtifact`.
- Add the client-side per-chat artifact store.
- Start with `categorySuggestion`, then audit all list- and summary-style tools.
- Audit `equipmentLookup` carefully because downstream draft flows consume its evidence.

### Phase 3. Prompt and tool alignment
- Remove prompt instructions that force broad retrieval before required clarification.
- Update prompt examples to favor ask-first, retrieve-second behavior.
- Require `device_name` for `categorySuggestion`.
- Keep `ma_nhom` available to the model because the prompt expects `Mã nhóm + Tên nhóm`.

### Phase 4. Hardening
- Add tests for oversized tool payload histories.
- Add regression tests ensuring follow-up turns stay under the compacted input budget.
- Add tests for legacy histories with no artifact-store entry.
- Fail fast in development when a tool exceeds its declared model-visible budget.

## 10. Non-Goals

- Treating a higher raw input limit as the primary or sufficient fix
- Tool-specific hotfixes without shared compaction infrastructure
- Preserving full raw tool payloads inside resendable or model-visible `messages`
- Shipping server-backed artifact persistence in this phase
- Solving `categorySuggestion` ranking accuracy with a full hybrid-search rewrite as part of this payload-safety work
- Relying on prompt wording alone as a safety boundary

## 11. Risks and Tradeoffs

### Risk: weaker reasoning after aggressive trimming
Mitigation:
- define per-tool model summaries carefully,
- preserve top-k candidates and critical explanation fields,
- keep raw payload accessible via artifact references when UI needs it.

### Risk: divergence between UI transcript and model context
Mitigation:
- make the split explicit in architecture and naming,
- centralize compaction,
- add tests for both rendered output and model-visible payload shape.

### Risk: in-memory artifact store is lost on refresh or deploy
Mitigation:
- keep `modelSummary` and `followUpContext` in resendable history,
- render a graceful placeholder when an artifact cannot be resolved,
- consider server-backed artifact persistence only as a follow-up if product needs it.

### Risk: higher raw input limit temporarily increases request bytes
Mitigation:
- separate raw and compacted budgets,
- add telemetry for raw and compacted sizes,
- prioritize compaction rollout immediately after the mitigation step.

### Risk: partial migration leaves old tools unsafe
Mitigation:
- place server-side compaction and budget enforcement in shared infrastructure first,
- then migrate tools incrementally.

## 12. Final Recommendation

The durable fix is to treat large tool outputs as **artifacts and compact follow-up context**, not as **resendable chat history**.

Concretely:
- raise the raw request limit temporarily to reduce current failures,
- split raw and compacted budgets,
- normalize tool outputs into `modelSummary`, `followUpContext`, and `uiArtifact`,
- keep rich artifact payloads in a per-chat client-side artifact store,
- compact history in transport and again on the server,
- redesign `categorySuggestion` to perform candidate retrieval only after `device_name` is known,
- keep the AI SDK wire-level part shape stable in this phase,
- and enforce payload budgets centrally for every tool.

This addresses the current bug at its root, preserves downstream orchestration needs, and prevents the same failure pattern from resurfacing under other tool names.

## 13. Locked Decisions (2026-03-25)

> Codebase-verified review using GitNexus context/query/impact, grep, and direct file reads.
> All root-cause claims in §2 were confirmed against the live codebase.
> The design-blocking questions from the review are now resolved.

### 13.1. Limit strategy

- `40_000 -> 120_000` is accepted as a temporary raw-request mitigation.
- A separate compacted model-context budget of `40_000` is required.
- Raising the limit is part of the design, but explicitly not the primary fix.

### 13.2. Tool output contract

- The AI SDK wire-level tool part shape remains stable.
- `message.parts[*].output` carries a normalized `ToolResponseEnvelope`.
- The envelope contains `modelSummary`, optional `followUpContext`, and optional `uiArtifact`.

### 13.3. Artifact storage

- Rich artifact payloads are stored in a per-chat in-memory `Map<artifactId, unknown>` scoped to the current `AssistantPanel` session.
- Missing artifact entries degrade gracefully in the UI; they do not block the conversation.
- Server-backed artifact persistence is out of scope for this phase.

### 13.4. `categorySuggestion` contract

- `device_name` is required in the tool input schema.
- `top_k = 10` for model-visible candidates.
- Model-visible candidate fields are:
  - `ma_nhom`
  - `ten_nhom`
  - `parent_name`
  - `phan_loai`
  - optional `match_reason`
  - optional `score` or `rank`
- Heavy fields (`mo_ta`, `tu_khoa`) are limited to `top_3` when needed or moved to the artifact channel.

### 13.5. Budget configuration

- Tool-level budgets live on shared tool definitions.
- Recommended defaults are `maxItems = 20` and `maxBytes = 4000`.
- Shared executor plumbing, not individual tools, is responsible for enforcement.

### 13.6. Compaction insertion points

- Client-side compaction happens in `prepareSendMessagesRequest`.
- Server-side compaction happens after `validateUIMessages` and before `convertToModelMessages`.
- A raw request budget remains in front of the compacted model-context budget.

### 13.7. Backward compatibility

- Legacy tool outputs are compacted best-effort and marked as legacy when needed.
- Existing chat history is not cleared on deploy.
- The UI shows a "data no longer available" placeholder when an old artifact cannot be resolved.

### 13.8. Remaining work status

- No design-blocking open decisions remain.
- The remaining work is implementation detail: helper naming, deterministic ranking heuristics, telemetry wiring, and tests.
