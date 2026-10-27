# TM-11 — Local implementation and UI review

- Date: 2026-10-27 UTC
- Base: `04fbf9fc0a01e0d2cd6c0a5dd6b6ed179afd715a`
- Branch: `feat/temperature-monitoring-tm11`
- Contract: `backlog/tasks/TM-11-equipment-temperature-tab-and-form-polish.md`
- Plan: `docs/plans/2026-10-27-tm11-implementation-plan.md`

## Result and scope

The existing temperature summary, manager configuration and equipment-scoped
logbook link move into **Sổ theo dõi nhiệt độ**, immediately after
**Cấu hình & Phụ kiện**. The original tab retains equipment configuration and
accessories. Recording, trends and export remain on the existing logbook route.

The implementation reuses the configuration hook, role checks, RPC contracts,
mutation pending state and cache invalidation without changing their logic.
Single selectors use existing shadcn Select; substitute staff use the existing
checkbox-menu pattern with repeated hidden form values. No dependency or SQL
change is included.

## Regressions and review fixes

- Baseline: 11/11 focused tests passed. Six real-dialog cases then failed on the
  missing new tab before implementation. Final coverage expands to 18 tests.
- Real-dialog tests protect tab placement/lazy queries, manager and reader
  roles, equipment editing, save/refetch/tab return/dialog remount, selected
  staff outside the search page, actual submit values, null bounds and 0°C.
- Chrome measured only 4px between the inline Label and reason control with
  `space-y-2`. Task-local `grid gap-2` groups produce the required 8px gap.
- Installed Radix packages use independent focus/layer stacks. Real-dialog
  jsdom tests reproduced focus recursion when opening a body-portaled Select.
  Optional native portal containers keep this tab's menus inside the dialog;
  defaults for existing shared-primitive callers remain unchanged.
- Chrome and real-dialog tests reproduced Escape dismissing the parent dialog.
  A controlled selector and window-capture Escape handler, mounted only while
  this tab's selector is open, close that selector and allow native autofocus
  to restore its trigger. Cleanup and ordinary outer Escape remain intact.
  The local `ponytail:` comment records when the workaround can be removed.
- Parent requested the final responsive control scale match existing Input:
  16px on mobile and 14px from the desktop breakpoint.

## Browser evidence — disposable UI only

The parent used installed Chrome through `agent-browser`, with a temporary Vite
harness bound only to `127.0.0.1:4781`. It renders the real extracted components,
shadcn Dialog/Tabs and application CSS. The configuration hook uses fixture data;
NextLink is replaced by an anchor. This is not full Next.js authentication,
real backend persistence, deployment or production UAT evidence.

- Mobile viewport: 390×844; desktop: 1280×900.
- Reason label/control gap: 8px; desktop field-group gap: 16px.
- Final Input, Select and multi-selector trigger fonts match: 14px on desktop
  and 16px on mobile.
- Reason is required with maxLength 2000. Empty submission is blocked with
  visible feedback; corrected input submits all expected named fields.
- Primary selection with End/Enter restores trigger focus. Substitute selection
  adds/removes people without closing the menu after each selection.
- Escape closes both single and multi selectors while retaining the parent
  dialog, reason draft and trigger focus. A subsequent submit carries the
  changed primary and complete substitute list.
- Mobile menu bounds fit inside the viewport. Body width equals viewport
  width on both sizes; no visible native select or page errors were observed.
- Reader fixture shows summary/link and no form/save control. Actual role and
  query behavior are covered separately by the real QueryClient regressions.

Temporary screenshots, not committed artifacts:
`/tmp/qltbyt-tm11-ui-review/{mobile-menu,mobile-complete,desktop-overview,desktop-form-final,mobile-form-final}.png`.

## Verification and independent review

The worker ran format, TS docstrings, no-explicit-any, diff-only dedupe,
typecheck, focused Vitest (18/18 at 08:49 UTC) and React Doctor in repository
order on the complete staged source. All commands exited 0. React Doctor
scanned 8 JS/TS files and scored 92/100 with one intentional
`react-doctor/no-prevent-default` advisory and no errors. The submit handler
needs this call to prevent native navigation while saving through FormData
and the existing mutation; the independent reviewer confirms it is nonblocking.
A per-render Set removes the repeated checkbox lookup warning. No suppression
was added. The earlier 100/100 result omitted the then-untracked components
and is not the final result. No full-codebase duplicate scan was run.

The independent `post_implementation_reviewer` reviewed against the fixed base
without inherited history: SPEC PASS, then QUALITY/STANDARDS PASS, including
the Escape fix. The parent additionally reviewed the rendered desktop/mobile
UI and the task-specific compatibility boundary.

Existing unsubmitted-form reset on tab unmount is preserved. Shared Select and
DropdownMenu consumers keep their existing default body portal; only the new
temperature controls opt into a container. No live database writes or deployment
were performed.
