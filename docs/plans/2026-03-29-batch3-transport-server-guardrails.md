# Batch 3: Transport and Server Guardrails — Implementation Plan

## Goal

Wire client-side and server-side compaction for migrated read-only / RPC tool outputs. After Batch 3, follow-up turns that include envelope-wrapped tool outputs will be compacted both before transport serialization and again on the server before `convertToModelMessages`, enforcing the dual-budget architecture (raw request ≤ 120K, compacted model-context ≤ 40K).

## Context

Batches 1–2 established:
- `ToolResponseEnvelope` type + `compactToolOutput()` helper ([tool-response-envelope.ts](file:///e:/qltbyt-nam-phong-new/src/lib/ai/tools/tool-response-envelope.ts))
- `isToolResponseEnvelope()` type guard + `DRAFT_TOOL_NAMES_SET` carve-out
- Migrated `categorySuggestion` and `departmentList` to envelope shape
- Dual budget constants in [limits.ts](file:///e:/qltbyt-nam-phong-new/src/lib/ai/limits.ts): `AI_MAX_INPUT_CHARS = 120_000` (raw), `AI_MAX_COMPACTED_INPUT_CHARS = 40_000` (compacted)
- Current `AssistantPanel` uses `body()` on `DefaultChatTransport` — no `prepareSendMessagesRequest` yet
- Current `route.ts` enforces only the raw budget (`AI_MAX_INPUT_CHARS`), with no compaction step between `validateUIMessages` and `convertToModelMessages`

**What Batch 3 adds:** The compaction wiring at both transport boundaries, plus the compacted budget enforcement on the server.

---

## Design Decisions

### Client transport strategy

AI SDK's `HttpChatTransport.sendMessages()` resolves `body()` first and passes it as `options.body` into `prepareSendMessagesRequest`. See [http-chat-transport.ts:161-165](file:///e:/qltbyt-nam-phong-new/node_modules/ai/src/ui/http-chat-transport.ts#L161-L165): the callback receives `{ body: { ...resolvedBody, ...options.body }, messages, id, ... }`. Therefore we **keep `body()` as-is** for `selectedFacilityId` / `selectedFacilityName` / `requestedTools`, and add a **minimal `prepareSendMessagesRequest`** that only replaces `messages` with `compactUIMessages(messages)` while spreading the already-resolved body. This is the lowest-churn approach.

### Server compaction placement

The design specifies compacting *after* `validateUIMessages` and *before* `convertToModelMessages`. There is currently a direct call chain: `validateUIMessages → convertToModelMessages`. We insert a compaction step in between. The `validatedMessages` (uncompacted) are kept for stream response `originalMessages` and draft orchestration; only `compactedMessages` feeds `convertToModelMessages`.

### Draft orchestration contract

`validatedMessages` (uncompacted) must stay for:
- `originalMessages` in stream response creation
- `maybeBuildRepairRequestDraftArtifact({ messages: validatedMessages, ... })` — `collectRepairRequestDraftEvidence` reads `followUpContext` from both message history and steps ([repair-request-draft-evidence.ts:155-157](file:///e:/qltbyt-nam-phong-new/src/lib/ai/draft/repair-request-draft-evidence.ts#L155-L157))

Only `convertToModelMessages` should use `compactedMessages`.

### Budget test matrix

The raw budget check (`calculateInputChars > AI_MAX_INPUT_CHARS`) fires **before** compaction per [route.ts:129](file:///e:/qltbyt-nam-phong-new/src/app/api/chat/route.ts#L129). A truly raw-oversized request fails at the raw gate. Corrected matrix:

| Case | Raw chars | Compacted chars | Expected |
|------|-----------|-----------------|----------|
| A: raw > 120K | >120K | N/A (never reached) | 400 "exceeds input size limit" |
| B: raw < 120K, compacted > 40K | <120K | >40K | 400 "exceeds compacted context limit" |
| C: raw large but < 120K, compacted < 40K | <120K | <40K | 200 OK |
| D: draft tool outputs survive compaction | — | — | draft output unchanged |

---

## Proposed Changes

### Component 0: Shared Budget Helper

Extract `calculateInputChars` from `route.ts` to a shared location so both the route and the new `compactValidatedMessages` helper can use it without duplication.

#### [MODIFY] [limits.ts](file:///e:/qltbyt-nam-phong-new/src/lib/ai/limits.ts)

Add exported `calculateInputChars`:
```ts
/**
 * Estimates the character count of a serialized messages payload.
 * Returns MAX_SAFE_INTEGER on serialization failure as a safe upper-bound.
 */
export function calculateInputChars(messages: unknown[]): number {
  try {
    return JSON.stringify(messages).length
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}
```

#### [MODIFY] [route.ts](file:///e:/qltbyt-nam-phong-new/src/app/api/chat/route.ts)

- Remove the local `calculateInputChars` function (lines 92–98)
- Import `calculateInputChars` from `@/lib/ai/limits`
- No behavioral change

---

### Component 1: Message-Level Compaction Helper

New pure function that walks a `UIMessage[]` array, finds tool parts with envelope outputs, and replaces them with compacted versions (using existing `compactToolOutput`).

#### [NEW] [compact-ui-messages.ts](file:///e:/qltbyt-nam-phong-new/src/lib/ai/compact-ui-messages.ts)

- Export `compactUIMessages(messages: readonly UIMessage[]): UIMessage[]`
- Uses `isToolUIPart` and `getToolName` from `ai` to identify tool parts
- Pure function, no side effects — usable on both client and server
- Does not mutate the original `messages` array
- Draft-tool outputs pass through unchanged (delegated to `compactToolOutput` which handles `DRAFT_TOOL_NAMES_SET`)

```ts
import { type UIMessage, isToolUIPart, getToolName } from 'ai'
import { compactToolOutput } from './tools/tool-response-envelope'

export function compactUIMessages(messages: readonly UIMessage[]): UIMessage[] {
  return messages.map(msg => {
    if (msg.role !== 'assistant') return msg

    const hasToolParts = msg.parts.some(isToolUIPart)
    if (!hasToolParts) return msg

    return {
      ...msg,
      parts: msg.parts.map(part => {
        if (!isToolUIPart(part)) return part
        if (part.state !== 'output-available') return part

        const toolName = getToolName(part)
        const compacted = compactToolOutput(toolName, part.output)
        if (compacted === part.output) return part // no-op optimization

        return { ...part, output: compacted }
      }),
    }
  })
}
```

---

### Component 2: Client Transport Compaction

#### [MODIFY] [AssistantPanel.tsx](file:///e:/qltbyt-nam-phong-new/src/components/assistant/AssistantPanel.tsx)

Add `prepareSendMessagesRequest` alongside the existing `body()`:

```ts
new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({
        selectedFacilityId: facilityRef.current,
        selectedFacilityName: facilityNameRef.current,
        requestedTools: REQUESTED_TOOLS,
    }),
    prepareSendMessagesRequest: ({ id, messages, body }) => ({
        body: {
            ...body,
            id,
            messages: compactUIMessages(messages),
        },
    }),
})
```

Per [http-chat-transport.ts:178-188](file:///e:/qltbyt-nam-phong-new/node_modules/ai/src/ui/http-chat-transport.ts#L178-L188): when `prepareSendMessagesRequest` returns a `body`, it replaces the default body entirely. So we must include `id` and `messages` ourselves.

---

### Component 3: Server-Side Compaction + Compacted Budget

#### [NEW] [compact-validated-messages.ts](file:///e:/qltbyt-nam-phong-new/src/app/api/chat/compact-validated-messages.ts)

```ts
import type { UIMessage } from 'ai'
import { compactUIMessages } from '@/lib/ai/compact-ui-messages'
import { calculateInputChars } from '@/lib/ai/limits'

interface CompactResult {
  compactedMessages: UIMessage[]
  compactedChars: number
}

export function compactValidatedMessages(
  validatedMessages: UIMessage[],
): CompactResult {
  const compactedMessages = compactUIMessages(validatedMessages)
  const compactedChars = calculateInputChars(compactedMessages)
  return { compactedMessages, compactedChars }
}
```

#### [MODIFY] [route.ts](file:///e:/qltbyt-nam-phong-new/src/app/api/chat/route.ts)

```diff
   } catch {
     return plainError('Invalid messages payload', 400)
   }

+  const { compactedMessages, compactedChars } = compactValidatedMessages(validatedMessages)
+  if (compactedChars > AI_MAX_COMPACTED_INPUT_CHARS) {
+    return plainError('Request exceeds compacted context limit', 400)
+  }

-  modelMessages = await convertToModelMessages(validatedMessages)
+  modelMessages = await convertToModelMessages(compactedMessages)
```

`validatedMessages` stays for `originalMessages` + draft orchestration.

---

### Component 4: Tests

#### [NEW] [compact-ui-messages.test.ts](file:///e:/qltbyt-nam-phong-new/src/lib/ai/__tests__/compact-ui-messages.test.ts)

Unit tests:
- Compacts envelope-wrapped tool output (strips `uiArtifact`, keeps `modelSummary` + `followUpContext`)
- Passes through draft-tool outputs unchanged
- Passes through non-envelope (un-migrated) tool outputs unchanged
- Passes through user/system messages unchanged
- Handles empty messages array
- Does not mutate the original messages array

#### [MODIFY] [route.limits.test.ts](file:///e:/qltbyt-nam-phong-new/src/app/api/chat/__tests__/route.limits.test.ts)

Add `AI_MAX_COMPACTED_INPUT_CHARS` to mock. New test cases B, C, D per matrix above.

#### [MODIFY] [AssistantPanel.ui.test.tsx](file:///e:/qltbyt-nam-phong-new/src/components/assistant/__tests__/AssistantPanel.ui.test.tsx)

Add assertion: transport config includes `prepareSendMessagesRequest`.

#### Blast-radius tests (must stay green)

| File | Why |
|------|-----|
| [route.repair-request-draft-orchestration.test.ts](file:///e:/qltbyt-nam-phong-new/src/app/api/chat/__tests__/route.repair-request-draft-orchestration.test.ts) | Draft evidence reads `followUpContext` from validated messages |
| [tool-response-envelope.test.ts](file:///e:/qltbyt-nam-phong-new/src/lib/ai/tools/__tests__/tool-response-envelope.test.ts) | Core compaction logic |
| [AssistantPanel.error-state.test.tsx](file:///e:/qltbyt-nam-phong-new/src/components/assistant/__tests__/AssistantPanel.error-state.test.tsx) | Transport error handling |

---

## TDD Execution Order

| Step | Phase | What |
|------|-------|------|
| 1 | RED | Write `compact-ui-messages.test.ts` — all tests fail (function doesn't exist) |
| 2 | GREEN | Implement `compactUIMessages()` in `compact-ui-messages.ts` |
| 3 | VERIFY | Unit tests pass |
| 4 | REFACTOR | Extract `calculateInputChars` from `route.ts` → `limits.ts` |
| 5 | VERIFY | Existing `route.limits.test.ts` stays green |
| 6 | RED | Add route limits tests (cases B, C, D) in `route.limits.test.ts` — fail |
| 7 | GREEN | Implement `compactValidatedMessages()` + wire into `route.ts` |
| 8 | VERIFY | All route tests pass (limits + draft-orchestration + error-safety) |
| 9 | RED | Add `prepareSendMessagesRequest` assertion in `AssistantPanel.ui.test.tsx` — fail |
| 10 | GREEN | Wire `prepareSendMessagesRequest` into `AssistantPanel.tsx` |
| 11 | VERIFY | All AssistantPanel tests pass (ui + error-state) |
| 12 | GATES | `verify:no-explicit-any` → `typecheck` → focused tests → `react-doctor --diff main` |

---

## Verification Plan

```bash
# 1. New unit tests
node scripts/npm-run.js run test:run -- src/lib/ai/__tests__/compact-ui-messages.test.ts

# 2. Route limit tests
node scripts/npm-run.js run test:run -- src/app/api/chat/__tests__/route.limits.test.ts

# 3. Blast-radius tests
node scripts/npm-run.js run test:run -- src/app/api/chat/__tests__/route.repair-request-draft-orchestration.test.ts
node scripts/npm-run.js run test:run -- src/lib/ai/tools/__tests__/tool-response-envelope.test.ts
node scripts/npm-run.js run test:run -- src/components/assistant/__tests__/AssistantPanel.ui.test.tsx
node scripts/npm-run.js run test:run -- src/components/assistant/__tests__/AssistantPanel.error-state.test.tsx

# 4. Verification gates (AGENTS.md policy)
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

### Manual Verification

Open assistant in browser → trigger `categorySuggestion` or `departmentList` → send a follow-up message → verify via Network tab that the follow-up request body contains compacted tool outputs (no `uiArtifact`, only `modelSummary` + `followUpContext`).
