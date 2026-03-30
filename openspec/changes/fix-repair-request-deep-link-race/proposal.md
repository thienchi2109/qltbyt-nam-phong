## Why

Issue [#174](https://github.com/thienchi2109/qltbyt-nam-phong/issues/174) documents a sink-side race in the Repair Requests deep-link flow. When `/repair-requests?action=create&equipmentId=<id>` is opened, `useRepairRequestsDeepLink()` can open the create sheet before the requested equipment has been resolved, then immediately clean the URL. The result is a blank equipment prefill even though the URL carried a valid `equipmentId`, and the flow cannot self-recover because the intent has already been removed from the URL.

This matters more now because the recently centralized create-intent contract makes Dashboard, Equipment desktop/mobile, QR scanner, and AssistantPanel all converge on the same sink. Source drift is reduced, but the shared sink bug now affects more entry points.

## What Changes

- Add an explicit requested-equipment resolution state inside the Repair Requests deep-link sink instead of inferring readiness from `hasLoadedEquipment` and `isEquipmentFetchPending` alone.
- Defer `openCreateSheet()` for `action=create&equipmentId=<id>` until the requested equipment has reached a terminal state: resolved or definitively unavailable.
- Delay URL cleanup for `action` and `equipmentId` until the create-intent path has reached that terminal state.
- Preserve current behavior for create intents without `equipmentId`, invalid `equipmentId` values, and assistant-draft handoff.
- Add focused regression tests for the two race orderings, invalid `equipmentId` graceful degradation, and assistant draft behavior staying unchanged.
- Do not change source navigation helpers, create-form fields, submission RPCs, or backend schema in this change.

## Capabilities

### New Capabilities
- `repair-request-create-resolution`: Defines the sink-side sequencing contract for resolving `action=create&equipmentId` before opening and cleaning the Repair Requests create flow.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts`
  - `src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts`
  - `src/app/(app)/repair-requests/__tests__/RepairRequestsAssistantDraftHandoff.test.tsx`
  - Potentially small supporting test utilities near Repair Requests hook tests
- Blast radius is `LOW` (confirmed by direct grep-based dependency trace, see design.md):
  - `useRepairRequestsDeepLink()` has 1 production caller: `RepairRequestsPageClientInner`
  - `fetchRepairRequestEquipmentById` is only used inside the hook
  - No context API or submission-path changes required
- User-visible risk is medium despite low code-level blast radius, because every canonical "Báo sửa chữa" entry point now converges on this sink behavior.
- No backend migration, RPC contract change, or source-surface navigation rewrite is expected.
