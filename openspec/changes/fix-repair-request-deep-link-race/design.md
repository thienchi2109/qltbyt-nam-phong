## Context

The current sink for Repair Requests create deep-links is `useRepairRequestsDeepLink()` in [useRepairRequestsDeepLink.ts](/root/qltbyt-nam-phong/src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts). The hook runs three independent concerns:

- initial list fetch via `equipment_list`
- targeted equipment fetch via `equipment_get` when `equipmentId` is present
- create-intent handling for `action=create`

Today, create-intent readiness is inferred from two coarse booleans: `hasLoadedEquipment` and `isEquipmentFetchPending`. That is not strong enough to express whether the specific requested `equipmentId` has actually reached a terminal state. A valid `equipmentId` can still be unresolved in `allEquipment` when the create effect runs, which allows the hook to call `openCreateSheet()` without equipment and then clean the URL.

GitNexus was used for initial symbol context but its index is stale (`Indexed commit: cb1847c`, `Current commit: 78e3fae`). A direct grep-based dependency trace confirms the following blast radius:

**Production call graph:**
- `useRepairRequestsDeepLink()` → **1 production caller**: `RepairRequestsPageClientInner` in `RepairRequestsPageClient.tsx` (L144)
- `openCreateSheet()` → defined in `RepairRequestsContext.tsx` (L329) → consumed by `RepairRequestsPageClient` (passes to hook) and `RepairRequestsPageLayout` (toolbar buttons)
- `fetchRepairRequestEquipmentById()` → only used inside the hook itself (L136)
- `preSelectedEquipment` → set by `openCreateSheet` in context (L333) → consumed by `RepairRequestsCreateSheet` (L47, L139-142) for form prefill

**Test coverage touching this change:**
- `useRepairRequestsDeepLink.test.ts` — direct hook tests (primary target)
- `RepairRequestsAssistantDraftHandoff.test.tsx` — assistant draft regression
- `RepairRequestsCreateSheet.test.tsx` — prefill hydration assertions
- `RepairRequestsCreateSheet.submission.test.tsx` — submission payload assertions (should stay untouched)

**Blast radius assessment: LOW.** The change is entirely local to one hook with one production caller. No context API signature changes, no new props flowing through `RepairRequestsPageLayout`, and no submission-path modifications.

## Goals / Non-Goals

**Goals:**
- Make `action=create&equipmentId=<id>` wait for terminal resolution of the requested equipment before opening and cleaning the URL.
- Preserve graceful degradation when `equipmentId` is invalid or cannot be resolved for the current user context.
- Keep assistant-draft handoff semantics unchanged.
- Cover both race orderings in tests so the bug does not regress when fetch timing changes.

**Non-Goals:**
- No change to source navigation helpers or source surfaces.
- No change to create-form submission payload, mutations, or backend RPC contracts.
- No new global store, route interception pattern, or cross-page state handoff.
- No new user-facing toast or telemetry requirement for unresolved `equipmentId` in this pass.

## Decisions

### 1. Represent requested-equipment resolution explicitly

The hook should track the requested create intent separately from the general equipment list state. The important question is not "has some equipment loaded?" but "has the requested `equipmentId` reached a terminal state?"

A minimal state shape is enough:
- requested `equipmentId`
- resolution phase such as `idle`, `pending`, `resolved`, or `missing`
- resolved equipment payload when available

This state lives inside `useRepairRequestsDeepLink()` because the bug is sink-local and GitNexus shows only one direct caller. Pulling it outward into page context would widen scope without adding value.

### 2. Only open and clean after terminal resolution

For `action=create&equipmentId=<id>`, the hook should:
- wait while the requested equipment is still resolving
- open with prefill when resolution succeeds
- open without prefill only after resolution is definitively missing
- clean `action`, `equipmentId`, and `status` only after one of those terminal outcomes

This removes the current "open blank and forget the intent" behavior.

Create intents without `equipmentId` remain immediate and do not need this gating.

### 3. Preserve assistant-draft precedence

Assistant draft handoff is an intentional fast path. If `assistant-draft` exists in the query cache, it should still win before any equipment-resolution waiting logic. This avoids accidentally delaying or mutating a flow that is not driven by equipment prefill.

### 4. Test the race by controlling promise ordering

The current tests cover happy-path prefill and unresolved fallback, but not the timing bug itself. The new tests should use deferred promises or staged mock resolutions so they can assert:

- `equipment_list` finishes first, targeted `equipment_get` finishes later, and the sheet still opens with prefill
- targeted `equipment_get` finishes first, and the sheet still opens with prefill
- invalid or missing `equipmentId` still opens a blank sheet only after the resolution path is terminal

Without this, the fix would be easy to regress with future hook refactors.

## Risks / Trade-offs

- [More state inside one hook] -> acceptable because the bug is local to one hook and the additional state captures a real domain concept the current booleans cannot express.
- [Potential to accidentally block create-without-equipment flow] -> avoid by keeping the no-`equipmentId` path on the current immediate behavior.
- [Potential to delay URL cleanup longer than today] -> intended; cleanup must follow terminal resolution, not precede it.
- [Stale GitNexus graph may miss TSX edges] -> handled by using GitNexus for blast radius only and source reading for the actual control-flow proposal.

## Verification Strategy

1. Red tests for both timing orderings and invalid `equipmentId`.
2. Implement the terminal-resolution gating in `useRepairRequestsDeepLink()`.
3. Keep assistant-draft tests green without changing handoff semantics.
4. Validate with `verify:no-explicit-any`, `typecheck`, focused hook tests, and `react-doctor --diff main`.

## Open Questions

- Should unresolved-but-valid `equipmentId` remain completely silent, or should a later change add user-visible feedback once the sink behavior is stable?
- After this fix lands, should the earlier centralized create-intent change be archived with this sink-resolution follow-up linked in its notes?
