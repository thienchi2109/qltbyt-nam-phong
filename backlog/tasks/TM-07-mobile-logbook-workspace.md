# TM-07 — Mobile logbook workspace

- Status: In Progress — shared understanding and revised layout approved; lead execution-plan checkpoint pending
- Milestone: Temperature Monitoring / Entry UX
- Depends on: TM-03, TM-04, TM-06
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Provide one mobile-first workspace for selecting a shift, entering readings and handling immediate abnormalities.

## Scope

- Equipment cards grouped by selected shift/date with one-tap entry.
- Status, threshold, method, note, deviation action and save feedback in the same flow.
- Server-side filters for equipment, date, shift and status.
- Explicit displayed range and manual-monitoring limitation.
- Equipment profile summary/deep-link and optional QR shortcut.

## Acceptance criteria

- A staff member can complete a normal reading without navigating through multiple screens.
- Touch targets, focus states, overlay actions and loading/error/empty states meet existing mobile patterns.
- The workspace never fetches beyond the selected server-side window and clearly displays that window.
- Equipment scope and role permissions match the existing Equipment module.

## Takeover gate

The agent must survey current Equipment mobile cards, bottom sheets, route synchronization and accessibility tests, then write a detailed TM-07 plan before editing UI.

## Frontend design gate

Implementation is blocked until the mobile-first screen design/layout, entry
flow and responsive states are explicitly reviewed and approved by the user.
The master spec describes behavior only; it is not UI approval.

## Survey checkpoint — 2026-10-18

Fixed base: `8394991ac37339039f302d00edba75f7d9c22d36`; branch:
`feat/temperature-monitoring-tm-07`. This is a task-specific survey and conditional
implementation plan, not a second specification or an approved screen design.
No runtime UI, SQL, fixture, dependency, live operation or deployment is authorized
by this checkpoint. The lead completed the owner interview using `grilling`;
shared understanding and revised mobile card-row layout are approved. Runtime/SQL
implementation awaits the lead's exact execution-plan checkpoint.

- Canonical behavior remains in `docs/specs/temperature-monitoring.md` and
  `docs/specs/temperature-monitoring-domain-contract.md`. TM-04/05/06 execution
  records distinguish completed local implementation from **INCOMPLETE** formal
  migration gates. All 11 migrations in the migration inventory remain local.
- AgentMemory recall (`temperature TM07 mobile`) and smart search
  (`temperature-monitoring TM06`) returned no matching prior note. No memory saved.
- Code Review Graph refreshed at the exact base; GitNexus refreshed to the same
  base. CRG semantic search found `MobileBottomSheet`; GitNexus context traced
  `MobileEquipmentListItem` and `useOverlayActionTransition`. JSX and SQL gaps were
  backstopped with bounded tgrep/rg through context-mode. The GitNexus CLI's
  generated AGENTS/CLAUDE rewrites were immediately restored; no instruction
  changes are part of TM-07.

### Existing surfaces and reuse evidence

| Concern            | Exact existing seam                                                                                                                   | Decision / constraint                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation         | `src/components/app-navigation.tsx`; `src/lib/app-route-access.ts`                                                                    | Desktop sidebar and route policy; no mobile menu sheet. Approved mobile entry is the third action on enabled scoped Equipment cards; footer unchanged.                                                                                                    |
| Mobile cards       | `src/components/shared/MobileCompactCard.tsx`; `src/components/mobile-equipment-list-item.tsx`                                        | Reuse accessible activation/button/action-region pattern and visual language. Do not reuse Equipment-specific operational-action restrictions as temperature permission rules.                                                                            |
| Sheets             | `src/components/shared/mobile-bottom-sheet.tsx`; `src/components/ui/sheet.tsx`                                                        | Existing Radix focus trap, Escape/backdrop close, hidden title and opener restoration support a single-sheet flow if approved. No new overlay primitive needed.                                                                                           |
| Overlay sequencing | `src/components/ui/use-deferred-dropdown-action.ts`                                                                                   | Reuse `useOverlayActionTransition` only when an originating menu/sheet must close before another overlay opens. Keep one active modal; no local timer replacement.                                                                                        |
| Equipment profile  | `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`; `EquipmentDetailTabs.tsx` in that directory                    | Existing full-screen detail with details/config/files/history/usage. Its current config tab is equipment accessories, not temperature configuration. Prefer existing detail deep-link over importing the entire Equipment dialog context into TM.         |
| Route hydration    | `src/app/(app)/equipment/_hooks/useEquipmentRouteSync.ts`                                                                             | Existing `/equipment?highlight=ID` opens detail, falling back to scoped `equipment_get` when outside current page. Preserves ordinary query params and ignores stale in-flight responses. Do not extend this hook for unrelated temperature filter state. |
| QR                 | `src/components/qr-action-sheet-config.tsx`; `src/components/qr-action-sheet.tsx`; `src/app/(app)/qr-scanner/QRScannerPageClient.tsx` | Existing typed action list + close-then-route handler. Optional temperature shortcut needs an approved destination, validated equipment ID and explicit disabled/unconfigured behavior.                                                                   |
| RPC/query          | `src/lib/rpc-client.ts`; `src/app/(app)/equipment/_hooks/useEquipmentData.ts`; `src/hooks/use-cached-repair.ts`                       | Use `callRpc` only; query functions forward AbortSignal. Scope/filter-specific TanStack keys and narrow invalidation already exist. Do not copy the Equipment hook or fetch full history.                                                                 |
| RBAC               | `src/lib/rbac.ts`; current temperature SQL                                                                                            | `isGlobalRole` and `isEquipmentManagerRole` cover raw admin/global. Temperature writer includes scoped `user`; generic Equipment edit checks must not remove that capability. Server remains authoritative.                                               |
| Notification       | `src/hooks/useAppNotificationCounts.ts`; `src/lib/app-notification-counts.ts`; `src/components/notification-bell-dialog.tsx`          | Existing lanes are repair/transfer/maintenance only. Temperature badge/inbox data and integration are absent; do not claim audit events alone implement notifications.                                                                                    |

### Date, state and permission facts

- Default 30 days, presets 7/30/90 and custom <=90 days describe the interactive
  list window. Entry identity is a selected equipment + monitoring date + shift;
  a history window must not cause an implicit 30-day batch entry. How the two
  controls appear together remains an owner layout decision.
- Monitoring date is the local date on which a shift starts, in the policy
  timezone. Default shifts are Sáng 06:00–12:00, Chiều 12:00–18:00, Tối
  18:00–22:00, Đêm 22:00–06:00; overnight entry retains the shift-start date.
  There is no current-shift/default-entry resolver RPC. Shift overrides and
  configured timezones mean the UI must not infer one universal shift from the
  browser's timezone. Create permits historical eligible slots; no extra lateness,
  future-date or age restriction exists beyond finite dates/times and eligibility.
- Four slot states remain `Chưa ghi`, `Đã ghi`, `Bất thường`, `Chờ xác nhận`.
  An abnormal saved reading can project `Chờ xác nhận` while its effective
  measurement remains abnormal. Show review state and abnormal indicator without
  inventing a fifth state. Deviation status/severity is a separate dimension.
- Normal measurements save directly; abnormal/unable readings require review.
  A breach creates its deviation atomically with measurement/event persistence.
  Immediate action is a later revisioned deviation mutation. Its failure cannot
  roll back or make the UI imply failure of the already-saved observation.
- Writers: `global/admin/to_qltb/technician/qltb_khoa/user`. Non-global temperature
  reads/writes currently require the equipment's tenant and normalized department;
  do not assume the broader Equipment list scope makes a temperature write valid.
- Configuration/review/deviation controls: `global/admin/to_qltb`. Reading review
  must differ from original/effective operator and pending proposal author.
  Deviation self-verification is allowed. Writer ownership does not grant manager
  controls. `regional_leader` is read-only where the current temperature scope
  helper accepts its required claims; do not silently broaden that contract.
- Preserve snapshot thresholds/method/timezone, original capture/server timestamps,
  source/operator/note. Amendment changes only effective value or unable reason
  after review; original facts remain immutable. Confirmed unable results retain
  NULL, reason and unable classification, never a numeric zero or in-range label.

### Exact RPC inventory and read-model gaps

All names below are already allowed in `src/app/api/rpc/[fn]/allowed-functions.ts`.
Signatures and projections were read from the latest migration definition, not
from the superseded TM-03/TM-04 implementation.

| RPC                                                     | Inputs / result used by TM-07                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `temperature_monitoring_slots_list`                     | `p_from_date,p_to_date,p_shift_codes,p_equipment_id,p_cursor,p_limit,p_include_unconfigured`; returns equipment ID/code/name, monitoring date, shift ID/code/name/start/end, slot start/end, configuration version ID, timezone, status, next cursor. Default 30; max 90; limit clamped 1–200. No status input. |
| `temperature_monitoring_configuration_get`              | One equipment ID; current enabled/version/effective period/thresholds/profile/timezone/responsible IDs/method/complete flag. No lookup catalogs or historical selected-date policy.                                                                                                                             |
| `temperature_monitoring_configuration_upsert`           | Equipment, enabled, effective interval, thresholds, profile UUID, timezone, primary/substitute IDs, method code, reason; returns configuration row. Manager only; creates immutable version.                                                                                                                    |
| `temperature_monitoring_configuration_history`          | One equipment ID; immutable configuration versions. Avoid per-card calls and unbounded eager history loading.                                                                                                                                                                                                   |
| `temperature_monitoring_schedule_shift_override_upsert` | Profile/tenant/shift IDs plus optional local name/times and active flag; manager-only audited override. No profile/shift lookup RPC.                                                                                                                                                                            |
| `temperature_monitoring_measurement_create`             | Equipment/date/shift, exactly one numeric value or unable reason, optional capture timestamp/note. Returns reading state + `outcome=created/conflict`; duplicate returns existing state and amendment next action. No overwrite.                                                                                |
| `temperature_monitoring_reading_get`                    | Reading UUID; returns original reading, effective content/status, slot/review state, revision, pending amendment.                                                                                                                                                                                               |
| `temperature_monitoring_amendment_create`               | Reading UUID, expected revision, value or unable reason, mandatory reason; state + created/conflict.                                                                                                                                                                                                            |
| `temperature_monitoring_reading_review`                 | Reading UUID/revision/action/reason/optional proposal UUID; confirm/approve/reject/reopen, state + updated/conflict.                                                                                                                                                                                            |
| `temperature_monitoring_reading_history`                | Equipment/date range/opaque cursor/limit; bounded events and next cursor. It is audit history, not a cross-equipment slot/detail projection.                                                                                                                                                                    |
| `temperature_monitoring_deviation_get`                  | Exactly one deviation UUID or reading UUID; deviation + reading_state + optional independently authorized repair request.                                                                                                                                                                                       |
| `temperature_monitoring_deviation_update`               | Deviation UUID/revision/request UUID/action; action-specific immediate action/cause/evidence/owner/due/severity/verification/repair/reason. Typed conflict and request replay.                                                                                                                                  |
| `temperature_monitoring_deviations_list`                | Date bounds/equipment/status/severity/owner/repair/limit/JSON cursor; bounded cases, counts and next cursor. Does not include missing/normal slots.                                                                                                                                                             |
| `temperature_monitoring_deviation_history`              | Deviation UUID/limit/before-event ID; bounded audit history.                                                                                                                                                                                                                                                    |

Blocking dependencies to scope separately before implementation:

1. Latest `slots_list` lacks reading UUID, values, unable metadata, captured
   snapshot thresholds/method, review revision/proposal and deviation summary.
   It also cannot filter status server-side. Eager configuration/reading/deviation
   queries per card would create N+1 and still cannot identify a saved reading.
   Propose one additive bounded workspace projection or narrowly extending the
   existing projection, preserving slot rules/scopes/cursor. Final SQL contract
   and filename require a separate lead/owner checkpoint; no migration prepared.
2. Schedule/profile UUIDs and method codes are required to enable equipment.
   Profile/shift seed exists, but no recording-method seed exists in committed
   migrations; only disposable tests insert fixture methods. Catalog tables revoke
   authenticated access, and there is no catalog-read RPC. A scoped lookup/default
   catalog is needed; do not hardcode UUIDs or pretend test fixtures are available.
3. Configuration and deviation owner pickers require safe staff IDs/names, active
   status and equipment tenant/department. `user_list_for_admin` is global/admin
   only; Equipment user filters describe equipment free-text users, not staff IDs.
   `don_vi_user_hierarchy` is also global-only, returns unpaginated tenant/user
   groups and lacks staff active status. It cannot serve a `to_qltb` scoped picker.
   Propose only a minimal scoped lookup; never fetch passwords/full staff rows or
   widen an admin RPC for convenience.
4. `equipment_list_enhanced` provides paginated/searchable equipment selection,
   including regular/placed/all scope, but has no temperature-enabled/configured
   filter or temperature projection. It can support a configuration equipment
   picker; it cannot substitute for the workspace query by client-side filtering.
5. Temperature badge/inbox/count items need a scoped bounded query integration.
   Keep notification scope explicit in the checkpoint; no Web Push or continuous
   monitoring, and do not infer a complete inbox from one loaded cursor page.

### Narrow backend extension proposal — not implementation authorization

- Workspace read: one set-based scoped projection over existing expected/recorded
  slots and latest reading/review/deviation state. Explicit date range <=90,
  equipment/shift/status filters before keyset pagination, snapshot thresholds and
  method, reading/deviation identities and revisions. Return bounded row count,
  filter-bound opaque cursor and server time for consistent selected-shift UX.
  Preserve separate effective abnormality, unable and review flags. Do not mutate
  readings or overload the independent deviation lifecycle into slot status.
- Configuration choices: one safe equipment-scoped result for active
  profile/shift/method choices and minimal eligible staff IDs/names, with bounded
  staff search/page if needed. Reuse the existing default profile/shift IDs from
  the database. Add one idempotent manual-method seed with an agreed stable code
  and approved label; do not add catalog CRUD/admin UI or hardcoded UUIDs.
- Existing create validation: retain current signatures/duplicate handling and
  slot-start snapshot; use authoritative slot start/end and server time to enforce
  approved future-slot/future-capture rules. Prior-shift entry must explicitly
  supply actual capture time rather than receive the default `now()` silently.
  Current `captured_at` plus `created_at` columns suffice. Capture must be within
  authoritative selected `[slot_start,slot_end)`, including overnight slots.
  The current default `p_captured_at=now()` obscures whether a prior-shift caller
  explicitly supplied the value: final contract must enforce explicit historical
  input while preserving SQL signature and typed duplicate/conflict behavior.
  These checks affect future calls only, never reinterpret or mutate existing
  immutable readings. Update intended historical TM-04/05/06 fixtures to explicit
  deterministic in-slot times; retain omitted/NULL past-time rejection coverage.
- Notification read: only the scoped minimal count/inbox/deep-link contract the
  owner/lead approves; derive independent review and open-deviation work without
  reading all history. Existing audit remains the source of truth, not a substitute
  for an inbox query. No Web Push.
- Before writing any SQL, lead checkpoints the exact final signatures, return
  fields, caller permissions and filenames. Use forward migrations with explicit
  transactions, required SQL skill, focused rollback tests and disposable-only
  validation. The original 11 migrations/inventory entries remain historical and
  immutable. Any approved TM-07 extension uses separate forward migration files
  and inventory entries added after the scoped checkpoint. This proposal does not
  change/apply any existing migration.

## Implementation plan — awaiting lead dependency/composition checkpoint

> For agentic workers: use `superpowers:executing-plans` or the lead's authorized
> subagent workflow after approval. This checklist is preparation only.

**Goal:** Deliver the approved mobile logbook in the existing application design,
with bounded truthful data, atomic observations and separate controlled review /
deviation actions. **Architecture:** Existing App Router/auth boundary, TanStack
Query + RPC proxy, shared cards/Sheet/Dialog primitives. No new dependency,
generic form framework, chart (TM-08), export (TM-09) or redesign.

### Step 1 — Close the interview and approve the concrete layout

- [x] Owner approved round 1 recommendations on 2026-10-18: save immediately per
      equipment (no batch); persist an abnormal observation first, then prompt its
      separate corrective action, never discard the measurement because action is
      absent; include minimal complete role-based confirmation/amendment/review and
      deviation operations. No charts or export in TM-07.
- [x] Owner's strict implementation constraint: reuse existing UI components only.
      No additional generic/domain UI component files, copied/forked components or
      component library. Compose existing primitives in the necessary page and
      existing integration files. New data hooks/services require semantic reuse
      evidence. If this conflicts with the 450-line ceiling, surface the exact conflict
      before coding; do not invent an exception.
- [x] Owner approved round 2: separate `Ghi theo ca` for selected current monitoring
      date/shift from independent `Lịch sử` default 30 and 7/30/90; existing menu
      item plus Equipment crosslink; fixed mobile footer unchanged; minimal manager
      temperature configuration in the Equipment profile using existing components,
      without catalog admin UI. This approves surfaces, not a concrete layout.
- [x] Owner approved round 3: seed one manual method labelled
      `Đọc nhiệt kế và nhập tay`, preselected, without catalog admin UI. Allow scoped
      historical entry with required actual observation `captured_at` for prior
      shifts; preserve separate server-entry `created_at`; reject a not-started
      selected slot and a future observation timestamp server-side. Browse90 is not
      a mutation-age cap. Current schema already has both timestamp columns;
      validation requires separately scoped forward SQL, not only UI validation.
- [x] Owner approved Q9: actual capture must lie within selected authoritative
      `[slot_start,slot_end)`, including overnight shift-start monitoring date.
      Late entry is allowed; future slot/capture is forbidden. Preserve approved
      slot-start policy snapshots. Timezone UI uses existing default/displayed
      configured timezone, without new timezone management.
- [x] Owner confirmed Q1–Q9 shared understanding and explicitly requires a visible,
      operable mobile-viewport entry plus mobile-first responsive design. Do not
      treat a desktop-only sidebar item as fulfilling that requirement.
- [x] Owner approved the revised concrete layout: eligible mobile cards add the
      third `Sổ nhiệt độ` action in the same repair/use row; compact readable labels, >= 44 px height, no horizontal scroll/clipping at 320/375 px. Non-enabled
      cards keep existing actions. Desktop uses its row action menu; desktop app
      navigation may remain. No mobile top button, hamburger or footer change.
      Clicking preselects equipment and its current effective slot, with history
      accessible. Scoped `user` recording is independent of responsible assignment.
      No additional interview is needed for
      canonical default4 shifts/tenant overrides, unable reason, ordinary conflict
      handling or already-approved role invariants.
- [x] Lead requested the compact layout proposal; written at
      `docs/specs/temperature-monitoring-tm07-layout.md` with mobile320/375/desktop,
      visible Equipment entry, existing sheet, review/action/configuration states
      and accessibility/keyboard/loading/error/empty/conflict behavior.
- [x] Owner layout approval received; no repeat design confirmation is required.
- [ ] Obtain lead's exact backend/composition execution-plan checkpoint.
- [ ] Separately scope/approve necessary backend read-model/catalog work and its
      validation before SQL changes. Keep the existing 11 migration identities intact.

### Step 2 — Define the smallest approved module and data contract

Provisional exact file map; reduce or rename only with the approved layout.
No files listed below have been created by this survey.

| File                                                                                     | Responsibility                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/temperature-monitoring/page.tsx`                                          | Thin page wrapper using the application's existing auth/layout boundary for the approved dedicated workspace.                                                                                                                                                              |
| `src/app/(app)/temperature-monitoring/TemperatureMonitoringPageClient.tsx`               | Necessary page integration: compose existing Tabs/Card/MobileCompactCard/Form/Input/Select/Textarea/Badge/Alert/Button/Sheet/Dialog primitives for scope, filters, list and selected work. No new domain UI component extraction; no transport/business-state duplication. |
| `src/app/(app)/temperature-monitoring/_lib/TemperatureMonitoringTypes.ts`                | Minimal DTOs matching final RPC projections; discriminated mutation outcomes, four slot states and separate deviation types.                                                                                                                                               |
| `src/app/(app)/temperature-monitoring/_lib/TemperatureMonitoringInput.ts`                | Pure trust-boundary validation for date/range/cursor URL and raw numeric-or-unable input; no rounding. Use installed validation tools only if they reduce code.                                                                                                            |
| `src/app/(app)/temperature-monitoring/_hooks/useTemperatureMonitoringData.ts`            | Bounded query keys, AbortSignal, cursor query, selected-record lazy detail and narrow invalidation. Extract mutation handling only if it approaches 350 lines.                                                                                                             |
| `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailConfigTab.tsx` | Approved profile placement: compose existing form primitives for manager opt-in/configuration, using real catalogs and staff scope. Preserve accessories behavior. No new temperature component file.                                                                      |
| Existing navigation/QR/detail seams above                                                | Touch only approved entry points and corresponding focused tests; no fixed-footer change.                                                                                                                                                                                  |

- [ ] Before edits invoke Next best practices then Vercel React best practices;
      TanStack Query, responsive-design and frontend-design guidance must align with
      the existing app, not redesign it. Recheck semantic reuse before new reusable
      behavior. Target < 350 lines/file; never add to a source file already over 450.
- [ ] Confirm the approved page composition fits the 450-line ceiling with the
      existing component inventory. Keep data/mutation/validation logic in minimal
      non-UI hooks/modules; do not evade the constraint with JSX-returning helper
      modules or new nested components. If safe readable composition cannot fit,
      report exact required UI responsibilities/line budget to the lead before coding.
- [ ] Queries use keys including actor/role, tenant/department/facility scope,
      equipment, date range, shifts, status and cursor. Disable until authorized scope
      and valid dates exist; pass `signal` through `callRpc`; reset cursor and selected
      work when filters/scope change. Never display prior tenant data as placeholder.
- [ ] Fetch selected reading/deviation/audit only when needed, not per list card.
      Configuration changes invalidate related configuration/slots; measurement and
      review invalidate affected equipment/date plus relevant pending queues; deviation
      changes invalidate that case/list/counts. Preserve active filters.
- [ ] Create uses raw decimal text validated as finite [-200,300], at most one
      fractional digit with no rounding, or one nonblank unable reason. Prevent repeat
      submits while pending. No optimistic completed state before server success.
- [ ] Create conflict opens/refreshes existing state and offers amendment; review
      or deviation stale revision refreshes authoritative data, retains the user's
      unsent input, and requires a deliberate new decision. Never replay review blindly.
- [ ] Deviation retries retain one request UUID for identical payload; changed input
      gets a new UUID. `assign` sends the complete desired owner/deadline pair because
      NULL clears either field. Do not auto-transition status or auto-create repair.

### Step 3 — Implement approved states and interaction safely

- [ ] Loading: stable card placeholders and labelled pending action; scope/filter
      changes cannot leave actionable stale rows. Disable only affected form/action.
- [ ] Error: clear inline message + retry for query; preserve input on mutation
      failure; distinguish observation saved/action failed; no raw backend payloads.
- [ ] Empty: distinguish no opted-in equipment, no expected slots for selected
      date/shift, no filter matches and no pending work; manager configuration action
      only where permitted. Never silently show all equipment as monitored.
- [ ] Mobile/desktop: use existing spacing/colors/type/components; >= 44 px important
      touch targets, no horizontal page overflow, visible units and state text, keyboard
      access, responsive scroll with save controls reachable above software keyboard.
      Exact arrangement awaits approved layout.
- [ ] Focus/a11y: labelled controls/errors (`aria-invalid`/described-by), visible
      focus, status/live region after save, no color-only breach state; focus invalid
      input after validation. Sheet title/description/Escape/backdrop and trigger return
      use existing primitives. Guard dirty close consistently; no nested modal.
- [ ] Show range/default 30/max 90 and manual-observation limitation visibly. Display
      timezone/monitoring date clearly; no inferred lateness/future restriction beyond
      the canonical rules. No claim of sensor/continuous protection.
- [ ] Deep-links validate IDs/ranges and preserve active filters; close originating
      overlay before navigation. Equipment detail uses existing highlight URL. QR
      shortcut remains optional until selected by the owner.

### Step 4 — Behavior RED → GREEN and evidence

- [ ] Add valuable failing interaction tests first, then run and observe the real
      missing behavior; implement the narrow slice and rerun GREEN. Do not write a test
      merely asserting a source file/function is absent.
- [ ] Proposed focused tests under
      `src/app/(app)/temperature-monitoring/__tests__/`: input endpoints/precision/
      unable exclusivity, scope+server filters+90-day bound+cursor reset/cancellation,
      normal save/conflict/amendment, breach persisted then action retry, independent
      reviewer/manager versus writer controls, unable classification, stale revision,
      loading/error/empty and sheet close/focus/background interactivity. Use existing
      Vitest/Testing Library, not a new framework.
- [ ] Extend existing `app-navigation.test.ts`, route-access tests and QR tests only
      for approved new entry points. Reuse the regression models in
      `mobile-bottom-sheet.test.tsx`, `mobile-equipment-list-item.test.tsx`,
      `use-overlay-action-transition.test.tsx` and
      `equipment-actions-overlay-workflow.test.tsx`; no duplicate primitive tests.
- [ ] If backend extension is separately approved, add focused rollback behavior
      tests for workspace scope, snapshot projection, missing/recorded states, status
      before pagination and cursor stability, safe lookup fields and empty catalogs.
      Execute only authorized disposable clones with cleanup on every path and a
      separate final absence check; never mutate persistent baseline or live.
- [ ] Batch ordered TypeScript gates through context-mode: format:check (or scoped
      Prettier), verify:no-explicit-any, diff-only verify:dedupe, typecheck, focused
      tests, react-doctor. Then `git diff --check`, real mobile+desktop browser check
      if available, and exact evidence recording. Do not claim browser proof from jsdom.
- [ ] Lead independently checks results and dispatches a fresh custom
      `post_implementation_reviewer` from fixed base, without full-history fork. Resolve
      concrete findings before local commit handoff. Hooks remain enabled.
- [ ] Record commit, paths, RED/GREEN totals/logs, semantic reuse, browser limits,
      any disposable clone cleanup and remaining work here. Local commits only;
      no push/PR/merge/remote/branch cleanup, dependency or deploy operation.
      Formal static/baseline-forward remain separately reported **INCOMPLETE** until
      actual exact-commit evidence exists; the owner deferred harness repair.

## Current stop condition

Interview shared understanding is confirmed; no unanswered policy question remains.
The owner approved the linked layout with the revised third mobile card action.
The app has no mobile hamburger/sheet menu; none is proposed. No top-of-page mobile
logbook button will be added. Fixed footer stays unchanged. Exact execution-plan
and backend/composition checkpoints below remain with the lead, not the owner.
No runtime/SQL implementation has been made.

## Revised-entry execution checkpoint

- Existing list projection: latest `equipment_list_enhanced` body is 267 lines
  (`20261014120000_equipment_dataset_scope.sql:940–1206`). A separate forward
  migration will preserve its exact signature, filters, scopes, sort/pagination
  and ACL while adding one server-authoritative `temperature_monitoring_enabled`
  boolean for active monitoring in the caller's temperature scope. No per-card
  RPC, responsibility-only gate or client inference from an equipment name.
- Add the optional projection field to `src/types/database.ts`; existing
  `useEquipmentData.ts` already transports Equipment rows. Mobile integration is
  `src/components/mobile-equipment-list-item.tsx` (275 lines), desktop integration
  `src/components/equipment/equipment-actions-menu.tsx` (139 lines). Reuse existing
  action components/status branches; no new UI component or top-toolbar edit.
  Existing `MobileUsageActions` accepts `className` for compact sizing; preserve
  `Đang sử dụng` semantics, allowing in-button wrapping. Scope-authorized `user`
  retains create/amendment capability independently of responsible staff.
- Behavioral RED → GREEN: enabled versus non-enabled card actions, unauthorized
  scope, `user`, desktop menu, click isolation/deep-link equipment/current-slot
  selection, compact three-label row at 320/375 px and non-enabled layout
  regression. Browser geometry must prove same-row buttons, >= 44 px height and
  no clipping/overflow; jsdom alone is not geometry evidence.
- No entry-integration source file currently conflicts with the 450-line ceiling.
  Final workspace composition budget, exact workspace/catalog/time-validation /
  notification RPC signatures and forward migration filenames remain the lead's
  implementation checkpoint. Do not force a 450-line fit, add domain components
  or silently broaden SQL scope. Original 11 migrations remain unchanged; new
  approved forward migrations get separate inventory entries.
