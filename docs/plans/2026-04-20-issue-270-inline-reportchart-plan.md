# Issue #270: Inline `reportChart` Rendering In Assistant Chat

## Summary
- Scope stays aligned with [Issue #270](https://github.com/thienchi2109/qltbyt-nam-phong/issues/270): ship a versioned `reportChart` tool contract plus inline chart rendering inside the assistant chat UI, without expanding assistant data access or pulling in `query_database` / semantic-layer rollout work from `#223`, `#271`, `#272`, or `#273`.
- Current chat rendering path is `[src/components/assistant/AssistantPanel.tsx](src/components/assistant/AssistantPanel.tsx#L55) -> [src/components/assistant/AssistantMessageList.tsx](src/components/assistant/AssistantMessageList.tsx#L32) -> [src/components/assistant/AssistantToolExecutionCard.tsx](src/components/assistant/AssistantToolExecutionCard.tsx#L56)`. Today it only renders markdown text, draft artifacts, and a generic tool-status card; `uiArtifact.rawPayload` exists in the envelope contract but has no typed chart path yet.
- Existing chart infrastructure is already present in `[src/components/dynamic-chart.tsx](src/components/dynamic-chart.tsx#L24)` and `[src/lib/chart-utils.ts](src/lib/chart-utils.ts#L54)`, with dynamic Recharts wrappers for bar, line, pie, and scatter. Issue `#270` should reuse those primitives instead of introducing a second chart stack.
- Desktop chat panel sizing is currently hard-coded to `w-[420px] h-[min(680px,calc(100vh-8rem))]` in [src/components/assistant/AssistantPanel.tsx](src/components/assistant/AssistantPanel.tsx#L131), which matches the screenshot review from `2026-04-19` and is too narrow for readable inline charts. V1 should widen the desktop floating panel, while keeping the existing mobile near-fullscreen behavior.

## Agreed Product Decisions
- Render charts inline inside assistant tool execution cards, not inside assistant markdown bubbles.
- Increase desktop chat panel size in v1. Default to:
  - width: `w-[min(560px,calc(100vw-3rem))]`
  - height: `h-[min(760px,calc(100vh-6rem))]`
  - mobile: keep current `max-md` near-fullscreen sheet behavior
- Public chart kinds supported by the v1 contract/UI:
  - `bar`
  - `line`
  - `pie`
- Donut remains a styling variant of `pie` via `innerRadius`, not a separate public type.
- `line` support ships as a real contract + renderer + test path in this issue, but not necessarily from a live curated tool on day one. Current curated assistant RPCs map naturally to `bar` and `pie`; forcing a live `line` chart from weak time-series inputs would produce misleading UI.

## Repo Reconnaissance
- Current assistant panel transport compacts tool outputs before resend using `[src/lib/ai/compact-ui-messages.ts](src/lib/ai/compact-ui-messages.ts#L13)` and `[src/app/api/chat/compact-validated-messages.ts](src/app/api/chat/compact-validated-messages.ts#L17)`. Any `reportChart` path must preserve the same invariant: `uiArtifact` is present in the current turn for rendering, but stripped from compacted model-visible history.
- Current envelope contract is defined in [src/lib/ai/tools/tool-response-envelope.ts](src/lib/ai/tools/tool-response-envelope.ts#L14):
  - `modelSummary`
  - optional `followUpContext`
  - optional `uiArtifact` with `rawPayload`
- Current server-side envelope emission happens in [src/lib/ai/tools/rpc-tool-executor.ts](src/lib/ai/tools/rpc-tool-executor.ts#L165), where read-only RPC tools are wrapped into `{ modelSummary, followUpContext?, uiArtifact?: { rawPayload } }`.
- Current system prompt still teaches the model to read current-turn details from `uiArtifact.rawPayload.data` in [src/lib/ai/prompts/system.ts](src/lib/ai/prompts/system.ts#L126). That guidance must be updated carefully so `reportChart` can coexist with legacy list payloads without confusing the model or exposing UI-only contract terms in the prose answer.

## Contract Design

### Outer Envelope
- Keep the current `ToolResponseEnvelope` shape unchanged:
  - `modelSummary`
  - optional `followUpContext`
  - optional `uiArtifact`
- Do not add a second top-level tool output format for charts. `reportChart` is a typed `uiArtifact.rawPayload` value carried inside the existing envelope.

### `ReportChartArtifact` v1
```ts
type ReportChartRow = Record<string, string | number | null>

type ReportChartSeries = {
  key: string
  label?: string
  color?: string
}

type ReportChartTable = {
  columns: string[]
  rows: ReportChartRow[]
}

type ReportChartSummary = {
  itemCount?: number
  notes?: string[]
}

type ReportChartArtifact =
  | {
      kind: "reportChart"
      version: 1
      title?: string
      description?: string
      chart: {
        type: "bar" | "line"
        xKey: string
        series: ReportChartSeries[]
        data: ReportChartRow[]
      }
      table?: ReportChartTable
      summary?: ReportChartSummary
    }
  | {
      kind: "reportChart"
      version: 1
      title?: string
      description?: string
      chart: {
        type: "pie"
        labelKey: string
        valueKey: string
        colors?: string[]
        innerRadius?: number
        data: ReportChartRow[]
      }
      table?: ReportChartTable
      summary?: ReportChartSummary
    }
```

### Contract Rules
- `kind` must be exactly `"reportChart"`.
- `version` must be exactly `1`.
- The UI never infers chart structure from arbitrary RPC JSON. It renders charts only when a strict guard validates `ReportChartArtifact`.
- `chart.data` must stay bounded and deterministic. This is for compact aggregate/timeseries results, not raw record dumps.
- `table` is the canonical fallback dataset for UI rendering failures or invalid chart inputs.
- `summary.notes` is optional human-readable context, not a substitute for `modelSummary.summaryText`.
- Compaction behavior does not change: when the message history is resent, the entire `uiArtifact` is stripped, including `reportChart`.

## Initial Tool Rollout Mapping
- `maintenanceSummary` -> `bar`
  - source fields: `taskTypeCounts`
  - x-axis: task type label
  - series: single count series
  - table rows mirror the same aggregate pairs
- `repairSummary` -> `pie`
  - source fields: `statusCounts`
  - labels: repair status
  - values: count
  - table rows mirror the same aggregate pairs
- `quotaComplianceSummary` -> `bar`
  - source fields: `summary.dat_count`, `summary.thieu_count`, `summary.vuot_count`, `summary.unmapped_equipment`
  - x-axis: compliance bucket label
  - series: single count series
  - table rows mirror the same buckets
- No v1 chart emission from:
  - `departmentList`
  - `categorySuggestion`
  - `attachmentLookup`
  - draft-producing tools
  - raw long-list tools where the artifact would be misleading or too wide
- `line` is supported by the UI contract immediately, but live tool emission is deferred until a curated tool has a clean bounded timeseries payload.

## UI Rendering Approach
- Add a focused `AssistantReportChartCard` component under `src/components/assistant/`.
- `AssistantMessageList` should detect this shape in the tool-output path:
  1. `part.state === "output-available"`
  2. `part.output` is a `ToolResponseEnvelope`
  3. `part.output.uiArtifact?.rawPayload` passes `isReportChartArtifact(...)`
- If all three checks pass, render:
  - tool execution/status header from `AssistantToolExecutionCard`
  - inline `AssistantReportChartCard`
  - optional “Xem bảng dữ liệu” collapse for `table`
- If the artifact is invalid or incomplete:
  - never crash
  - fall back to the compact summary text and a safe text/table state
- Do not introduce nested scroll regions inside the chart card. Let the main assistant message list own scrolling.
- Assistant-side content width can increase modestly from the current `max-w-[88%]` to about `92%` for assistant messages/tool cards so the chart area remains usable after widening the panel.

## Docs / Prompt Updates
- Update the system prompt to reflect two current-turn data access modes:
  - legacy list/detail tools: `uiArtifact.rawPayload.data`
  - `reportChart`: `chart.data` / `table.rows`
- Keep the existing prohibition against literally mentioning `uiArtifact` or other technical keys in the assistant’s prose answer.
- Add a short contract note in `docs/plans` or a nearby assistant AI doc that includes:
  - one valid `bar` example
  - one valid `pie` example
  - one invalid artifact example and expected fallback behavior
  - a short rule for when tools should emit `reportChart` instead of only `modelSummary`

## GitNexus / Impact Notes
- `AssistantToolExecutionCard` itself has low upstream blast radius and no significant process coupling, based on GitNexus symbol impact. That makes it safe to evolve as the display/status shell for completed chart tools.
- `compactToolOutput` has low but real upstream impact through:
  - [src/lib/ai/compact-ui-messages.ts](src/lib/ai/compact-ui-messages.ts#L13)
  - [src/app/api/chat/compact-validated-messages.ts](src/app/api/chat/compact-validated-messages.ts#L17)
  - [src/components/assistant/AssistantPanel.tsx](src/components/assistant/AssistantPanel.tsx#L65)
- The plan therefore keeps compaction logic untouched apart from additional typing/guards, because any semantic change to compaction would affect both client resend behavior and server input budgeting.

## TDD Execution Plan

### Phase 1: Contract Guards
- Target files:
  - [src/lib/ai/tools/tool-response-envelope.ts](src/lib/ai/tools/tool-response-envelope.ts#L14)
  - new or expanded `[src/lib/ai/tools/__tests__/tool-response-envelope.test.ts](src/lib/ai/tools/__tests__/tool-response-envelope.test.ts#L1)`
- Steps:
  1. Add failing tests for valid `bar`, `line`, and `pie` `ReportChartArtifact` values.
  2. Add failing tests for invalid shapes:
     - missing `version`
     - wrong `chart.type`
     - missing `xKey` / `series` for `bar` or `line`
     - missing `labelKey` / `valueKey` for `pie`
     - non-array `chart.data`
  3. Implement `ReportChartArtifact` types and `isReportChartArtifact(...)`.
  4. Re-run the guard tests until green.
- Success criteria:
  - chart artifacts validate strictly
  - existing `isToolResponseEnvelope(...)` still works
  - `compactToolOutput(...)` still strips `uiArtifact` unchanged

### Phase 2: RPC Envelope Adapter
- Target files:
  - [src/lib/ai/tools/rpc-tool-executor.ts](src/lib/ai/tools/rpc-tool-executor.ts#L165)
  - `[src/lib/ai/tools/__tests__/rpc-tool-executor.test.ts](src/lib/ai/tools/__tests__/rpc-tool-executor.test.ts#L1)`
- Steps:
  1. Write failing tests for the three initial tool mappings:
     - `maintenanceSummary` -> `bar`
     - `repairSummary` -> `pie`
     - `quotaComplianceSummary` -> `bar`
  2. Add a small `buildReportChartArtifact(toolName, payload)` helper in the executor module or a nearby helper file.
  3. Emit `uiArtifact.rawPayload = reportChartArtifact` for those tools only.
  4. Keep legacy behavior unchanged for other tools.
- Success criteria:
  - chart-emitting tools produce deterministic payloads
  - non-chart tools preserve current envelope semantics
  - `departmentList` still omits `uiArtifact`

### Phase 3: Assistant UI Rendering
- Target files:
  - [src/components/assistant/AssistantMessageList.tsx](src/components/assistant/AssistantMessageList.tsx#L32)
  - [src/components/assistant/AssistantToolExecutionCard.tsx](src/components/assistant/AssistantToolExecutionCard.tsx#L56)
  - new `src/components/assistant/AssistantReportChartCard.tsx`
  - new/updated assistant UI tests:
    - [src/components/assistant/__tests__/AssistantMessageList.test.tsx](src/components/assistant/__tests__/AssistantMessageList.test.tsx#L1)
    - [src/components/assistant/__tests__/AssistantToolExecutionCard.test.tsx](src/components/assistant/__tests__/AssistantToolExecutionCard.test.tsx#L1)
    - or a dedicated `AssistantReportChartCard.test.tsx`
- Steps:
  1. Write failing UI tests for:
     - valid `bar` render
     - valid `line` render
     - valid `pie` render
     - invalid artifact fallback
     - chart library load error fallback
  2. Implement `AssistantReportChartCard` using existing:
     - `DynamicBarChart`
     - `DynamicLineChart`
     - `DynamicPieChart`
  3. Update `AssistantMessageList` to branch on envelope + `reportChart`.
  4. Evolve `AssistantToolExecutionCard` into a status shell that can host expanded completed content instead of only static summary text.
- Success criteria:
  - chart cards render inline in the tool flow
  - invalid chart payloads do not crash the chat
  - the chart card reuses existing chart loading/error fallbacks

### Phase 4: Desktop Layout Widening
- Target files:
  - [src/components/assistant/AssistantPanel.tsx](src/components/assistant/AssistantPanel.tsx#L131)
  - [src/components/assistant/__tests__/AssistantPanel.ui.test.tsx](src/components/assistant/__tests__/AssistantPanel.ui.test.tsx#L1)
  - optional CSS touch-up in [src/components/assistant/assistant-styles.css](src/components/assistant/assistant-styles.css#L1)
- Steps:
  1. Add failing tests for widened desktop class names.
  2. Update panel width/height to the agreed desktop dimensions.
  3. Keep mobile classes unchanged.
  4. Adjust assistant-content width only as needed for readable chart cards.
- Success criteria:
  - desktop chart cards have enough plotting width
  - mobile behavior stays functionally identical

### Phase 5: Prompt + Contract Documentation
- Target files:
  - [src/lib/ai/prompts/system.ts](src/lib/ai/prompts/system.ts#L126)
  - [src/lib/ai/prompts/__tests__/system-prompt-envelope.test.ts](src/lib/ai/prompts/__tests__/system-prompt-envelope.test.ts#L1)
  - one assistant-plan or contract doc in `docs/plans/` or `docs/ai/`
- Steps:
  1. Add failing tests asserting prompt mentions `reportChart` guidance.
  2. Update the prompt text for current-turn data access and UI-only artifact handling.
  3. Add the contract note/examples.
- Success criteria:
  - model guidance is consistent with the new artifact path
  - no instruction tells the assistant to expose technical keys to end users

## Verification Plan
- Because this issue will touch `.ts` / `.tsx`, verification order must be:
  1. `node scripts/npm-run.js run verify:no-explicit-any`
  2. `node scripts/npm-run.js run typecheck`
  3. focused Vitest runs for the changed assistant/tool/prompt tests
  4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
- Also run:
  - `rtk git diff --check`
- If only this plan document changes, docs-only commit does not require the TS/React gates. Those gates belong to implementation.

## Risks / Non-Goals
- Non-goals:
  - no new SQL or Supabase migration work
  - no new dashboard/report page outside assistant chat
  - no resizable chat panel in v1
  - no attempt to auto-chart arbitrary raw payloads
- Main UX risk:
  - if the chart schema is too permissive, the UI will degrade into heuristic rendering again
- Main technical risk:
  - if prompt/docs keep pointing everything at `uiArtifact.rawPayload.data`, the model and UI contracts will drift
- Main scope risk:
  - forcing a live `line` chart from a weak aggregate source would satisfy the acceptance checklist superficially but weaken the product; this plan explicitly avoids that shortcut

## Acceptance Criteria Mapping
- `reportChart` schema/type defined and documented: covered by Contract Design + Phase 1 + Phase 5
- Chat renders at least `bar`, `line`, `pie`: covered by Phase 3
- Fallback text/table for invalid chart payloads: covered by Phase 3
- Compatible with current envelope: outer `ToolResponseEnvelope` unchanged
- No data-access expansion: explicit non-goal and no backend capability rollout
- Tests for parsing/render/fallback: covered by Phases 1, 2, and 3
- Guidance for when to return `reportChart`: covered by Phase 5
