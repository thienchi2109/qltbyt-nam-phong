# Issue #207 Phase 1 — Deep-link active repair request from Equipment Detail

- **Date**: 2026-04-26
- **Author**: thienchi2109 (with Devin pair)
- **Issue**: [#207](https://github.com/thienchi2109/qltbyt-nam-phong/issues/207) (umbrella) — Phase 1 narrowed scope
- **Status**: Draft for review

## Context

Issue #207 (umbrella) calls for deep-linking related active business records (transfers, repairs, maintenance/calibration/inspection) from Equipment Detail via a side sheet, driven by current equipment status. The umbrella scope is too broad for a single iteration.

**Phase 1** narrows to: **when equipment status is `"Chờ sửa chữa"` and there is a currently-active repair request, expose a button in Equipment Detail that opens the repair request in a side sheet without leaving the Equipments page.** Transfers and maintenance/calibration/inspection are explicitly out of scope and will be handled in follow-up issues that reuse the shared module introduced here.

### Existing landscape — what we reuse

The repository already has a **CREATE deep-link** infrastructure that this design extends rather than replaces:

- `src/lib/repair-request-create-intent.ts` exports `buildRepairRequestCreateIntentHref(equipmentId?)`, `buildRepairRequestsByEquipmentHref(equipmentId)`, and the `REPAIR_REQUESTS_PATH` / `REPAIR_REQUEST_CREATE_ACTION` constants. An adoption test (`src/lib/__tests__/repair-request-create-intent.adoption.test.ts`) enforces that desktop equipment actions, dashboard, QR scanner, and AssistantPanel all use this helper — no hardcoded `/repair-requests?...` URLs are allowed.
- `src/components/equipment/equipment-actions-menu.tsx` row-level menu uses the helper to navigate to `/repair-requests?action=create&equipmentId=X`.
- `src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts` consumes the URL params and triggers `RepairRequestsContext.openCreateSheet(equipment)` on the repair-requests page.
- `src/app/(app)/repair-requests/_components/RepairRequestsDetailView.tsx` is already a side `Sheet` (Radix dialog primitive at `z-[1002]`) and already handles tabbed details + history + safe error fallbacks.

The CREATE flow is **navigation-based** by design (the form needs a full page). The new VIEW-ACTIVE flow is **in-page** because Issue #207 explicitly requires that "user stays on Equipments". These are two different UX models that share primitives but cannot replace each other.

### Decisions captured during brainstorming

| Question | Choice |
|---|---|
| Trigger UX | Button/link next to status field in Equipment Detail (read-mode only) |
| Multiple-active tie-break | Open most-recently-updated record + warning banner inside the sheet |
| Sheet mode | Read/detail parity — reuse `RepairRequestsDetailView` unchanged for detail + history view (no action surface; mutations live in the existing row dropdown on `/repair-requests`) |
| Backend resolver | New dedicated RPC `repair_request_active_for_equipment` |
| RBAC | Visible to any user who can open Equipment Detail; tenant guard enforced server-side |
| Empty state (status says "Chờ sửa chữa" but no active record) | Hide button entirely (Phase 1) |
| React mount strategy | Extract a shared package `src/components/equipment-linked-request/` so Phase 2/3 (transfers, maintenance) can plug in without re-architecting |
| Test strategy | TDD with `@testing-library/user-event` integration tests; no manual-browser-verification gates |

## Goals

1. From Equipment Detail of an equipment with status `"Chờ sửa chữa"`, the user can open the **currently active repair request** in a side sheet.
2. Resolution is **status-driven** and uses the **active** record (`trang_thai IN ('Chờ xử lý','Đã duyệt')`), never an arbitrary historical one.
3. Multi-active and zero-active situations are handled deterministically.
4. The side sheet reuses `RepairRequestsDetailView` so detail + history rendering is identical to the existing repair-requests page; mutations are not surfaced inside the sheet for Phase 1.
5. New shared module is extensible to transfers/maintenance follow-ups without breaking Phase 1.
6. No N+1 queries; no race conditions; no measurable regressions on equipment route bundle/runtime.

## Non-goals

- Opening transfer / maintenance / calibration / inspection sheets from Equipment Detail (Phase 2+).
- Realtime sync of active repair status across browser tabs.
- A bookmarkable / shareable URL for the side-sheet state (the side sheet is ephemeral; users who want a permalink can use the existing `/repair-requests?equipmentId=X` route).
- Modifying `equipment-actions-menu.tsx` or other row-level menus. The existing CREATE action stays untouched.
- Replacing or unifying the navigation-based CREATE deep-link with the new in-page VIEW deep-link.

## Architecture

### Module layout

```
src/lib/
└── repair-request-deep-link.ts          (rename + extend repair-request-create-intent.ts)

src/components/equipment-linked-request/  (new shared package)
├── LinkedRequestContext.tsx              (Provider + context: open, kind, equipmentId, resolved data)
├── LinkedRequestButton.tsx               (status-gated trigger; one chip variant)
├── LinkedRequestSheetHost.tsx            (mounts the right Sheet by kind via dynamic import)
├── resolvers/
│   └── useResolveActiveRepair.ts         (Phase 1 implementation)
├── adapters/
│   └── repairRequestSheetAdapter.tsx     (wraps RepairRequestsDetailView; thin)
├── strings.ts                            (Vietnamese copy, i18n-ready)
├── types.ts                              (LinkedRequestKind = 'repair' Phase 1; ResolverResult<T>)
└── index.ts
```

### Helper module rename + additions

`src/lib/repair-request-create-intent.ts` → renamed to `src/lib/repair-request-deep-link.ts`. All existing exports preserved (re-exported from a barrel if needed for backward compat during the rename) plus:

```ts
export const REPAIR_REQUEST_VIEW_ACTION = 'view'

export function buildActiveRepairRequestQueryKey(equipmentId: number | null) {
  return ['repair_request_active_for_equipment', { equipmentId }] as const
}

// Phase 1: not consumed by route sync yet, but stable for future bookmarkable URL story.
export function buildRepairRequestViewHref(requestId: number) {
  const params = new URLSearchParams({ action: REPAIR_REQUEST_VIEW_ACTION, requestId: String(requestId) })
  return `${REPAIR_REQUESTS_PATH}?${params.toString()}`
}
```

The adoption test is renamed accordingly and gains assertions described in §6.3.

### Wiring inside the Equipment page

- `EquipmentPageClient` wraps the existing tree with `<LinkedRequestProvider>` as a sibling of `<EquipmentDialogProvider>`.
- `equipment-dialogs.tsx` adds `<LinkedRequestSheetHost />` next to `<EquipmentDetailDialog />`. They are React siblings; visually they stack via the existing z-index convention (Sheet `z-[1002]` over Dialog `z-[1000]`).
- `EquipmentDetailDialog/EquipmentDetailStatusSection.tsx` renders `<LinkedRequestButton kind="repair" equipment={displayEquipment} />` only in read-mode (suppressed in edit-mode to avoid confusion when status is being changed).

### Why a shared package for Phase 1

Today only one consumer exists. The cost is one extra file boundary. The benefit is:

1. Phase 2 (transfers) and Phase 3 (maintenance/calibration) follow the same UX pattern (status-driven button → side sheet over Equipment Detail). They will only need to add a resolver and a sheet adapter; the Provider, Host, types, and adoption rules stay constant.
2. The N+1 prevention rule (button only inside Equipment Detail) is enforced once, at the package boundary.
3. The dynamic-import bundle protection (see §4.4) is in one place.

## Backend

### New RPC `repair_request_active_for_equipment`

```sql
CREATE OR REPLACE FUNCTION public.repair_request_active_for_equipment(
  p_thiet_bi_id INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role     TEXT  := lower(coalesce(public._get_jwt_claim('app_role'),
                                     public._get_jwt_claim('role'), ''));
  v_user_id  TEXT  := nullif(public._get_jwt_claim('user_id'), '');
  v_allowed  BIGINT[] := NULL;
  v_count    INTEGER := 0;
  v_request  JSONB   := NULL;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role NOT IN ('global', 'admin') THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object('active_count', 0, 'request', NULL);
    END IF;
  END IF;

  WITH active AS (
    SELECT
      r.*,
      tb.ten_thiet_bi,
      tb.ma_thiet_bi,
      tb.model,
      tb.serial,
      tb.khoa_phong_quan_ly,
      tb.don_vi AS thiet_bi_don_vi,
      dv.name AS facility_name
    FROM public.yeu_cau_sua_chua r
    JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE r.thiet_bi_id = p_thiet_bi_id
      AND r.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
      AND COALESCE(tb.is_deleted, false) = false
      AND (v_role IN ('global','admin') OR tb.don_vi = ANY(v_allowed))
    ORDER BY COALESCE(r.ngay_duyet, r.ngay_yeu_cau) DESC, r.id DESC
  ),
  counted AS (SELECT count(*)::int AS c FROM active)
  SELECT
    jsonb_build_object(
      'active_count', counted.c,
      'request',
      CASE WHEN counted.c = 0 THEN NULL ELSE (
        SELECT jsonb_build_object(
          'id', a.id,
          'thiet_bi_id', a.thiet_bi_id,
          'ngay_yeu_cau', a.ngay_yeu_cau,
          'trang_thai', a.trang_thai,
          'mo_ta_su_co', a.mo_ta_su_co,
          'hang_muc_sua_chua', a.hang_muc_sua_chua,
          'ngay_mong_muon_hoan_thanh', a.ngay_mong_muon_hoan_thanh,
          'nguoi_yeu_cau', a.nguoi_yeu_cau,
          'ngay_duyet', a.ngay_duyet,
          'ngay_hoan_thanh', a.ngay_hoan_thanh,
          'nguoi_duyet', a.nguoi_duyet,
          'nguoi_xac_nhan', a.nguoi_xac_nhan,
          'don_vi_thuc_hien', a.don_vi_thuc_hien,
          'ten_don_vi_thue', a.ten_don_vi_thue,
          'ket_qua_sua_chua', a.ket_qua_sua_chua,
          'ly_do_khong_hoan_thanh', a.ly_do_khong_hoan_thanh,
          'chi_phi_sua_chua', a.chi_phi_sua_chua,
          'thiet_bi', jsonb_build_object(
            'ten_thiet_bi', a.ten_thiet_bi,
            'ma_thiet_bi', a.ma_thiet_bi,
            'model', a.model,
            'serial', a.serial,
            'khoa_phong_quan_ly', a.khoa_phong_quan_ly,
            'facility_name', a.facility_name,
            'facility_id', a.thiet_bi_don_vi
          )
        )
        FROM active a LIMIT 1
      ) END
    )
  INTO v_request
  FROM counted;

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_active_for_equipment(INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_active_for_equipment(INT) FROM PUBLIC;
```

Design points:

- **CTE merge** — single scan of `yeu_cau_sua_chua` rows for the equipment; `counted` and the top-1 row read from the same materialised CTE. Half the work of a naive `count(*) + select … limit 1` pair.
- **Tenant guard** mirrors `repair_request_list` exactly (same `_get_jwt_claim('app_role'/'role')` extraction, `allowed_don_vi_for_session()` helper, `global` / `admin` short-circuit, missing-claim 42501 raise, and `SET search_path = public, pg_temp`). **NOTE**: live `repair_request_get(p_id)` is currently `LANGUAGE sql SECURITY DEFINER` with no `search_path`, no JWT claim extraction, and no tenant guard — a known security gap that diverged from migration `20250927_regional_leader_phase4.sql`. Do **not** treat `repair_request_get` as the template here. Closing that gap is tracked under issue #342 (family-wide guard). **Department scope (role=`user`) is intentionally *not* added here** — see "Department scope decision" below.
- **Active definition** = `'Chờ xử lý' OR 'Đã duyệt'`, the canonical convention used in `src/components/repair-request-alert.tsx` and `src/components/notification-bell-dialog.tsx`.
- **Tie-break**: `ORDER BY COALESCE(ngay_duyet, ngay_yeu_cau) DESC, id DESC`. Deterministic; reflects "most recent state change" since the table has no `updated_at`.
- **Soft-delete safety**: `COALESCE(tb.is_deleted, false) = false` aligns with the existing soft-delete read policy (`supabase/migrations/20260213100500_equipment_soft_delete_historical_read_policy.sql`).
- **Empty contract**: `{active_count: 0, request: null}` rather than 404; lets the frontend branch cleanly without try/catch noise.
- **Output shape** intentionally matches one row from `repair_request_list` so the caller can pass it straight into `RepairRequestsDetailView` (typed as `RepairRequestWithEquipment`).

### Department scope decision (role=`user`)

Recent migrations (`20260422123000_add_user_department_scope_reads.sql`, `20260422150000_add_user_department_scope_workflow_guards.sql`) introduced fail-closed `khoa_phong` (department) scope checks for role=`user`, applied to `equipment_get` / `equipment_list_enhanced` / area & attention summaries / `repair_request_create` / `transfer_request_create` / maintenance plan tasks.

The state of the `repair_request_*` read family on the live database (verified via Supabase MCP `execute_sql`):

- `repair_request_list` — has the proper tenant guard (`_get_jwt_claim` + `allowed_don_vi_for_session`) and `SET search_path = public, pg_temp`. **No** dept-scope guard yet.
- `repair_request_get` — `LANGUAGE sql SECURITY DEFINER` with **no `search_path`, no tenant guard, no JWT claim extraction**. The hardened plpgsql version from migration `20250927_regional_leader_phase4.sql` is no longer the live definition; it appears to have been overwritten by a later (probably regional-leader-rollback) migration. This is a real security regression that pre-dates this work.
- `repair_request_active_for_equipment` — does not exist yet; this spec introduces it.

**Phase 1 decision**: the new `repair_request_active_for_equipment` RPC adopts the `repair_request_list` tenant-guard shape (which is correct), and explicitly does **not** depend on `repair_request_get` for its security model. Department scope is **not** added in Phase 1 for two reasons:

1. UI flow is already protected: a role=`user` cannot reach `EquipmentDetailDialog` for out-of-scope equipment because `equipment_list_enhanced` and `equipment_get` already apply the dept-scope filter. The button therefore never renders for out-of-scope equipment in normal flow.
2. Adding dept-scope to one read RPC in isolation creates inconsistency within the `repair_request_*` read family. A family-wide fix is the right shape and should be tracked as its own issue with consolidated smoke tests.

**Follow-up issue (out of scope here)**: #342 — restore tenant guard on `repair_request_get` (LANGUAGE plpgsql + `_get_jwt_claim` + `allowed_don_vi_for_session` + `SET search_path`) **and** add fail-closed dept-scope guard to `repair_request_get`, `repair_request_list`, and `repair_request_active_for_equipment` together, matching the pattern of `equipment_get` from `20260422123000_add_user_department_scope_reads.sql`. Defense-in-depth against direct RPC calls bypassing the equipment-level filter.

### Index coverage

Live indexes on `yeu_cau_sua_chua` (verified via Supabase MCP `pg_indexes`): `idx_yeu_cau_sua_chua_thiet_bi_id (thiet_bi_id)`, `idx_yeu_cau_sua_chua_trang_thai (trang_thai)`, `idx_yeu_cau_sua_chua_status_date (trang_thai, ngay_yeu_cau)`, plus PK and other column indexes. There is **no** composite `(thiet_bi_id, trang_thai)` index; earlier migrations that defined `idx_yeu_cau_sua_chua_equipment_status` are not present on the live DB.

Acceptance: the same migration that introduces `repair_request_active_for_equipment` adds:

```sql
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_status
  ON public.yeu_cau_sua_chua (thiet_bi_id, trang_thai);
```

Justification: the resolver query filters on `(r.thiet_bi_id = X AND r.trang_thai IN (...))` for every Equipment Detail open of a "Chờ sửa chữa" device. The single-column `(thiet_bi_id)` index is sufficient at current cardinality (a few historical repair rows per equipment), but the composite removes the post-fetch filter and keeps cost flat as repair history grows. Cost: <1 KB index per few hundred rows. Naming aligns with existing `idx_yeu_cau_sua_chua_*` convention.

### Allowed-functions registration

`src/app/api/rpc/[fn]/allowed-functions.ts` gains `'repair_request_active_for_equipment'` in the whitelist. No other proxy changes are needed because the RPC takes only `p_thiet_bi_id` and the proxy's tenant override (which clobbers `p_don_vi` for non-global users) does not apply.

### Smoke tests

`supabase/tests/repair_request_active_for_equipment_smoke.sql` covers:

1. Tenant isolation — user of tenant A querying equipment of tenant B → `{active_count:0, request:null}`.
2. Soft-deleted equipment → `{active_count:0, request:null}`.
3. Equipment with only completed history → `{active_count:0, request:null}`.
4. Single active record → `active_count:1`, `request` matches.
5. Multiple active records with different `ngay_duyet` → `active_count:N`, `request.id` is the most-recently-updated.
6. Tie when `ngay_duyet` and `ngay_yeu_cau` are identical → falls back to `id DESC` deterministically.

## Frontend

### Resolver hook

`src/components/equipment-linked-request/resolvers/useResolveActiveRepair.ts`:

```ts
type ActiveRepairResult = {
  active_count: number
  request: RepairRequestWithEquipment | null
}

export function useResolveActiveRepair(opts: {
  equipmentId: number | null
  enabled: boolean
}) {
  return useQuery<ActiveRepairResult>({
    queryKey: buildActiveRepairRequestQueryKey(opts.equipmentId),
    queryFn: ({ signal }) =>
      callRpc<ActiveRepairResult>({
        fn: 'repair_request_active_for_equipment',
        args: { p_thiet_bi_id: opts.equipmentId! },
        signal,
      }),
    enabled: opts.enabled && !!opts.equipmentId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
```

### Cache invalidation contract

`repair_request_active_for_equipment` queries are scoped under the same `repairKeys.all` prefix that `src/hooks/use-cached-repair.ts` uses. `repairKeys` gains an `active` sub-key:

```ts
export const repairKeys = {
  all: ['repair'] as const,
  // ... existing
  active: (equipmentId: number | null) =>
    [...repairKeys.all, 'active', equipmentId] as const,
}
```

The resolver's `queryKey` becomes `repairKeys.active(equipmentId)`. Existing mutations that invalidate `repairKeys.all` (`useCreateRepairRequest`, `useAssignRepairRequest`, `useCompleteRepairRequest`, `useDeleteRepairRequest`) cover it for free.

**Existing-mutation alignment (in scope for Phase 1)**: `useUpdateRepairRequest` in `src/hooks/use-cached-repair.ts` currently invalidates only `repairKeys.lists()` and `repairKeys.detail(id)` — not `repairKeys.all`. This was an outlier before this work; if a user edits a repair request elsewhere, the active resolver should refetch so a subsequently opened side sheet shows fresh data. Phase 1 patches `useUpdateRepairRequest` to invalidate `repairKeys.all`, aligning it with the rest of the family. The change is one line and is covered by the existing repair-requests test suite.

### Behaviour matrix

| Equipment status | Resolver state | Button render | Sheet behaviour |
|---|---|---|---|
| ≠ `Chờ sửa chữa` | (not fetched) | Hidden | — |
| `Chờ sửa chữa` | `loading` | Skeleton chip | — |
| `Chờ sửa chữa` | `active_count = 0` | Hidden | — |
| `Chờ sửa chữa` | `active_count = 1` | Visible chip "Yêu cầu sửa chữa hiện tại →" | Click → opens sheet with `request` |
| `Chờ sửa chữa` | `active_count > 1` | Visible chip "{N} yêu cầu sửa chữa active — mở bản mới nhất" | Click → opens sheet; sheet header shows `<Alert role="alert">` "Phát hiện {N} yêu cầu active. Đang hiển thị bản cập nhật mới nhất." with a footer link to `buildRepairRequestsByEquipmentHref(thiet_bi_id)` |
| `Chờ sửa chữa` | `error` | Hidden + `console.error` | — |

Eager fetch (queried as soon as the dialog opens with matching status) was chosen over hover/lazy because the gating predicate already keeps cardinality low and a flicker-free button is worth the one network call per qualifying open.

### Sheet adapter

`adapters/repairRequestSheetAdapter.tsx` is loaded via `next/dynamic(() => import(...), { ssr: false })` from `LinkedRequestSheetHost`. It:

1. Renders `<RepairRequestsDetailView requestToView={request} onClose={...} />`.
2. Injects the multi-active warning `<Alert>` inside the sheet header when `active_count > 1`.
3. Adds a footer link "Mở trong trang Yêu cầu sửa chữa" pointing to `buildRepairRequestsByEquipmentHref(request.thiet_bi_id)`.

The dynamic import keeps the equipment route bundle clean — `RepairRequestsDetailView` and its tab/history dependencies are not pulled into the equipment chunk on initial load.

### Provider lifecycle and auto-close

`LinkedRequestProvider` exposes:

```ts
type LinkedRequestState = {
  open: boolean
  kind: 'repair' | null
  equipmentId: number | null
}

interface LinkedRequestContextValue {
  state: LinkedRequestState
  openRepair: (equipmentId: number) => void
  close: () => void
}
```

Two effects ensure consistency:

1. **Auto-close when Equipment Detail closes** — the Provider subscribes to `EquipmentDialogContext` and calls `close()` whenever `dialogState.isDetailOpen` flips to `false`. Prevents a stranded sheet when the user dismisses Equipment Detail.
2. **Auto-close when active record disappears** — the Provider observes the resolver result; if the sheet is open and the resolver refetches with `active_count: 0`, it calls `close()` and emits a `toast({title: "Yêu cầu đã được hoàn thành"})`. This refetch is **always triggered externally to the sheet** in Phase 1 (mutations originate elsewhere, e.g., `/repair-requests` page in the same SPA session, or a refocus that revalidates the cache). The sheet itself surfaces no mutation actions — see the "read/detail parity" decision.

## Race-condition & N+1 safeguards

### Race conditions

| Scenario | Why it cannot manifest |
|---|---|
| Switch from Equipment A's detail to B's before A's resolver responds | Each equipmentId has its own `queryKey`; the Provider only reads the cache for the current `equipmentId`. A's response lands in A's cache and is never read by B's UI. |
| Close Equipment Detail while resolver is in flight | `useQuery({ signal })` cancels via `AbortSignal` on unmount; `callRpc` already threads `signal` through to fetch. |
| Rapid double-click on the button | TanStack Query single-flight dedupes identical query keys to one in-flight request. |
| Mutate request in another component while sheet is open | Mutations call `invalidateQueries({ queryKey: repairKeys.all })` (existing for create/approve/complete/delete; this spec aligns `useUpdateRepairRequest` to do the same). The resolver refetches, the sheet's auto-close effect kicks in if the request is no longer active. The sheet itself never originates a mutation in Phase 1. |
| Sheet open when Equipment Detail is dismissed | Provider's auto-close effect tied to `dialogState.isDetailOpen`. |
| Resolver returns an id that has been deleted between fetch and open | `RepairRequestsDetailView` already has `SAFE_HISTORY_ERROR_MESSAGE` for downstream history failures; the detail view itself shows the snapshot from the resolver payload, so a transient deletion does not crash. |

### N+1 prevention

The button is rendered **only inside `EquipmentDetailDialog`**, which mounts at most one equipment at a time. Resolver hook accepts a single `p_thiet_bi_id`, never an array. There is no loop.

To prevent regressions:

- The adoption test (§6.3) asserts that `LinkedRequestButton` is **not** imported by `equipment-table-columns.tsx`, `equipment-actions-menu.tsx`, or `mobile-equipment-list-item.tsx`.
- A guideline note in `CLAUDE.md` (under Equipment section) documents that any future "active record indicator" in equipment list rows must be a column on `equipment_list_enhanced`, not a per-row resolver call.

## Performance

- **DB cost per call**: single CTE scan of `yeu_cau_sua_chua` rows for one equipment, fully indexed. Expected p95 < 5 ms.
- **Frequency**: gated by `enabled: open && status === 'Chờ sửa chữa'`. Per session: ~1–5 calls.
- **Bundle**: `RepairRequestsDetailView` + its dependencies do **not** ship in the equipment route initial chunk thanks to `next/dynamic` of the adapter.
- **Network**: 1 RPC, ~1–3 KB JSON, cached for 30s.
- **Re-renders**: `LinkedRequestProvider` is a thin container; only the components that subscribe to the resolved `request` re-render when state changes.

## Accessibility

- Button has `aria-label="Yêu cầu sửa chữa hiện tại của thiết bị {ma_thiet_bi}"` for screen-reader context independent of position.
- The chip container uses `role="status"` + `aria-live="polite"` so a delayed resolver result is announced after the dialog opens.
- Multi-active warning uses `role="alert"` so it is announced immediately when the sheet opens.
- Focus management is delegated to Radix: opening the Sheet traps focus within it, closing returns focus to the button. Escape closes only the topmost overlay (Sheet) without closing Equipment Detail.

## Testing strategy (TDD with `user-event`)

All tests are written before the implementation per Ralph contract. Tools: `vitest@4`, `@testing-library/react@16`, `@testing-library/user-event@14`. **No manual browser verification gates** — the matrix below substitutes for them.

### Layer 1 — pure-function unit tests

`src/lib/__tests__/repair-request-deep-link.test.ts`

- `buildRepairRequestCreateIntentHref` — back-compat with renamed file (existing assertions preserved).
- `buildActiveRepairRequestQueryKey` — shape `['repair_request_active_for_equipment', { equipmentId }]`; null equipmentId case.
- `buildRepairRequestViewHref` — query string format, integer requestId only.

`src/components/equipment-linked-request/__tests__/strings.test.ts`

- Snapshot of all Vietnamese copy strings to surface accidental edits.

### Layer 2 — hook tests

`src/components/equipment-linked-request/resolvers/__tests__/useResolveActiveRepair.test.ts`

- `enabled = false` when status mismatches → no fetch.
- `enabled = true` and `equipmentId = X` → fetch fires with correct args.
- AbortSignal — switching equipmentId mid-flight cancels prior request.
- Cache key isolation between two equipment IDs.

### Layer 3 — component tests with `user-event`

All component tests use `userEvent.setup()` (no fake events). They render the component inside a `QueryClientProvider` with a controlled `QueryClient` and a `LinkedRequestProvider`. RPC is stubbed at the `callRpc` level via `vi.mock('@/lib/rpc-client', ...)`.

`src/components/equipment-linked-request/__tests__/LinkedRequestButton.test.tsx`

- Status `"Hoạt động"` → button does not render (no fetch fired; assert with mock spy).
- Status `"Chờ sửa chữa"`, resolver `loading` → skeleton chip rendered.
- Status `"Chờ sửa chữa"`, `active_count: 0` → button does not render.
- Status `"Chờ sửa chữa"`, `active_count: 1` → button visible with single-active label; `userEvent.click(button)` → `openRepair` invoked once with the correct `equipmentId`.
- Status `"Chờ sửa chữa"`, `active_count: 3` → button visible with multi label "{count} yêu cầu sửa chữa active — mở bản mới nhất"; click opens sheet.
- Resolver error → button hidden, no toast, `console.error` called once.
- Keyboard: `userEvent.tab()` reaches the button; `userEvent.keyboard('{Enter}')` triggers `openRepair`.

`src/components/equipment-linked-request/__tests__/LinkedRequestSheetHost.test.tsx`

- When state is `{ open: true, kind: 'repair', equipmentId: 1 }` and resolver returns one active request, the sheet renders with the request's `mo_ta_su_co`.
- Multi-active path renders `<Alert role="alert">` with the count text.
- Footer "Mở trong trang Yêu cầu sửa chữa" link uses `buildRepairRequestsByEquipmentHref(thiet_bi_id)`.
- `userEvent.click(closeButton)` → `close()` invoked, sheet unmounts.
- Escape closes the sheet (`userEvent.keyboard('{Escape}')`).
- `userEvent.click(footerLink)` is blocked from default navigation in the test by jsdom; assert `href`.

### Layer 4 — integration tests

`src/app/(app)/equipment/_components/EquipmentDetailDialog/__tests__/EquipmentDetailLinkedRequest.integration.test.tsx`

Each test wraps both providers and stubs both `equipment_history_list` and `repair_request_active_for_equipment`.

- **Happy path**: open Equipment Detail of a "Chờ sửa chữa" equipment with one active request; resolver resolves; button appears in the status section; `userEvent.click(button)` opens the side sheet; assert sheet content includes the request's description.
- **Status mismatch**: open Equipment Detail with status "Hoạt động" → button never appears; resolver mock not called.
- **Switch-equipment race**: open Detail of equipment 1 (status "Chờ sửa chữa"); before the resolver mock resolves, swap the dialog to equipment 2 (also "Chờ sửa chữa"). Flush both promises. Assert the visible button corresponds to equipment 2's resolver result and never shows equipment 1's data. Verify with `vi.spyOn(callRpc)` that two calls happened with the correct equipment IDs.
- **External-mutation auto-close**: open the side sheet; **outside** the sheet, fire `useCompleteRepairRequest()` against the same `requestId` via the test harness (the sheet renders no action surface, so the mutation must originate from elsewhere). Update the resolver mock to return `{ active_count: 0, request: null }` on the next call. Assert the sheet closes and a "Yêu cầu đã được hoàn thành" toast appears.
- **Update mutation alignment**: render the same external mutation flow with `useUpdateRepairRequest()`; assert the resolver query (`repairKeys.active(equipmentId)`) is invalidated and refetches. Pre-existing tests for `useUpdateRepairRequest` continue to pass after widening its invalidation to `repairKeys.all`.
- **Equipment Detail dismissal closes the sheet**: open the side sheet; close Equipment Detail via `userEvent.click(closeButton)`; assert the side sheet is unmounted.
- **N+1 guard**: render `EquipmentTable` with 50 rows where 10 are "Chờ sửa chữa"; assert `callRpc` for `repair_request_active_for_equipment` is **never** called (no resolver fires for list rows).

### Layer 5 — adoption tests

`src/lib/__tests__/repair-request-deep-link.adoption.test.ts` (renamed from `…create-intent.adoption.test.ts`):

- Existing assertions preserved (desktop equipment actions, Dashboard, QR scanner, AssistantPanel use the helper).
- New: `equipment-linked-request/` package imports URL builders from `@/lib/repair-request-deep-link` (no hardcoded `/repair-requests?...`).
- New: `LinkedRequestButton` is **not** imported by `equipment-table-columns.tsx`, `equipment-actions-menu.tsx`, or `mobile-equipment-list-item.tsx`.

### Layer 6 — backend smoke tests

`supabase/tests/repair_request_active_for_equipment_smoke.sql` covering the six scenarios listed under "Backend → Smoke tests".

### Verification gates (Ralph contract)

For any `.ts` / `.tsx` change:

1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run typecheck`
3. `node scripts/npm-run.js run test:run -- <touched test files>`
4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

For SQL changes:

5. Run smoke SQL via Supabase MCP `execute_sql` (per CLAUDE.md, agents must not invoke the Supabase CLI).

## TDD ordering

Stories implemented in this order; each one starts red and ends green before the next begins.

1. **S1** — Helper module rename + new builders. Tests: Layer 1.
2. **S2** — Backend RPC + smoke SQL + allowed-functions registration. Tests: Layer 6.
3. **S3** — Resolver hook. Tests: Layer 2.
4. **S4** — `LinkedRequestProvider` + `LinkedRequestButton`. Tests: Layer 3 (button).
5. **S5** — `LinkedRequestSheetHost` + adapter (with `next/dynamic`). Tests: Layer 3 (host).
6. **S6** — Wire into `EquipmentPageClient`, `equipment-dialogs.tsx`, `EquipmentDetailStatusSection`. Tests: Layer 4 (integration matrix). Adoption test in Layer 5 updated last.

## Migration & rollback

- Forward migration: new file under `supabase/migrations/<timestamp>_add_repair_request_active_for_equipment.sql`. Applied via Supabase MCP `apply_migration` (no CLI per CLAUDE.md).
- Rollback: `DROP FUNCTION public.repair_request_active_for_equipment(INT);`. RPC is read-only and additive, so a drop is safe at any point; no data state to unwind.
- Frontend rollback: revert the FE PR. The orphan RPC, allowed-functions entry, and helper additions are all inert without the UI consumers and can be removed in a follow-up cleanup if desired.

## Open questions

None at design time. Implementation may surface a small choice between "extend the existing helper file in place" vs "rename and re-export from a barrel for back-compat"; both are equivalent under the adoption test once it is updated. The implementation plan picks one.

## Out of scope / follow-ups

- **#207-Phase-2** — same shared module for active transfer requests.
- **#207-Phase-3** — same shared module for active maintenance / calibration / inspection contexts.
- **Repair-request read-family dept-scope guard** — separate issue to add fail-closed `khoa_phong` scope check for role=`user` to `repair_request_get`, `repair_request_list`, and `repair_request_active_for_equipment` in one batch (see "Department scope decision" above).
- **Bookmarkable URL for view sheet** — extend `useRepairRequestsDeepLink` to consume `action=view&requestId=X` and open the detail view on the repair-requests page.
- **Realtime sync** — out of scope until the broader app gains realtime infrastructure.
