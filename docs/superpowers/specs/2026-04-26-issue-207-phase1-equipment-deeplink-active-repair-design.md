# Issue #207 Phase 1 — Deep-link active repair request from Equipment Detail

- **Date**: 2026-04-26
- **Author**: thienchi2109 (with Devin pair)
- **Issue**: [#207](https://github.com/thienchi2109/qltbyt-nam-phong/issues/207) (umbrella) — Phase 1 narrowed scope
- **Status**: Revised 2026-04-27 — pivoted to in-row icon strategy after PR-2a merged. See "Revision history" below.

## Revision history

### 2026-04-27 — Pivot to in-row icon

**Trigger UX changed**: instead of a chip button inside `EquipmentDetailDialog`, the active-repair indicator is a small `Wrench` icon rendered inline next to the existing status `<Badge>` in equipment list rows (desktop `equipment-table-columns.tsx` + mobile `mobile-equipment-list-item.tsx`). User no longer has to open Equipment Detail Dialog to see the indicator.

**Why**: better UX (active-repair signal visible at-a-glance during list browsing). Confirmed via `code-review-graph` impact radius — both paths are "high risk" but in-row is correct semantically: spec already declared in §6.4 "any future active-record indicator in equipment list rows must be a column on `equipment_list_enhanced`, not a per-row resolver call."

**N+1 mitigation**: a single new column `active_repair_request_id INT NULL` on `equipment_list_enhanced` RPC (LATERAL JOIN to `yeu_cau_sua_chua` filtered by `(thiet_bi_id, trang_thai)`, leveraging the composite index from PR-1b). Zero per-row RPCs.

**Throw-away**: `LinkedRequestButton` component (planned but not built — PR-2b drops it). All other pieces (PR-1a helper rename, PR-1b RPC + index, PR-2a provider + resolver hook + types + strings) **fully reused**.

**Sections superseded by this revision**:
- "Decisions captured during brainstorming" → row "Trigger UX"
- "Goals" → goal #1
- "Architecture > Module layout" → `LinkedRequestButton` replaced with `LinkedRequestRowIndicator`
- "Architecture > Wiring inside the Equipment page" → Provider hoisted to `EquipmentPageClient` root; icon mounted in row cells; `EquipmentDetailStatusSection` no longer modified
- "Backend" → adds new "Equipment list extension" subsection
- "Frontend > Cache invalidation contract" → RealtimeProvider extends to invalidate `equipmentKeys.all`
- "Frontend > Behaviour matrix" → renders by row, not by dialog
- "Frontend > Provider lifecycle and auto-close" → drops `EquipmentDialogContext` subscription; only resolver-result auto-close remains
- "Race-condition & N+1 safeguards" → updated rows
- "Testing strategy" → Layer 3 replaces `LinkedRequestButton` tests with `LinkedRequestRowIndicator`; Layer 5 inverts the adoption test
- "Implementation slicing" → see `2026-04-27-issue-338-execution-slices.md` (revised)

The revised content of those sections appears below in-place; the old wording is preserved only in git history.

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
| Trigger UX | **(2026-04-27)** Small `Wrench` icon inline next to the equipment status `<Badge>` in list rows (desktop + mobile). Single tap/click on icon opens the side sheet. Tooltip "Xem phiếu yêu cầu sửa chữa" on desktop hover. (was: chip in `EquipmentDetailDialog` status section) |
| Multiple-active tie-break | Open most-recently-updated record + warning banner inside the sheet |
| Sheet mode | Read/detail parity — reuse `RepairRequestsDetailView` unchanged for detail + history view (no action surface; mutations live in the existing row dropdown on `/repair-requests`) |
| Backend resolver | New dedicated RPC `repair_request_active_for_equipment` |
| RBAC | Visible to any user who can open Equipment Detail; tenant guard enforced server-side |
| Empty state (status says "Chờ sửa chữa" but no active record) | Hide button entirely (Phase 1) |
| React mount strategy | Extract a shared package `src/components/equipment-linked-request/` so Phase 2/3 (transfers, maintenance) can plug in without re-architecting |
| Test strategy | TDD with `@testing-library/user-event` integration tests; no manual-browser-verification gates |

## Goals

1. **(2026-04-27 revised)** From the equipment list (desktop table or mobile card list), when an equipment row has status `"Chờ sửa chữa"` and an active repair request, an inline `Wrench` icon appears next to its status `<Badge>`. Clicking the icon opens the **currently active repair request** in a side sheet without navigating away from the equipment list.
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
├── LinkedRequestRowIndicator.tsx         (2026-04-27 revised: in-row Wrench icon + Tooltip; replaces LinkedRequestButton)
├── LinkedRequestSheetHost.tsx            (mounts the right Sheet by kind via dynamic import)
├── resolvers/
│   └── useResolveActiveRepair.ts         (Phase 1 implementation; called from SheetHost on open)
├── adapters/
│   └── repairRequestSheetAdapter.tsx     (wraps RepairRequestsDetailView; thin)
├── strings.ts                            (Vietnamese copy, i18n-ready)
├── types.ts                              (LinkedRequestKind = 'repair' Phase 1; ResolverResult<T>)
└── index.ts
```

> **2026-04-27 note**: `LinkedRequestButton.tsx` was originally planned (chip in dialog); replaced by `LinkedRequestRowIndicator.tsx` (icon in row). The resolver hook `useResolveActiveRepair` is no longer wired to the trigger — instead it fires lazily from `LinkedRequestSheetHost` when the user clicks the indicator. The trigger-side data (whether to show the icon at all) comes from `equipment.active_repair_request_id` populated by `equipment_list_enhanced`.

### Helper module rename + additions

`src/lib/repair-request-create-intent.ts` → renamed to `src/lib/repair-request-deep-link.ts`. All existing exports preserved (re-exported from a barrel if needed for backward compat during the rename) plus:

```ts
export const REPAIR_REQUEST_VIEW_ACTION = 'view'

// Shape: ['repair', 'active', equipmentId]. Leading 'repair' element matches
// repairKeys.all from @/hooks/use-cached-repair so existing mutation
// invalidations subsume this query family by prefix-match (TanStack Query v5
// compares array elements element-wise via Object.is).
export function buildActiveRepairRequestQueryKey(equipmentId: number | null) {
  return ['repair', 'active', equipmentId] as const
}

// Phase 1: not consumed by route sync yet, but stable for future bookmarkable URL story.
export function buildRepairRequestViewHref(requestId: number) {
  const params = new URLSearchParams({ action: REPAIR_REQUEST_VIEW_ACTION, requestId: String(requestId) })
  return `${REPAIR_REQUESTS_PATH}?${params.toString()}`
}
```

The adoption test is renamed accordingly and gains assertions described in §6.3.

### Wiring inside the Equipment page (2026-04-27 revised)

- `EquipmentPageClient` wraps `EquipmentPageContent` with `<LinkedRequestProvider>` **at root level** (sibling, then inside, of `EquipmentDialogProvider`). This keeps the provider scope above both the table tree and the dialog tree so the icon (rendered in row cells) and the SheetHost (rendered next to dialogs) share state through it.
- `equipment-dialogs.tsx` adds `<LinkedRequestSheetHost />` next to `<EquipmentDetailDialog />`. They are React siblings; the side sheet visually stacks via z-index (Sheet `z-[1002]`) **independently of any open dialog**.
- `equipment-table-columns.tsx` renders `<LinkedRequestRowIndicator equipment={row} />` in the `tinh_trang_hien_tai` cell, immediately after the status `<Badge>`. Indicator is gated locally on `equipment.tinh_trang_hien_tai === 'Chờ sửa chữa' && equipment.active_repair_request_id != null` — no resolver fires from the row.
- `mobile-equipment-list-item.tsx` renders the same indicator next to its mobile status badge.
- `EquipmentDetailDialog/EquipmentDetailStatusSection.tsx` is **not** modified by Phase 1 anymore.

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
      r.id,
      r.thiet_bi_id,
      r.ngay_yeu_cau,
      r.trang_thai,
      r.mo_ta_su_co,
      r.hang_muc_sua_chua,
      r.ngay_mong_muon_hoan_thanh,
      r.nguoi_yeu_cau,
      r.ngay_duyet,
      r.ngay_hoan_thanh,
      r.nguoi_duyet,
      r.nguoi_xac_nhan,
      r.don_vi_thuc_hien,
      r.ten_don_vi_thue,
      r.ket_qua_sua_chua,
      r.ly_do_khong_hoan_thanh,
      r.chi_phi_sua_chua,
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
        FROM active a
        ORDER BY COALESCE(a.ngay_duyet, a.ngay_yeu_cau) DESC, a.id DESC
        LIMIT 1
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

### Equipment list extension (2026-04-27 revised — drives the in-row icon)

The icon in the row needs to know "does this equipment have an active repair request right now?" without firing per-row RPCs. We add a single column to the existing `equipment_list_enhanced` JSONB array:

```sql
-- Inside the SELECT projection of equipment_list_enhanced, add:
LEFT JOIN LATERAL (
  SELECT r.id AS active_id
  FROM public.yeu_cau_sua_chua r
  WHERE r.thiet_bi_id = tb.id
    AND r.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
  ORDER BY r.ngay_yeu_cau DESC, r.id DESC
  LIMIT 1
) ar ON TRUE
-- ... and project ar.active_id AS active_repair_request_id in the JSONB row.
```

Index reuse: the `idx_yeu_cau_sua_chua_thiet_bi_status (thiet_bi_id, trang_thai)` composite already added in PR-1b satisfies this query (single index seek per row in the page).

**Type generation**: `Equipment` (`@/types/database`) gains `active_repair_request_id?: number | null`.

**Backwards compatibility**: the column is additive in the JSONB output. Existing consumers (`useEquipmentData`, `use-cached-equipment`, `transfer-dialog.data`, etc.) ignore unknown keys and remain green.

**No new RPC**: the existing `repair_request_active_for_equipment` RPC stays. It is no longer called from the row trigger; it is called by `LinkedRequestSheetHost` when the user clicks the icon (lazy fetch of full request payload + `active_count`).

**Smoke test extension**: `supabase/tests/equipment_list_enhanced_active_repair_smoke.sql` covers:

1. Equipment with no repair history → `active_repair_request_id IS NULL`.
2. Equipment with completed-only history → `active_repair_request_id IS NULL`.
3. Equipment with one `Chờ xử lý` request → matches the request's id.
4. Equipment with multiple actives across `Chờ xử lý` + `Đã duyệt` → returns the one with the latest `ngay_yeu_cau` (tiebreak `id DESC`).
5. Soft-deleted equipment → row excluded from list (independent of column).
6. Cross-tenant isolation — user of tenant A querying tenant B → row excluded by existing tenant guard, column never observed.

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

**Existing-mutation alignment (already landed pre-implementation, commit `66bb762`)**: `useUpdateRepairRequest` in `src/hooks/use-cached-repair.ts` previously invalidated only `repairKeys.lists()` and `repairKeys.detail(id)` — not `repairKeys.all`. It was the outlier among repair-request mutations and would have left the active resolver (and any other future sub-key under the prefix) stale after edits. The mismatch was discovered during spec review and fixed ahead of full Phase 1 implementation, accompanied by `src/hooks/__tests__/use-cached-repair.invalidation.test.ts` which pins the contract for **all five** repair-request mutations (`create` / `update` / `assign` / `complete` / `delete`) by spying on `queryClient.invalidateQueries` and asserting `repairKeys.all` is among the invalidated keys. Future regressions narrowing any of these will fail the test. Note: this is an exception to the usual "no implementation during design phase" rule; recorded explicitly here so the implementation plan does not re-do this work.

### Cross-cache invalidation: equipment list + repair list (2026-04-27 revised)

The in-row icon depends on `equipment.active_repair_request_id` from `equipment_list_enhanced`. Repair-request mutations must therefore invalidate **both** caches so the icon disappears when a repair is completed/deleted, and appears when a new one is created.

**Strategy**: extend `RealtimeProvider` (`src/contexts/realtime-context.tsx`) to also invalidate `equipmentKeys.all` whenever it observes a `yeu_cau_sua_chua` `INSERT` / `UPDATE` / `DELETE` event. Local mutations don't need to be touched — they already invalidate `repairKeys.all`, and realtime fires within ~100ms of the DB write to invalidate the equipment side.

```ts
// realtime-context.tsx, inside handleDatabaseChange for yeu_cau_sua_chua:
debouncedInvalidate([repairKeys.all, equipmentKeys.all])
```

**Failure mode**: if the realtime websocket drops, a local repair mutation will leave the icon stale until the next natural list refetch (`staleTime: 30s` on equipment list). To bound the staleness, we tighten `equipment_list_enhanced` `staleTime` to `15_000` (was `60_000`) **only** when the `LinkedRequestProvider` is mounted (route-scoped). Documented in `progress.txt` so future agents know not to revert.

**Why not also patch the 5 mutations**: doing both is redundant and creates two paths that can drift. RealtimeProvider is a single source of truth for cross-cache events (it already does this for the repair list itself). If realtime is broken, mutations alone won't help anyway because they'd fire `equipmentKeys.all` invalidations only on the same tab.

### Behaviour matrix (2026-04-27 revised — gating moves to row data)

The icon's render decision uses **only row data** (no fetch). The resolver fires only when the user clicks the icon (lazy, in `LinkedRequestSheetHost`).

| Equipment row state | Icon render | On click |
|---|---|---|
| `tinh_trang_hien_tai !== 'Chờ sửa chữa'` | Hidden — short-circuits before checking `active_repair_request_id` | — |
| `tinh_trang_hien_tai === 'Chờ sửa chữa'` AND `active_repair_request_id == null` | Hidden | — |
| `tinh_trang_hien_tai === 'Chờ sửa chữa'` AND `active_repair_request_id != null` | Visible: `Wrench` icon with desktop-only Tooltip "Xem phiếu yêu cầu sửa chữa" | `openRepair(equipment.id)` → SheetHost mounts → resolver fires `repair_request_active_for_equipment(equipmentId)` |

When the sheet opens, the matrix below applies (resolver state, not row state):

| Resolver state in SheetHost | Sheet rendering |
|---|---|
| `loading` | The sheet renders nothing yet (next/dynamic Suspense boundary handles UI) — the icon button retains focus until the adapter mounts. |
| `active_count = 0` | Auto-close; toast "Yêu cầu đã được hoàn thành". This handles the edge case where realtime invalidated `equipmentKeys.all` between icon-render and click. |
| `active_count = 1` | Adapter renders `RepairRequestsDetailView`. |
| `active_count > 1` | Adapter renders `RepairRequestsDetailView` plus `<Alert role="alert">` "Phát hiện {N} yêu cầu active. Đang hiển thị bản cập nhật mới nhất." with a footer link `buildRepairRequestsByEquipmentHref(thiet_bi_id)`. |
| `error` | Sheet doesn't open; `console.error`; icon stays available for retry. |

Lazy fetch (resolver only on click) is correct here because the row already has the trigger condition (id != null). One network call per click ≪ one network call per row.

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

**(2026-04-27 revised — only one auto-close trigger)**:

**Auto-close when active record disappears** — the Provider observes the resolver result; if the sheet is open and the resolver refetches with `active_count: 0`, it calls `close()` and emits a `toast({title: "Yêu cầu đã được hoàn thành"})`. Refetch is triggered externally by RealtimeProvider (`yeu_cau_sua_chua` UPDATE/DELETE → debounced invalidate `repairKeys.all`), which fires whether the originating mutation was on the same tab, another tab, or another user. The sheet itself surfaces no mutation actions.

The previous "auto-close when Equipment Detail closes" subscription is **removed** because the trigger source is now the row icon, which exists outside the dialog tree. There is no equivalent parent dismissal to track. If the user navigates away from `/equipment` entirely, the React tree unmounts and the sheet unmounts with it.

## Race-condition & N+1 safeguards

### Race conditions

| Scenario | Why it cannot manifest |
|---|---|
| Switch from Equipment A's detail to B's before A's resolver responds | Each equipmentId has its own `queryKey`; the Provider only reads the cache for the current `equipmentId`. A's response lands in A's cache and is never read by B's UI. |
| Close Equipment Detail while resolver is in flight | `useQuery({ signal })` cancels via `AbortSignal` on unmount; `callRpc` already threads `signal` through to fetch. |
| Rapid double-click on the button | TanStack Query single-flight dedupes identical query keys to one in-flight request. |
| Mutate request in another component while sheet is open | Mutations call `invalidateQueries({ queryKey: repairKeys.all })` (existing for create/approve/complete/delete; this spec aligns `useUpdateRepairRequest` to do the same). The resolver refetches, the sheet's auto-close effect kicks in if the request is no longer active. The sheet itself never originates a mutation in Phase 1. |
| Sheet open when user navigates away from `/equipment` | React tree unmounts; sheet unmounts with it. No subscription needed. |
| Resolver returns an id that has been deleted between fetch and open | `RepairRequestsDetailView` already has `SAFE_HISTORY_ERROR_MESSAGE` for downstream history failures; the detail view itself shows the snapshot from the resolver payload, so a transient deletion does not crash. |
| **(2026-04-27)** Row data shows `active_repair_request_id != null` but the request was just completed/deleted by another user | User clicks icon → resolver fires → returns `{active_count: 0, request: null}` → sheet auto-closes with the standard toast. Worst-case UX: brief flash of the sheet before close. Acceptable. |
| **(2026-04-27)** Realtime websocket dropped, local mutation completes a request | `repairKeys.all` invalidated (mutation does this directly); resolver re-fetches when sheet opens. Equipment list `active_repair_request_id` stays stale until next list refetch (15s with provider mounted). Icon stays visible briefly; clicking it triggers the auto-close path above. |

### N+1 prevention (2026-04-27 revised)

`LinkedRequestRowIndicator` IS rendered per row, but it does **not fire any RPC**. It reads `equipment.active_repair_request_id` (already in row data via `equipment_list_enhanced`) and renders the icon synchronously. The resolver hook only fires when the user clicks the icon — at most once per click — through `LinkedRequestSheetHost`.

This is the design that the original spec already mandated in line "any future active-record indicator in equipment list rows must be a column on `equipment_list_enhanced`, not a per-row resolver call." The 2026-04-27 pivot adopts that rule explicitly for Phase 1 instead of deferring it.

To prevent regressions:

- Adoption test (§6.3) **asserts** that `LinkedRequestRowIndicator` IS imported by `equipment-table-columns.tsx` and `mobile-equipment-list-item.tsx`, and **asserts** it does **not** call `useResolveActiveRepair` or `callRpc`. (Inverse of the original adoption test.)
- Adoption test asserts that `equipment-actions-menu.tsx` does **not** import `LinkedRequestRowIndicator` (the dropdown menu is per-row but the action surface is mutation-oriented; an indicator there would duplicate signal).
- The guideline note in `CLAUDE.md` is rewritten to describe the **current** allowed pattern: "row indicators must read aggregate columns from list RPCs and never call resolvers per row."

## Performance (2026-04-27 revised)

- **DB cost on equipment list**: 1 LATERAL JOIN per row, single index seek on `idx_yeu_cau_sua_chua_thiet_bi_status`. For a 100-row page expected to add ≤2 ms total over the existing list query.
- **DB cost on icon click**: single CTE scan of `yeu_cau_sua_chua` rows for one equipment, fully indexed. Expected p95 < 5 ms (unchanged from original).
- **Frequency of resolver calls**: only on icon click. Per session: typically 0–3 (most users browse without opening the sheet).
- **Bundle**: `RepairRequestsDetailView` + its dependencies do **not** ship in the equipment route initial chunk thanks to `next/dynamic` of the adapter (lazy-loaded inside `LinkedRequestSheetHost`).
- **Network**: 1 RPC per icon click, ~1–3 KB JSON, cached for 30s. Equipment list itself only adds ~12 bytes per row (the optional integer column).
- **Re-renders**: `LinkedRequestProvider` is a thin container; only the components that subscribe to the resolved `request` re-render when state changes. The row indicator is a leaf component; status changes on its row trigger only its own re-render.

## Accessibility (2026-04-27 revised)

- The icon is rendered inside `<button type="button" aria-label="Xem yêu cầu sửa chữa hiện tại của thiết bị {ma_thiet_bi}">` — full label is read by screen readers.
- Tooltip "Xem phiếu yêu cầu sửa chữa" appears on **desktop hover/focus** via shadcn `<Tooltip>`. It is hidden on touch devices to avoid duplicate-action ambiguity (tap = open, no tap-and-hold needed).
- Multi-active warning inside the sheet still uses `role="alert"`.
- Focus management: opening the Sheet traps focus within it via Radix; closing returns focus to the icon button. Escape closes only the topmost overlay (Sheet).
- Keyboard navigation: the icon is part of the row's natural tab order (after status badge, before any row action menu). `Enter` triggers `openRepair` exactly like a click.

## Testing strategy (TDD with `user-event`)

All tests are written before the implementation per Ralph contract. Tools: `vitest@4`, `@testing-library/react@16`, `@testing-library/user-event@14`. **No manual browser verification gates** — the matrix below substitutes for them.

### Layer 1 — pure-function unit tests

`src/lib/__tests__/repair-request-deep-link.test.ts`

- `buildRepairRequestCreateIntentHref` — back-compat with renamed file (existing assertions preserved).
- `buildActiveRepairRequestQueryKey` — shape `['repair', 'active', equipmentId]` (prefix-match against `repairKeys.all`); null equipmentId case + leading-prefix invariant.
- `buildRepairRequestViewHref` — query string format, integer requestId only.

`src/components/equipment-linked-request/__tests__/strings.test.ts`

- Snapshot of all Vietnamese copy strings to surface accidental edits.

### Layer 2 — hook tests

`src/components/equipment-linked-request/resolvers/__tests__/useResolveActiveRepair.test.ts`

- `enabled = false` when status mismatches → no fetch.
- `enabled = true` and `equipmentId = X` → fetch fires with correct args.
- AbortSignal — switching equipmentId mid-flight cancels prior request.
- Cache key isolation between two equipment IDs.

### Layer 3 — component tests with `user-event` (2026-04-27 revised)

All component tests use `userEvent.setup()` (no fake events). They render the component inside a `QueryClientProvider` with a controlled `QueryClient` and a `LinkedRequestProvider`. RPC is stubbed at the `callRpc` level via `vi.mock('@/lib/rpc-client', ...)`.

`src/components/equipment-linked-request/__tests__/LinkedRequestRowIndicator.test.tsx`

- Status `"Hoạt động"` (`active_repair_request_id` ignored) → icon does not render; `callRpc` mock spy never called.
- Status `"Chờ sửa chữa"`, `active_repair_request_id == null` → icon does not render.
- Status `"Chờ sửa chữa"`, `active_repair_request_id = 42` → icon visible; `userEvent.click(icon)` → `openRepair(equipmentId)` invoked once with the correct equipmentId.
- Tooltip: `userEvent.hover(icon)` on desktop env (`window.matchMedia('(hover: hover)')` mocked true) → "Xem phiếu yêu cầu sửa chữa" appears in tooltip role.
- Tooltip suppression: `window.matchMedia('(hover: hover)')` mocked false (touch device) → no tooltip element rendered after hover.
- Keyboard: `userEvent.tab()` reaches the icon button; `userEvent.keyboard('{Enter}')` triggers `openRepair`.
- aria-label includes the equipment's `ma_thiet_bi`.
- **Critical**: `callRpc` is never called by this component under any state. Asserted by `expect(mockCallRpc).not.toHaveBeenCalled()` after every test.

`src/components/equipment-linked-request/__tests__/LinkedRequestSheetHost.test.tsx`

- When state is `{ open: true, kind: 'repair', equipmentId: 1 }` and resolver returns one active request, the sheet renders with the request's `mo_ta_su_co`.
- Multi-active path renders `<Alert role="alert">` with the count text.
- Footer "Mở trong trang Yêu cầu sửa chữa" link uses `buildRepairRequestsByEquipmentHref(thiet_bi_id)`.
- `userEvent.click(closeButton)` → `close()` invoked, sheet unmounts.
- Escape closes the sheet (`userEvent.keyboard('{Escape}')`).
- `userEvent.click(footerLink)` is blocked from default navigation in the test by jsdom; assert `href`.

### Layer 4 — integration tests (2026-04-27 revised)

`src/app/(app)/equipment/__tests__/EquipmentRowLinkedRequest.integration.test.tsx`

Each test wraps `<LinkedRequestProvider>` + `<LinkedRequestSheetHost />` + a minimal `EquipmentTable` (or a stub list) + the row indicator. RPC is stubbed at the `callRpc` level. The icon's render decision uses row data only.

- **Happy path**: render a row with `tinh_trang = 'Chờ sửa chữa'` and `active_repair_request_id = 42`; icon visible; `userEvent.click(icon)` → resolver fires; sheet renders the request's description.
- **Status mismatch**: row with `tinh_trang = 'Hoạt động'` and `active_repair_request_id = 99` → icon never appears (row gating short-circuits before id check).
- **Empty active**: row with `tinh_trang = 'Chờ sửa chữa'` and `active_repair_request_id = null` → icon never appears.
- **Multiple rows**: 50 rows where 10 have `active_repair_request_id != null` → 10 icons visible; `callRpc` mock spy registers **0** calls until the user clicks an icon.
- **Resolver auto-close**: open the sheet from row icon; fire `useCompleteRepairRequest()` from a test harness; resolver mock returns `{active_count: 0, request: null}` on the next call → sheet closes + "Yêu cầu đã được hoàn thành" toast.
- **Update-mutation alignment**: same flow with `useUpdateRepairRequest()`; assert `repairKeys.active(equipmentId)` is invalidated and refetches. (Hook-level contract pinned by `use-cached-repair.invalidation.test.ts`, commit `66bb762`.)
- **Realtime cross-cache invalidation**: simulate a `RealtimeProvider` event for `yeu_cau_sua_chua` UPDATE; assert that both `repairKeys.all` and `equipmentKeys.all` are invalidated; mocked `equipment_list_enhanced` refetch returns the row with `active_repair_request_id = null`; icon disappears in next render.
- **Switch-row race**: open sheet for equipment 1 with a deliberately slow resolver mock; immediately click the icon for equipment 2 (different row); resolver for 2 resolves first; assert the sheet shows equipment 2's data and equipment 1's data never appears (each `equipmentId` has its own queryKey).
- **N+1 guard**: render the equipment table fixture with 50 rows; assert `callRpc` for `repair_request_active_for_equipment` is **never** called by the table itself. Only the icon click triggers it.

### Layer 5 — adoption tests (2026-04-27 revised — inverted)

`src/lib/__tests__/repair-request-deep-link.adoption.test.ts` (renamed from `…create-intent.adoption.test.ts`):

- Existing assertions preserved (desktop equipment actions, Dashboard, QR scanner, AssistantPanel use the helper).
- `equipment-linked-request/` package imports URL builders from `@/lib/repair-request-deep-link` (no hardcoded `/repair-requests?...`).
- `LinkedRequestRowIndicator` IS imported by `equipment-table-columns.tsx` AND `mobile-equipment-list-item.tsx` (test reads each file as text and asserts on the import).
- `LinkedRequestRowIndicator` is **not** imported by `equipment-actions-menu.tsx` (the action menu surface is mutation-oriented; an indicator there would duplicate signal).
- `LinkedRequestRowIndicator.tsx` source does **not** call `callRpc(`, `useResolveActiveRepair(`, or any other resolver hook (regex-asserted on file contents). Synchronous render only.
- `LinkedRequestButton` no longer exists in the codebase (regex-asserted across `src/`).

### Layer 6 — backend smoke tests (2026-04-27 revised)

1. `supabase/tests/repair_request_active_for_equipment_smoke.sql` — six scenarios listed under "Backend → Smoke tests" (PR-1b, already merged).
2. **(2026-04-27 added)** `supabase/tests/equipment_list_enhanced_active_repair_smoke.sql` — six scenarios listed under "Backend → Equipment list extension". Covers: no history, completed-only, single active, multi-active tiebreak, soft-deleted exclusion, cross-tenant exclusion. Run before merging PR-3a.

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
- **Transaction shape:** wrap the migration body in `BEGIN; ... COMMIT;` so the function and the composite index land atomically (matches the convention used by 14/15 of the most recent migrations from `20260416114022` onward — verified 2026-04-27 against `supabase/migrations/`). Plain `CREATE INDEX` is permitted inside a transaction; do **not** use `CONCURRENTLY` here because it forbids the surrounding transaction.
- Rollback (manual, after deploy): `DROP INDEX IF EXISTS public.idx_yeu_cau_sua_chua_thiet_bi_status; DROP FUNCTION public.repair_request_active_for_equipment(INT);`. RPC is read-only and additive, so the drop is safe at any point; no data state to unwind. The full rollback statement is also embedded as a header comment in the migration file for in-situ reference.
- Frontend rollback: revert the FE PR. The orphan RPC, allowed-functions entry, and helper additions are all inert without the UI consumers and can be removed in a follow-up cleanup if desired.

## Open questions

None at design time. Implementation may surface a small choice between "extend the existing helper file in place" vs "rename and re-export from a barrel for back-compat"; both are equivalent under the adoption test once it is updated. The implementation plan picks one.

## Out of scope / follow-ups

- **#207-Phase-2** — same shared module for active transfer requests.
- **#207-Phase-3** — same shared module for active maintenance / calibration / inspection contexts.
- **Repair-request read-family dept-scope guard** — separate issue to add fail-closed `khoa_phong` scope check for role=`user` to `repair_request_get`, `repair_request_list`, and `repair_request_active_for_equipment` in one batch (see "Department scope decision" above).
- **Bookmarkable URL for view sheet** — extend `useRepairRequestsDeepLink` to consume `action=view&requestId=X` and open the detail view on the repair-requests page.
- **Realtime sync** — out of scope until the broader app gains realtime infrastructure.
