# Fix #202: Transfer Detail Dialog History → `audit_logs`

Replace the stale `transfer_history_list` RPC (queries non-existent `lich_su_luan_chuyen`) with a new RPC that reads from `audit_logs`, and update the frontend to render the new contract.

## Proposed Changes

### Backend — SQL Migration

#### [NEW] Migration: `create_transfer_change_history_list`

New RPC `transfer_change_history_list(p_entity_id BIGINT)` querying `audit_logs`.

> [!IMPORTANT]
> SQL follows project conventions from latest migration `transfer_request_get`:
> - Uses `public._get_jwt_claim()` helper (not raw `current_setting`)
> - Uses `JSONB` (not `json`)
> - Tenant isolation via `allowed_don_vi_for_session_safe()`
> - Role fallback chain: `app_role` → `role`

```sql
CREATE OR REPLACE FUNCTION public.transfer_change_history_list(
  p_entity_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(
    public._get_jwt_claim('app_role'),
    public._get_jwt_claim('role'), ''
  ));
  v_user_id TEXT := NULLIF(COALESCE(
    public._get_jwt_claim('user_id'),
    public._get_jwt_claim('sub')
  ), '');
  v_don_vi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[] := NULL;
  v_result JSONB;
BEGIN
  -- Input guard
  IF p_entity_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  -- JWT claim guards
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  -- Tenant isolation
  v_is_global := v_role IN ('global', 'admin');

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_global THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF array_length(v_allowed, 1) IS NULL THEN
      RETURN '[]'::JSONB;
    END IF;
  END IF;

  -- Query audit_logs for this transfer request, tenant-scoped
  SELECT jsonb_agg(jsonb_build_object(
    'id', al.id,
    'action_type', al.action_type,
    'admin_username', al.admin_username,
    'admin_full_name', COALESCE(nv.full_name, al.admin_username),
    'action_details', al.action_details,
    'created_at', al.created_at
  ) ORDER BY al.created_at DESC)
  INTO v_result
  FROM public.audit_logs al
  LEFT JOIN public.nhan_vien nv ON nv.id = al.admin_user_id
  -- Tenant scope: join through transfer → equipment → don_vi
  LEFT JOIN public.yeu_cau_luan_chuyen yclc ON yclc.id = al.entity_id
  LEFT JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
  WHERE al.entity_type = 'transfer_request'
    AND al.entity_id = p_entity_id
    AND (
      v_is_global
      OR (
        array_length(v_allowed, 1) IS NOT NULL
        AND tb.don_vi = ANY(v_allowed)
      )
    );

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- Drop stale function (runtime signature is INTEGER, not BIGINT)
DROP FUNCTION IF EXISTS public.transfer_history_list(INTEGER);

GRANT EXECUTE ON FUNCTION public.transfer_change_history_list TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_change_history_list FROM PUBLIC;
```

---

### Frontend — Type Layer

#### [MODIFY] [database.ts](file:///d:/qltbyt-nam-phong/src/types/database.ts)

Replace `TransferHistory` interface (lines 175-187):

```diff
-export interface TransferHistory {
-  id: number;
-  yeu_cau_id: number;
-  trang_thai_cu?: string;
-  trang_thai_moi: string;
-  hanh_dong: string;
-  mo_ta?: string;
-  nguoi_thuc_hien_id?: number;
-  thoi_gian: string;
-  nguoi_thuc_hien?: UserSummary | null;
-}
+export interface TransferChangeHistory {
+  id: number;
+  action_type: string;
+  admin_username: string;
+  admin_full_name: string;
+  action_details: Record<string, unknown> | null;
+  created_at: string;
+}
```

---

### Frontend — Data Hook + Query Keys (TanStack Query)

#### [MODIFY] [transfer-detail-dialog.data.ts](file:///d:/qltbyt-nam-phong/src/components/transfer-detail-dialog.data.ts)

> [!IMPORTANT]
> Query key factory pattern (`transferDetailDialogQueryKeys`) is the single source of truth for both the `useQuery` call **and** cache invalidation in `useTransferActions` (line 65: `queryClient.invalidateQueries({ queryKey: transferDetailDialogQueryKeys.historyRoot })`). Renaming the key here automatically propagates to all consumers.

```diff
 export const transferDetailDialogQueryKeys = {
   detailRoot: ["transfer_request_get"] as const,
   detail: (transferId: number | null) =>
     [...transferDetailDialogQueryKeys.detailRoot, { id: transferId }] as const,
-  historyRoot: ["transfer_history_list"] as const,
+  historyRoot: ["transfer_change_history_list"] as const,
   history: (transferId: number | null) =>
-    [...transferDetailDialogQueryKeys.historyRoot, { yeu_cau_id: transferId }] as const,
+    [...transferDetailDialogQueryKeys.historyRoot, { p_entity_id: transferId }] as const,
 }
```

- Change `callRpc` fn: `"transfer_history_list"` → `"transfer_change_history_list"`
- Change args: `{ p_yeu_cau_id: transferId! }` → `{ p_entity_id: transferId! }`
- Change generic: `callRpc<TransferHistory[]>` → `callRpc<TransferChangeHistory[]>`

---

### Frontend — UI Rendering

#### [MODIFY] [transfer-detail-dialog.tsx](file:///d:/qltbyt-nam-phong/src/components/transfer-detail-dialog.tsx)

Update "Lịch sử thay đổi" section (lines 276-317) to render new fields:
- `item.action_type` → mapped via Vietnamese labels
- `item.admin_full_name` → actor display
- `item.created_at` → timestamp
- `item.action_details` → optional details display

#### [MODIFY] [use-audit-logs.ts](file:///d:/qltbyt-nam-phong/src/hooks/use-audit-logs.ts)

Add missing `ACTION_TYPE_LABELS` entries for transfer request actions:

```diff
   // Transfer Management
   'transfer_create': 'Tạo yêu cầu chuyển giao',
   'transfer_update': 'Cập nhật yêu cầu chuyển giao',
+  'transfer_request_create': 'Tạo yêu cầu luân chuyển',
+  'transfer_request_update': 'Cập nhật yêu cầu luân chuyển',
```

---

### Frontend — RPC Whitelist

#### [MODIFY] [route.ts](file:///d:/qltbyt-nam-phong/src/app/api/rpc/%5Bfn%5D/route.ts)

```diff
-  'transfer_history_list',
+  'transfer_change_history_list',
```

---

## TDD Verification Plan

Following Red-Green-Refactor cycle. Test commands:

```bash
npx vitest --reporter=verbose --run -- src/components/__tests__/transfer-detail-dialog.test.tsx
npx vitest --reporter=verbose --run -- src/hooks/__tests__/useTransferActions.test.tsx
```

### Cycle 1: RED — Data hook calls new RPC + param name

Update test in `transfer-detail-dialog.test.tsx`:
- Assert `callRpc` with `fn: 'transfer_change_history_list'` and `args: { p_entity_id: ... }`

→ **Verify RED**: fails (code still calls old RPC name + old param).

→ **GREEN**: Update `transfer-detail-dialog.data.ts` (query keys, RPC name, args, type).

→ **Verify GREEN**: passes.

### Cycle 2: RED — History renders `action_type` label + actor name

Add test asserting that when history data is `{ action_type: 'transfer_request_create', admin_full_name: 'Nguyễn Văn A', created_at: '...' }`, the dialog renders the Vietnamese label and actor name.

→ **Verify RED**: fails (UI still renders `item.hanh_dong`).

→ **GREEN**: Update `TransferChangeHistory` type, `transfer-detail-dialog.tsx` rendering, add `ACTION_TYPE_LABELS` entries.

→ **Verify GREEN**: passes.

### Cycle 3: RED — `useTransferActions` invalidation key sync

Update `useTransferActions.test.tsx` line 138:
```diff
-      queryKey: ["transfer_history_list"],
+      queryKey: ["transfer_change_history_list"],
```

→ **Verify GREEN** immediately — no code change needed since `useTransferActions` imports `transferDetailDialogQueryKeys.historyRoot` (already updated in Cycle 1).

### Cycle 4: RPC Whitelist + SQL Migration

- Update RPC whitelist in `route.ts`
- Apply SQL migration via Supabase MCP
- Verify with:

```bash
npx vitest --reporter=verbose --run -- src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts
```

### Final Verification

```bash
npx vitest --reporter=verbose --run
```

All tests must pass with zero failures.
