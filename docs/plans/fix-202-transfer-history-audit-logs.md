# Fix #202: Transfer Detail Dialog History → `audit_logs`

Replace the stale `transfer_history_list` RPC (queries non-existent `lich_su_luan_chuyen`) with a new RPC that reads from `audit_logs`, and update the frontend to render the new contract.

## Proposed Changes

### Backend — SQL Migration

#### [NEW] Migration: `create_transfer_change_history_list`

New RPC `transfer_change_history_list(p_entity_id BIGINT)` querying `audit_logs`.

> [!IMPORTANT]
> SQL updated to match project conventions from latest migration `transfer_request_get`:
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

-- Drop stale function that references non-existent lich_su_luan_chuyen
DROP FUNCTION IF EXISTS public.transfer_history_list(BIGINT);

GRANT EXECUTE ON FUNCTION public.transfer_change_history_list TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_change_history_list FROM PUBLIC;
```

**Security compliance** (per knowledge items):
- ✅ `SECURITY DEFINER` + `SET search_path = public, pg_temp`
- ✅ JWT claim guards (`app_role`, `user_id`)
- ✅ `GRANT authenticated` / `REVOKE PUBLIC`
- ✅ No ILIKE needed (exact match on `entity_id`)
- ✅ JOIN on `nhan_vien` to get `full_name` for actor display

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

### Frontend — Data Hook

#### [MODIFY] [transfer-detail-dialog.data.ts](file:///d:/qltbyt-nam-phong/src/components/transfer-detail-dialog.data.ts)

- Change query key from `transfer_history_list` → `transfer_change_history_list`
- Change `callRpc` fn name and generic type
- Replace `TransferHistory` import with `TransferChangeHistory`

---

### Frontend — UI Rendering

#### [MODIFY] [transfer-detail-dialog.tsx](file:///d:/qltbyt-nam-phong/src/components/transfer-detail-dialog.tsx)

Update "Lịch sử thay đổi" section (lines 276-317) to render new fields:
- `item.action_type` → mapped via `ACTION_TYPE_LABELS` from `use-audit-logs.ts`
- `item.admin_full_name` → actor display
- `item.created_at` → timestamp
- `item.action_details` → optional details display

---

### Frontend — RPC Whitelist

#### [MODIFY] [route.ts](file:///d:/qltbyt-nam-phong/src/app/api/rpc/%5Bfn%5D/route.ts)

```diff
-  'transfer_history_list',
+  'transfer_change_history_list',
```

---

## TDD Verification Plan

Following Red-Green-Refactor cycle. Test command:

```bash
npx vitest --reporter=verbose --run -- src/components/__tests__/transfer-detail-dialog.test.tsx
```

### Cycle 1: RED — Data hook calls new RPC

Update existing test in `transfer-detail-dialog.test.tsx` to assert `callRpc` is called with `fn: 'transfer_change_history_list'` instead of `'transfer_history_list'`.

→ **Verify RED**: test fails because code still calls old RPC name.

→ **GREEN**: Update `transfer-detail-dialog.data.ts` to call new RPC.

→ **Verify GREEN**: test passes.

### Cycle 2: RED — History renders `action_type` label + actor name

Add test asserting that when history data is returned with `{ action_type: 'transfer_request_create', admin_full_name: 'Nguyễn Văn A', created_at: '...' }`, the dialog renders the Vietnamese label ("Tạo yêu cầu chuyển giao") and the actor name.

→ **Verify RED**: test fails because UI still renders `item.hanh_dong`.

→ **GREEN**: Update `TransferChangeHistory` type in `database.ts`, update `transfer-detail-dialog.tsx` rendering.

→ **Verify GREEN**: test passes.

### Cycle 3: RED — History renders empty state correctly with new contract

Verify existing test for empty history (`"Chưa có lịch sử thay đổi"`) still passes after refactor.

→ This is a regression guard — should stay GREEN immediately.

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
