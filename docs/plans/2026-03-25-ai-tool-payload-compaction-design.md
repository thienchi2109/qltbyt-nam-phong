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
- The chat route rejects requests when `JSON.stringify(messages).length` exceeds `AI_MAX_INPUT_CHARS` in [src/app/api/chat/route.ts](/root/qltbyt-nam-phong/src/app/api/chat/route.ts).
- `categorySuggestion` currently maps to `ai_category_list`, which returns the full facility category catalog, including `mo_ta`, `tu_khoa`, and `parent_name`, aggregated as JSON in [supabase/migrations/20260314164300_add_ai_category_list_rpc.sql](/root/qltbyt-nam-phong/supabase/migrations/20260314164300_add_ai_category_list_rpc.sql).
- The tool executor returns the RPC payload as-is in [src/lib/ai/tools/rpc-tool-executor.ts](/root/qltbyt-nam-phong/src/lib/ai/tools/rpc-tool-executor.ts).
- The chat UI uses `useChat` with `DefaultChatTransport` in [src/components/assistant/AssistantPanel.tsx](/root/qltbyt-nam-phong/src/components/assistant/AssistantPanel.tsx), and the transport re-sends the full `messages` array on each turn.
- Tool outputs are persisted in `message.parts[*].output` and therefore remain part of the serialized history.

### Why This Will Recur
- The failure is caused by an architectural coupling between:
  - large tool outputs,
  - persistent message history,
  - full-history resend behavior in AI SDK UI transport,
  - a route-level input-size budget.
- Any current or future tool that returns large lists, verbose JSON, or rich artifacts can trigger the same class of failure.

## 3. Decision

Adopt a **three-layer payload safety architecture**:

1. **Tool contract layer**
   - Tools return model-safe summaries, not raw database payloads.
   - Large raw responses become UI artifacts addressed by reference.

2. **Transport compaction layer**
   - Before `/api/chat` requests are sent, `messages` are compacted so model context contains summaries instead of full tool outputs.

3. **Server guardrail layer**
   - The chat route compacts and validates incoming history again before model execution.
   - The server remains authoritative even if a client transport forgets to compact.

This is the default policy for all assistant tools.

## 4. Design Principles

### 4.1. Model context is not a database dump
- `messages` sent to the model must contain only reasoning-grade context.
- Raw lists, full result sets, and verbose structured payloads must not be kept in model-visible history.

### 4.2. UI needs and model needs are different
- The UI may need detailed payloads to render cards, previews, and review workflows.
- The model usually needs only:
  - a short summary,
  - selected fields,
  - a count,
  - a top-k subset,
  - or an artifact reference.

### 4.3. No tool-specific exceptions
- Payload control must live in shared infrastructure.
- A tool should not be able to bypass compaction merely because it uses a different RPC or output shape.

### 4.4. Server-side enforcement is mandatory
- Client-side compaction improves UX and request efficiency.
- Server-side compaction prevents regressions, drift, and alternate client breakage.

## 5. Chosen Remediation Strategy

### 5.1. Introduce a normalized tool output contract

Every tool result should be transformed into a structure with two channels:

```ts
type ToolResponseEnvelope = {
  modelSummary: {
    summaryText: string
    importantFields?: Record<string, unknown>
    itemCount?: number
    truncated?: boolean
  }
  uiArtifact?: {
    artifactId: string
    kind: string
    metadata?: Record<string, unknown>
  }
}
```

Rules:
- `modelSummary` is the only part eligible to flow back into model-visible `messages`.
- `uiArtifact` points to the richer payload used for rendering or follow-up UI actions.
- Full raw tool payloads must not be embedded directly into persistent chat history after execution.

### 5.2. Convert `categorySuggestion` from catalog dump to candidate retrieval

`categorySuggestion` should stop returning the full category tree for a facility.

New behavior:
- If the user has not provided a device name, the assistant asks for it first and does not call the tool.
- When a device name is available, the tool receives the device name as input.
- The server returns only top candidate categories needed for reasoning and explanation.
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
- artifact-eligible payload types

If a tool output exceeds budget:
- summarize it,
- truncate it to top-k,
- or move the raw payload to an artifact channel.

Budget enforcement belongs in shared tool execution plumbing, not scattered across individual tools.

### 5.4. Compact message history before transport

The chat transport should compact outgoing messages before they are serialized and sent to `/api/chat`.

Compaction behavior should:
- strip large `output` payloads from tool parts,
- replace them with compact summaries,
- preserve enough metadata for continuity,
- keep UI-only state outside model-visible history.

This lowers payload size early and prevents avoidable 400 responses.

### 5.5. Compact and validate again on the server

The server must perform the same class of protection before converting UI messages to model messages.

Server responsibilities:
- compute size based on compacted history, not raw UI transcript,
- reject malformed or non-compactable payloads,
- log the largest contributing message parts,
- keep the input limit as a safety rail rather than the first line of defense.

## 6. Cross-Tool Guardrail Policy

The following rules should apply to every assistant tool:

1. No tool may persist large raw query results directly in model-visible history.
2. Every tool must produce a compact model-safe summary.
3. Every large or rich output must be artifact-capable.
4. Shared executor logic must enforce payload budgets.
5. The transport must compact before sending.
6. The server must compact again before model execution.
7. Prompt instructions must not force premature broad retrieval when required user input is still missing.

If a new tool cannot satisfy these rules, it is not ready to ship.

## 7. Prompt and Product Behavior Changes

The system prompt for `categorySuggestion` should change from:
- mandatory pre-fetch of all categories before clarification

to:
- ask for the device name first when it is missing,
- call the tool only after the minimum identifying input is available,
- reason over top candidates returned by the server.

More generally:
- prompts must not force broad retrieval before required disambiguation inputs are known,
- because premature retrieval multiplies payload size and token waste.

## 8. Observability Requirements

To prevent recurrence, add structured telemetry for each assistant turn:
- serialized raw message size
- compacted message size
- largest message part by byte size
- tool name that produced the largest payload
- whether artifact fallback was used
- whether truncation occurred
- whether server-side compaction differed from client-side compaction

These metrics should make payload regressions visible before users hit hard limits.

## 9. Rollout Plan

### Phase 1. Safety rails
- Add shared compaction logic in the chat request path.
- Add server-side logging for payload contributors.
- Keep the existing input limit in place.

### Phase 2. Tool contract migration
- Migrate large-output tools to the envelope pattern.
- Start with `categorySuggestion`, then audit all list- and summary-style tools.

### Phase 3. Prompt alignment
- Remove prompt instructions that force broad retrieval before required clarification.
- Update prompt examples to favor ask-first, retrieve-second behavior.

### Phase 4. Hardening
- Add tests for oversized tool payload histories.
- Add regression tests ensuring follow-up turns stay under the input budget.
- Fail fast in development when a tool exceeds its declared model-visible budget.

## 10. Non-Goals

- Raising `AI_MAX_INPUT_CHARS` as the primary fix
- Tool-specific hotfixes without shared compaction infrastructure
- Preserving full raw tool payloads inside model-visible `messages`
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

### Risk: partial migration leaves old tools unsafe
Mitigation:
- place server-side compaction and budget enforcement in shared infrastructure first,
- then migrate tools incrementally.

## 12. Final Recommendation

The durable fix is to treat large tool outputs as **artifacts**, not as **chat history**.

Concretely:
- compact tool outputs into model-safe summaries,
- move large raw payloads behind artifact references,
- compact history in both transport and server layers,
- redesign `categorySuggestion` to return candidate matches only after the device name is known,
- and enforce payload budgets centrally for every tool.

This addresses the current bug at its root and prevents the same failure pattern from resurfacing under other tool names.

## 13. Review Findings — Open Decisions (2026-03-25)

> Codebase-verified review using GitNexus context/query/impact, grep, and direct file reads.
> All root-cause claims in §2 were confirmed against the live codebase.
> The following issues must be resolved before writing the implementation plan.

### 13.1. Raw payload storage mechanism is unspecified

**Gap:** `ToolResponseEnvelope.uiArtifact` holds an `artifactId` reference, but nothing describes where the raw payload lives at runtime. Without a concrete store, UI components cannot render rich tool outputs.

**Evidence:** `rpc-tool-executor.ts` (37 lines) currently returns `payload` directly with no transformation or caching.

**Resolution:** Add a `rawPayload?: unknown` field to `ToolResponseEnvelope` that is explicitly excluded from `messages` serialization, OR define an in-memory artifact store (e.g., `Map<artifactId, unknown>` scoped to the chat session in React state) that UI components can read from.

### 13.2. Model-visible fields for `categorySuggestion` are unspecified

**Gap:** §5.2 says "return only top candidate categories" but does not specify which fields from `ai_category_list` should be model-visible.

**Evidence:** The SQL function returns 7 fields per row: `id`, `ma_nhom`, `ten_nhom`, `phan_loai`, `mo_ta`, `tu_khoa`, `parent_name`. The `mo_ta` and `tu_khoa` fields are the highest-volume contributors.

**Resolution:** Lock in model-visible fields: `{ ten_nhom, phan_loai, parent_name }` with `top_k = 10`. The remaining fields (`mo_ta`, `tu_khoa`, `id`, `ma_nhom`) go to the artifact channel only.

### 13.3. Prompt-only enforcement for `categorySuggestion` — needs server-side gate

**Gap:** §7 proposes prompt changes to "ask for device name first," but prompts are advisory. The model can still call `categorySuggestion` without a device name, bypassing the intended control.

**Evidence:** `registry.ts:109-113` defines `categorySuggestion` with `inputSchema: z.object({}).strict()` — no required `device_name` parameter.

**Resolution:** Add a required `device_name` parameter to `categorySuggestion`'s `inputSchema`. If the model calls the tool without it, Zod validation rejects the call before RPC execution. This aligns with §4.4 ("Server-side enforcement is mandatory").

### 13.4. Budget configuration location is underspecified

**Gap:** §5.3 lists budget dimensions (max items, max bytes, allowed fields) but does not specify where these live. This blocks implementation.

**Evidence:** `ReadOnlyToolDefinition` in `registry.ts` currently has only `description`, `rpcFunction`, `inputSchema` — no budget fields.

**Resolution:** Extend `ReadOnlyToolDefinition`:

```ts
type ReadOnlyToolDefinition = {
  description: string
  rpcFunction: string
  inputSchema: z.ZodType<Record<string, unknown>>
  modelBudget?: {
    maxItems?: number        // default: 20
    maxBytes?: number        // default: 4000
    modelVisibleFields?: string[]
  }
}
```

Budget enforcement goes in `executeRpcTool` or a new `compactToolOutput` wrapper called from `buildToolRegistry`.

### 13.5. Observability logging target is unspecified

**Gap:** §8 lists comprehensive telemetry fields but not where they go.

**Evidence:** `route.ts` currently uses `console.info`/`console.error` with structured JSON fragments (e.g., `[chat] Model attempt start`).

**Resolution:** Follow the existing pattern: emit structured JSON via `console.info('[chat:payload]', { rawBytes, compactedBytes, largestPart, toolName, artifactUsed, truncated })`. This is filterable in Vercel logs and requires no new infrastructure.

### 13.6. Compaction insertion point in `route.ts` is unclear

**Gap:** §5.5 says server-side compaction should happen "before converting UI messages to model messages," but does not specify where in the 347-line `route.ts` this sits.

**Evidence:** The current execution order is:
1. `chatRequestSchema.safeParse` (line 113)
2. `calculateInputChars` size check (line 129-132)
3. `validateUIMessages` (line 136)
4. `convertToModelMessages` (line 211)

**Resolution:** Insert compaction between steps 3 and 4. The updated flow:
1. Parse → 2. Validate → 3. **Compact tool outputs in validated `UIMessage[]`** → 4. Size check on compacted messages → 5. Convert to model messages.

Note: The size check (step 2→4) should move _after_ compaction so it measures the actual model-visible payload, not the raw UI transcript.

### 13.7. No backward compatibility plan for in-flight chat sessions

**Gap:** If a user has an active chat session with large tool outputs already embedded in `messages`, transport compaction could strip data that is still visible in the UI, causing confusion.

**Evidence:** `AssistantPanel.tsx` uses `useChat` with `DefaultChatTransport`, which stores `messages` in React state. There is no versioning or migration mechanism for in-flight message history.

**Resolution:** Adopt best-effort compaction — if a message part has a large `output` but no `artifactId`, compact it to a summary with a `[legacy]` marker. Do NOT clear chat history on deploy. The UI should gracefully degrade: if the artifact store has no entry for a referenced `artifactId`, render a "data no longer available" placeholder.
