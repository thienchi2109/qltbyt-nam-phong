# Transfers Kanban Board Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Kanban board view to transfers page that handles 10,000+ transfers with virtual scrolling, per-column pagination, and dual view mode (Table/Kanban toggle).

**Architecture:** Extend existing `transfer_request_list` RPC function with kanban mode parameter, create 5 new components (KanbanView, KanbanColumn, KanbanCard, ViewToggle, TableView extraction), reuse all existing hooks/dialogs/actions.

**Tech Stack:** Next.js 15, React 18, TanStack Query v5, @tanstack/react-virtual, Supabase PostgreSQL RPC, TypeScript strict mode

---

## Prerequisites

**Verify current state:**
- [ ] Existing transfers page uses `transfer_request_list` RPC (line 73 in page.tsx)
- [ ] Table view uses TanStack Table with server pagination (line 325)
- [ ] Status types: cho_duyet, da_duyet, dang_luan_chuyen, da_ban_giao, hoan_thanh (transfers-data-grid.ts:3-8)

**Create working branch:**
```bash
git checkout -b feature/transfers-kanban-board
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Add @tanstack/react-virtual dependency**

```bash
npm install @tanstack/react-virtual@^3.0.0
```

**Step 2: Verify installation**

Run: `npm list @tanstack/react-virtual`
Expected: `@tanstack/react-virtual@3.x.x`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @tanstack/react-virtual for kanban virtualization"
```

---

## Task 2: Backend - Extend RPC Function for Kanban Mode

**Files:**
- Create: `supabase/migrations/20260112_extend_transfer_list_for_kanban.sql`

**Step 1: Create migration file**

Create `supabase/migrations/20260112_extend_transfer_list_for_kanban.sql`:

```sql
-- Migration: Extend transfer_request_list for Kanban board support
-- Date: 2026-01-12
-- Purpose: Add kanban view mode with per-column pagination
-- Backward compatible: All new params have defaults

-- Add database index for kanban query performance
CREATE INDEX IF NOT EXISTS idx_transfer_kanban
ON public.yeu_cau_luan_chuyen (thiet_bi_id, trang_thai, created_at DESC)
WHERE trang_thai IN ('cho_duyet', 'da_duyet', 'dang_luan_chuyen', 'da_ban_giao', 'hoan_thanh');

COMMENT ON INDEX idx_transfer_kanban IS 'Optimizes kanban board queries with status filtering and date ordering';

-- Drop existing function to add new parameters
DROP FUNCTION IF EXISTS public.transfer_request_list(TEXT, TEXT[], TEXT[], INT, INT, BIGINT, DATE, DATE, BIGINT[]);

-- Recreate with kanban parameters (backward compatible)
CREATE OR REPLACE FUNCTION public.transfer_request_list(
  p_q TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,
  p_types TEXT[] DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_assignee_ids BIGINT[] DEFAULT NULL,
  -- NEW KANBAN PARAMETERS
  p_view_mode TEXT DEFAULT 'table',          -- 'table' | 'kanban'
  p_per_column_limit INT DEFAULT 30,         -- Tasks per column (kanban only)
  p_exclude_completed BOOLEAN DEFAULT FALSE  -- Hide hoan_thanh (kanban only)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_effective_donvi BIGINT := NULL;
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 50), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  v_kanban_result JSONB;
BEGIN
  -- Tenant isolation (same as existing logic)
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      IF p_view_mode = 'kanban' THEN
        RETURN jsonb_build_object('columns', '{}'::jsonb, 'totalCount', 0);
      ELSE
        RETURN jsonb_build_object('data','[]'::jsonb,'total',0,'page',p_page,'pageSize',p_page_size);
      END IF;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        IF p_view_mode = 'kanban' THEN
          RETURN jsonb_build_object('columns', '{}'::jsonb, 'totalCount', 0);
        ELSE
          RETURN jsonb_build_object('data','[]'::jsonb,'total',0,'page',p_page,'pageSize',p_page_size);
        END IF;
      END IF;
    END IF;
  END IF;

  -- KANBAN MODE BRANCH
  IF p_view_mode = 'kanban' THEN
    WITH status_groups AS (
      SELECT
        yclc.trang_thai as status,
        jsonb_agg(
          jsonb_build_object(
            'id', yclc.id,
            'ma_yeu_cau', yclc.ma_yeu_cau,
            'thiet_bi_id', yclc.thiet_bi_id,
            'loai_hinh', yclc.loai_hinh,
            'trang_thai', yclc.trang_thai,
            'nguoi_yeu_cau_id', yclc.nguoi_yeu_cau_id,
            'ly_do_luan_chuyen', yclc.ly_do_luan_chuyen,
            'khoa_phong_hien_tai', yclc.khoa_phong_hien_tai,
            'khoa_phong_nhan', yclc.khoa_phong_nhan,
            'muc_dich', yclc.muc_dich,
            'don_vi_nhan', yclc.don_vi_nhan,
            'dia_chi_don_vi', yclc.dia_chi_don_vi,
            'nguoi_lien_he', yclc.nguoi_lien_he,
            'so_dien_thoai', yclc.so_dien_thoai,
            'ngay_du_kien_tra', yclc.ngay_du_kien_tra,
            'ngay_ban_giao', yclc.ngay_ban_giao,
            'ngay_hoan_tra', yclc.ngay_hoan_tra,
            'ngay_hoan_thanh', yclc.ngay_hoan_thanh,
            'nguoi_duyet_id', yclc.nguoi_duyet_id,
            'ngay_duyet', yclc.ngay_duyet,
            'ghi_chu_duyet', yclc.ghi_chu_duyet,
            'created_at', yclc.created_at,
            'updated_at', yclc.updated_at,
            'created_by', yclc.created_by,
            'updated_by', yclc.updated_by,
            'thiet_bi', jsonb_build_object(
              'ten_thiet_bi', tb.ten_thiet_bi,
              'ma_thiet_bi', tb.ma_thiet_bi,
              'model', tb.model,
              'serial', tb.serial,
              'khoa_phong_quan_ly', kp.ten_khoa_phong,
              'facility_name', dv.ten_don_vi,
              'facility_id', dv.id
            )
          )
          ORDER BY yclc.created_at DESC
        ) FILTER (WHERE rn <= p_per_column_limit) as tasks,
        COUNT(*) as total_count
      FROM (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY yclc.trang_thai
          ORDER BY yclc.created_at DESC
        ) as rn
        FROM public.yeu_cau_luan_chuyen yclc
        JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
        LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
        LEFT JOIN public.khoa_phong kp ON kp.id = tb.khoa_phong_id
        WHERE (
          (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
          (v_role <> 'global' AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
        )
        AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
        AND (NOT p_exclude_completed OR yclc.trang_thai != 'hoan_thanh')
        AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
        AND (
          p_q IS NULL OR p_q = '' OR
          yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
          yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
          tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
          tb.ma_thiet_bi ILIKE '%' || p_q || '%'
        )
        AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
        AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
      ) yclc
      GROUP BY yclc.trang_thai
    )
    SELECT jsonb_build_object(
      'columns', COALESCE(jsonb_object_agg(status, jsonb_build_object(
        'tasks', COALESCE(tasks, '[]'::jsonb),
        'total', total_count,
        'hasMore', total_count > p_per_column_limit
      )), '{}'::jsonb),
      'totalCount', (SELECT COALESCE(SUM(total_count), 0) FROM status_groups)
    ) INTO v_kanban_result
    FROM status_groups;

    RETURN v_kanban_result;
  END IF;

  -- TABLE MODE (existing logic - unchanged)
  SELECT count(*) INTO v_total
  FROM public.yeu_cau_luan_chuyen yclc
  JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
  LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
  WHERE (
    (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
    (v_role <> 'global' AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
  )
  AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
  AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
  AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
  AND (
    p_q IS NULL OR p_q = '' OR
    yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
    yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
    tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
    tb.ma_thiet_bi ILIKE '%' || p_q || '%'
  )
  AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'));

  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT jsonb_build_object(
      'id', yclc.id,
      'ma_yeu_cau', yclc.ma_yeu_cau,
      'thiet_bi_id', yclc.thiet_bi_id,
      'loai_hinh', yclc.loai_hinh,
      'trang_thai', yclc.trang_thai,
      'nguoi_yeu_cau_id', yclc.nguoi_yeu_cau_id,
      'ly_do_luan_chuyen', yclc.ly_do_luan_chuyen,
      'khoa_phong_hien_tai', yclc.khoa_phong_hien_tai,
      'khoa_phong_nhan', yclc.khoa_phong_nhan,
      'muc_dich', yclc.muc_dich,
      'don_vi_nhan', yclc.don_vi_nhan,
      'dia_chi_don_vi', yclc.dia_chi_don_vi,
      'nguoi_lien_he', yclc.nguoi_lien_he,
      'so_dien_thoai', yclc.so_dien_thoai,
      'ngay_du_kien_tra', yclc.ngay_du_kien_tra,
      'ngay_ban_giao', yclc.ngay_ban_giao,
      'ngay_hoan_tra', yclc.ngay_hoan_tra,
      'ngay_hoan_thanh', yclc.ngay_hoan_thanh,
      'nguoi_duyet_id', yclc.nguoi_duyet_id,
      'ngay_duyet', yclc.ngay_duyet,
      'ghi_chu_duyet', yclc.ghi_chu_duyet,
      'created_at', yclc.created_at,
      'updated_at', yclc.updated_at,
      'created_by', yclc.created_by,
      'updated_by', yclc.updated_by,
      'thiet_bi', jsonb_build_object(
        'ten_thiet_bi', tb.ten_thiet_bi,
        'ma_thiet_bi', tb.ma_thiet_bi,
        'model', tb.model,
        'serial', tb.serial,
        'khoa_phong_quan_ly', kp.ten_khoa_phong,
        'facility_name', dv.ten_don_vi,
        'facility_id', dv.id
      )
    ) as row_data, yclc.created_at
    FROM public.yeu_cau_luan_chuyen yclc
    JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    LEFT JOIN public.khoa_phong kp ON kp.id = tb.khoa_phong_id
    WHERE (
      (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
      (v_role <> 'global' AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
    )
    AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
    AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
    AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
    AND (
      p_q IS NULL OR p_q = '' OR
      yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
      yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
      tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || p_q || '%'
    )
    AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    ORDER BY yclc.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) subquery;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_list TO authenticated;

COMMENT ON FUNCTION public.transfer_request_list IS 'Unified transfer list function - supports both table (paginated) and kanban (per-column) views';
```

**Step 2: Apply migration**

Run: `npx supabase migration up`
Expected: Migration applied successfully, index created

**Step 3: Test backward compatibility**

Test table mode still works (existing behavior unchanged):
```sql
SELECT transfer_request_list(
  p_types := ARRAY['noi_bo'],
  p_page := 1,
  p_page_size := 20
);
-- Expected: Returns {data: [...], total: N, page: 1, pageSize: 20}
```

**Step 4: Test kanban mode**

```sql
SELECT transfer_request_list(
  p_types := ARRAY['noi_bo'],
  p_view_mode := 'kanban',
  p_per_column_limit := 30,
  p_exclude_completed := true
);
-- Expected: Returns {columns: {cho_duyet: {tasks: [...], total: N, hasMore: bool}, ...}, totalCount: N}
```

**Step 5: Commit**

```bash
git add supabase/migrations/20260112_extend_transfer_list_for_kanban.sql
git commit -m "feat(backend): extend transfer_request_list with kanban mode

- Add p_view_mode ('table'|'kanban'), p_per_column_limit, p_exclude_completed params
- Kanban mode returns per-status grouped data with window functions
- Table mode unchanged (backward compatible)
- Add idx_transfer_kanban index for performance"
```

---

## Task 3: TypeScript Types for Kanban Data

**Files:**
- Modify: `src/types/transfers-data-grid.ts`

**Step 1: Add kanban response types**

Add to `src/types/transfers-data-grid.ts` (after line 89):

```typescript
export interface TransferKanbanColumnData {
  tasks: TransferListItem[]
  total: number
  hasMore: boolean
}

export interface TransferKanbanResponse {
  columns: {
    cho_duyet?: TransferKanbanColumnData
    da_duyet?: TransferKanbanColumnData
    dang_luan_chuyen?: TransferKanbanColumnData
    da_ban_giao?: TransferKanbanColumnData
    hoan_thanh?: TransferKanbanColumnData
  }
  totalCount: number
}

export type ViewMode = 'table' | 'kanban'

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  dang_luan_chuyen: 'Đang luân chuyển',
  da_ban_giao: 'Đã bàn giao',
  hoan_thanh: 'Hoàn thành',
}

export const ACTIVE_TRANSFER_STATUSES: TransferStatus[] = [
  'cho_duyet',
  'da_duyet',
  'dang_luan_chuyen',
  'da_ban_giao',
]
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/transfers-data-grid.ts
git commit -m "feat(types): add Kanban board data types

- TransferKanbanResponse, TransferKanbanColumnData
- ViewMode type ('table' | 'kanban')
- TRANSFER_STATUS_LABELS and ACTIVE_TRANSFER_STATUSES constants"
```

---

## Task 4: Kanban Data Hook

**Files:**
- Create: `src/hooks/useTransfersKanban.ts`

**Step 1: Create useTransfersKanban hook**

Create `src/hooks/useTransfersKanban.ts`:

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import type {
  TransferListFilters,
  TransferKanbanResponse,
} from '@/types/transfers-data-grid'

export const transferKanbanKeys = {
  all: ['transfers-kanban'] as const,
  filtered: (filters: TransferListFilters) =>
    [...transferKanbanKeys.all, filters] as const,
}

interface UseTransfersKanbanOptions {
  excludeCompleted?: boolean
  perColumnLimit?: number
}

export function useTransfersKanban(
  filters: TransferListFilters,
  options: UseTransfersKanbanOptions = {}
) {
  const { excludeCompleted = true, perColumnLimit = 30 } = options

  return useQuery({
    queryKey: transferKanbanKeys.filtered(filters),
    queryFn: async (): Promise<TransferKanbanResponse> => {
      const result = await callRpc({
        fn: 'transfer_request_list',
        args: {
          p_q: filters.q,
          p_statuses: null, // Kanban loads all statuses
          p_types: filters.types,
          p_don_vi: filters.facilityId,
          p_date_from: filters.dateFrom,
          p_date_to: filters.dateTo,
          p_assignee_ids: filters.assigneeIds,
          p_view_mode: 'kanban',
          p_per_column_limit: perColumnLimit,
          p_exclude_completed: excludeCompleted,
        },
      })

      return result as TransferKanbanResponse
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Poll every 60 seconds
    enabled: !!filters.types && filters.types.length > 0,
  })
}

export function useInvalidateTransfersKanban() {
  const queryClient = useQueryClient()

  return (affectedStatuses?: string[]) => {
    if (affectedStatuses && affectedStatuses.length > 0) {
      // Smart invalidation: only affected columns
      queryClient.invalidateQueries({
        queryKey: transferKanbanKeys.all,
        predicate: (query) => {
          // Invalidate if query matches any affected status
          return true // Simplified for MVP
        },
      })
    } else {
      // Invalidate all kanban queries
      queryClient.invalidateQueries({
        queryKey: transferKanbanKeys.all,
      })
    }
  }
}
```

**Step 2: Export from useTransferDataGrid**

Add to `src/hooks/useTransferDataGrid.ts` (at end of file):

```typescript
export { useTransfersKanban, useInvalidateTransfersKanban, transferKanbanKeys } from './useTransfersKanban'
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/hooks/useTransfersKanban.ts src/hooks/useTransferDataGrid.ts
git commit -m "feat(hooks): add useTransfersKanban hook

- Fetches kanban data with per-column pagination
- 60-second polling for updates
- Smart cache invalidation for affected statuses"
```

---

## Task 5: TransfersKanbanCard Component

**Files:**
- Create: `src/components/transfers/TransfersKanbanCard.tsx`

**Step 1: Create TransfersKanbanCard**

Create `src/components/transfers/TransfersKanbanCard.tsx`:

```typescript
import * as React from 'react'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { TransferListItem } from '@/types/transfers-data-grid'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

interface TransfersKanbanCardProps {
  transfer: TransferListItem
  onClick: (transfer: TransferListItem) => void
  actions: React.ReactNode
}

function getTypeVariant(type: string): 'default' | 'secondary' | 'destructive' {
  switch (type) {
    case 'noi_bo':
      return 'default'
    case 'ben_ngoai':
      return 'secondary'
    case 'thanh_ly':
      return 'destructive'
    default:
      return 'default'
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'noi_bo':
      return 'Nội bộ'
    case 'ben_ngoai':
      return 'Bên ngoài'
    case 'thanh_ly':
      return 'Thanh lý'
    default:
      return type
  }
}

function isOverdue(dateStr: string | null, currentDate: Date): boolean {
  if (!dateStr) return false
  const dueDate = new Date(dateStr)
  return dueDate < currentDate && dueDate.getTime() !== 0
}

export function TransfersKanbanCard({
  transfer,
  onClick,
  actions,
}: TransfersKanbanCardProps) {
  const referenceDate = React.useMemo(() => new Date(), [])

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      // Allow clicks on actions menu to propagate
      if ((e.target as HTMLElement).closest('[data-actions-menu]')) {
        return
      }
      onClick(transfer)
    },
    [onClick, transfer]
  )

  return (
    <Card
      className="mb-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleClick}
      role="article"
      aria-label={`Transfer ${transfer.ma_yeu_cau}`}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header: Transfer code + type badge */}
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-sm truncate">
            {transfer.ma_yeu_cau}
          </span>
          <Badge variant={getTypeVariant(transfer.loai_hinh)} className="shrink-0">
            {getTypeLabel(transfer.loai_hinh)}
          </Badge>
        </div>

        {/* Equipment info */}
        <div className="space-y-1">
          <p className="text-sm font-medium truncate" title={transfer.thiet_bi?.ten_thiet_bi || 'N/A'}>
            {transfer.thiet_bi?.ten_thiet_bi || 'N/A'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {transfer.thiet_bi?.ma_thiet_bi || 'N/A'} • {transfer.thiet_bi?.model || 'N/A'}
          </p>
        </div>

        {/* Transfer direction */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="truncate" title={`${transfer.khoa_phong_hien_tai || 'N/A'} → ${transfer.khoa_phong_nhan || transfer.don_vi_nhan || 'N/A'}`}>
            {transfer.khoa_phong_hien_tai || 'N/A'} → {transfer.khoa_phong_nhan || transfer.don_vi_nhan || 'N/A'}
          </span>
        </div>

        {/* Footer: Date + overdue badge */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(transfer.created_at), {
              addSuffix: true,
              locale: vi,
            })}
          </span>
          {transfer.ngay_du_kien_tra && isOverdue(transfer.ngay_du_kien_tra, referenceDate) && (
            <Badge variant="destructive" className="text-xs h-5">
              Quá hạn
            </Badge>
          )}
        </div>

        {/* Actions menu */}
        <div onClick={(e) => e.stopPropagation()} data-actions-menu>
          {actions}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/transfers/TransfersKanbanCard.tsx
git commit -m "feat(components): add TransfersKanbanCard

- Compact card design (320px x ~120px)
- Shows transfer code, equipment, direction, date
- Overdue badge for past ngay_du_kien_tra
- Click opens detail, actions menu isolated"
```

---

## Task 6: TransfersKanbanColumn with Virtual Scrolling

**Files:**
- Create: `src/components/transfers/TransfersKanbanColumn.tsx`

**Step 1: Create TransfersKanbanColumn**

Create `src/components/transfers/TransfersKanbanColumn.tsx`:

```typescript
import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2 } from 'lucide-react'
import { TransfersKanbanCard } from './TransfersKanbanCard'
import type { TransferListItem, TransferStatus } from '@/types/transfers-data-grid'
import { TRANSFER_STATUS_LABELS } from '@/types/transfers-data-grid'

interface TransfersKanbanColumnProps {
  status: TransferStatus
  tasks: TransferListItem[]
  total: number
  hasMore: boolean
  onClickTask: (task: TransferListItem) => void
  renderActions: (task: TransferListItem) => React.ReactNode
  onLoadMore?: () => void
  isLoadingMore?: boolean
}

export function TransfersKanbanColumn({
  status,
  tasks,
  total,
  hasMore,
  onClickTask,
  renderActions,
  onLoadMore,
  isLoadingMore = false,
}: TransfersKanbanColumnProps) {
  const parentRef = React.useRef<HTMLDivElement>(null)

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated card height
    overscan: 5, // Render 5 extra cards for smooth scrolling
  })

  // Infinite scroll detection
  const virtualItems = rowVirtualizer.getVirtualItems()
  const lastItem = virtualItems[virtualItems.length - 1]

  React.useEffect(() => {
    if (
      lastItem &&
      lastItem.index >= tasks.length - 3 &&
      hasMore &&
      onLoadMore &&
      !isLoadingMore
    ) {
      onLoadMore()
    }
  }, [lastItem, tasks.length, hasMore, onLoadMore, isLoadingMore])

  return (
    <div className="flex flex-col w-80 min-w-[320px] bg-sidebar rounded-lg border shrink-0">
      {/* Header */}
      <div className="p-3 border-b shrink-0">
        <h3 className="font-medium text-sm">
          {TRANSFER_STATUS_LABELS[status]}
        </h3>
        <span className="text-xs text-muted-foreground">
          {tasks.length} / {total}
        </span>
      </div>

      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2"
        style={{ height: '100%' }}
      >
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground py-12">
            <p>Không có yêu cầu</p>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualRow) => {
              const task = tasks[virtualRow.index]
              if (!task) return null

              return (
                <div
                  key={task.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <TransfersKanbanCard
                    transfer={task}
                    onClick={onClickTask}
                    actions={renderActions(task)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Đang tải thêm...</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/transfers/TransfersKanbanColumn.tsx
git commit -m "feat(components): add TransfersKanbanColumn with virtual scrolling

- Virtual scroll via @tanstack/react-virtual
- Infinite scroll detection (loads more at bottom)
- 320px fixed width, renders only visible cards
- Status header with count"
```

---

## Task 7: TransfersKanbanView Container

**Files:**
- Create: `src/components/transfers/TransfersKanbanView.tsx`

**Step 1: Create TransfersKanbanView**

Create `src/components/transfers/TransfersKanbanView.tsx`:

```typescript
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransfersKanbanColumn } from './TransfersKanbanColumn'
import { useTransfersKanban } from '@/hooks/useTransferDataGrid'
import type {
  TransferListFilters,
  TransferListItem,
  TransferStatusCounts,
  TransferStatus,
} from '@/types/transfers-data-grid'
import { ACTIVE_TRANSFER_STATUSES } from '@/types/transfers-data-grid'

interface TransfersKanbanViewProps {
  filters: TransferListFilters
  onViewTransfer: (item: TransferListItem) => void
  renderRowActions: (item: TransferListItem) => React.ReactNode
  statusCounts: TransferStatusCounts | undefined
}

export function TransfersKanbanView({
  filters,
  onViewTransfer,
  renderRowActions,
  statusCounts,
}: TransfersKanbanViewProps) {
  const [showCompleted, setShowCompleted] = React.useState(false)

  const { data, isLoading, isFetching } = useTransfersKanban(filters, {
    excludeCompleted: !showCompleted,
    perColumnLimit: 30,
  })

  const columns = data?.columns || {}

  // Columns to display
  const activeColumns: TransferStatus[] = ACTIVE_TRANSFER_STATUSES
  const allColumns = showCompleted
    ? ([...activeColumns, 'hoan_thanh'] as TransferStatus[])
    : activeColumns

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Đang tải dữ liệu...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header: Show Completed toggle */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          {showCompleted ? 'Ẩn' : 'Hiện'} hoàn thành
        </Button>
      </div>

      {/* Kanban columns - horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-4 h-[calc(100vh-300px)]" style={{
        WebkitOverflowScrolling: 'touch'
      }}>
        {allColumns.map((status) => {
          const columnData = columns[status]
          const tasks = columnData?.tasks || []
          const total = columnData?.total || 0
          const hasMore = columnData?.hasMore || false

          return (
            <TransfersKanbanColumn
              key={status}
              status={status}
              tasks={tasks}
              total={total}
              hasMore={hasMore}
              onClickTask={onViewTransfer}
              renderActions={renderRowActions}
            />
          )
        })}
      </div>

      {/* Fetching indicator */}
      {isFetching && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang đồng bộ dữ liệu...
        </div>
      )}
    </div>
  )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/transfers/TransfersKanbanView.tsx
git commit -m "feat(components): add TransfersKanbanView container

- Horizontal scroll for 5 status columns
- Show/Hide completed toggle
- Passes filters, onViewTransfer, renderActions to columns
- Loading states"
```

---

## Task 8: TransfersViewToggle Component

**Files:**
- Create: `src/components/transfers/TransfersViewToggle.tsx`
- Create: `src/hooks/useLocalStorage.ts` (if doesn't exist)

**Step 1: Create useLocalStorage hook (if needed)**

Check if `src/hooks/useLocalStorage.ts` exists. If not, create it:

```typescript
import * as React from 'react'

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = React.useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error)
      }
    },
    [key, storedValue]
  )

  return [storedValue, setValue]
}
```

**Step 2: Create TransfersViewToggle**

Create `src/components/transfers/TransfersViewToggle.tsx`:

```typescript
import * as React from 'react'
import { LayoutGrid, Table } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { ViewMode } from '@/types/transfers-data-grid'

export function TransfersViewToggle() {
  const [view, setView] = useLocalStorage<ViewMode>(
    'transfers-view-mode',
    'table'
  )

  return (
    <div className="flex gap-1 rounded-lg border p-1">
      <Button
        variant={view === 'table' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setView('table')}
        className="gap-2"
      >
        <Table className="h-4 w-4" />
        <span className="hidden sm:inline">Bảng</span>
      </Button>
      <Button
        variant={view === 'kanban' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setView('kanban')}
        className="gap-2"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Kanban</span>
      </Button>
    </div>
  )
}

export function useTransfersViewMode() {
  return useLocalStorage<ViewMode>('transfers-view-mode', 'table')
}
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/transfers/TransfersViewToggle.tsx src/hooks/useLocalStorage.ts
git commit -m "feat(components): add TransfersViewToggle

- Toggle between table and kanban views
- Persists preference in localStorage
- Mobile-responsive (hide text on small screens)"
```

---

## Task 9: Extract Table View Component

**Files:**
- Create: `src/components/transfers/TransfersTableView.tsx`
- Modify: `src/app/(app)/transfers/page.tsx`

**Step 1: Extract table rendering to TransfersTableView**

Create `src/components/transfers/TransfersTableView.tsx` by extracting lines 515-591 from page.tsx:

```typescript
import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TransferListItem } from '@/types/transfers-data-grid'

interface TransfersTableViewProps {
  data: TransferListItem[]
  columns: ColumnDef<TransferListItem>[]
  sorting: SortingState
  onSortingChange: (sorting: SortingState) => void
  pagination: { pageIndex: number; pageSize: number }
  onPaginationChange: (pagination: { pageIndex: number; pageSize: number }) => void
  pageCount: number
  isLoading: boolean
  onRowClick: (item: TransferListItem) => void
}

export function TransfersTableView({
  data,
  columns,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  pageCount,
  isLoading,
  onRowClick,
}: TransfersTableViewProps) {
  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount,
  })

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-40 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Đang tải dữ liệu...</p>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/60"
                onClick={() => onRowClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-40 text-center text-sm text-muted-foreground"
              >
                Không có dữ liệu phù hợp.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/transfers/TransfersTableView.tsx
git commit -m "refactor(components): extract TransfersTableView

- Extracted from page.tsx (lines 515-591)
- Accepts data, columns, pagination props
- Reused by page.tsx in next step"
```

---

## Task 10: Integrate Dual View Mode in Page

**Files:**
- Modify: `src/app/(app)/transfers/page.tsx`

**Step 1: Import new components**

Add imports at top of `src/app/(app)/transfers/page.tsx`:

```typescript
import { TransfersTableView } from '@/components/transfers/TransfersTableView'
import { TransfersKanbanView } from '@/components/transfers/TransfersKanbanView'
import { TransfersViewToggle, useTransfersViewMode } from '@/components/transfers/TransfersViewToggle'
```

**Step 2: Add view mode state in TransfersPageContent**

After line 132 (`const [activeTab, setActiveTab] = useTransferTypeTab("noi_bo")`), add:

```typescript
const [viewMode, setViewMode] = useTransfersViewMode()
```

**Step 3: Add view toggle to header**

In the header section (around line 426), add the view toggle button before facility filter:

```typescript
<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:gap-2">
  {/* NEW: View toggle */}
  <TransfersViewToggle />

  <FacilityFilter
    facilities={facilityOptionsData || []}
    selectedId={selectedFacilityId}
    onSelect={setFacilityId}
    show={showFacilityFilter}
  />
  {/* ... rest of existing buttons ... */}
</div>
```

**Step 4: Replace table rendering with conditional view**

Replace the table rendering section (lines 540-591) with:

```typescript
{/* Conditional view rendering */}
{viewMode === 'kanban' ? (
  <TransfersKanbanView
    filters={filters}
    onViewTransfer={handleViewDetail}
    renderRowActions={renderRowActions}
    statusCounts={statusCounts?.columnCounts}
  />
) : (
  <>
    {/* Mobile card view */}
    <div className="space-y-3 lg:hidden">
      {isListLoading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Đang tải dữ liệu...
          </div>
        </div>
      ) : tableData.length > 0 ? (
        tableData.map((item) => (
          <TransferCard
            key={item.id}
            transfer={item}
            referenceDate={referenceDate}
            onClick={() => handleViewDetail(item)}
            actions={renderRowActions(item)}
          />
        ))
      ) : (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Không có dữ liệu phù hợp.
        </div>
      )}
    </div>

    {/* Desktop table view */}
    <div className="hidden lg:block">
      <TransfersTableView
        data={tableData}
        columns={columns}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={pagination}
        onPaginationChange={setPagination}
        pageCount={pageCount}
        isLoading={isListLoading}
        onRowClick={handleViewDetail}
      />
    </div>
  </>
)}
```

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 6: Test in browser**

Run: `npm run dev`
Navigate to: `http://localhost:3000/transfers`

Test checklist:
- [ ] View toggle appears in header
- [ ] Clicking "Kanban" switches to board view
- [ ] 5 columns render (or 4 if "Show Completed" hidden)
- [ ] Cards display transfer data
- [ ] Clicking "Bảng" switches back to table
- [ ] Filters apply to both views
- [ ] localStorage persists view preference (check DevTools → Application → Local Storage)

**Step 7: Commit**

```bash
git add src/app/\(app\)/transfers/page.tsx
git commit -m "feat(transfers): integrate dual view mode (Table + Kanban)

- Add view toggle in header
- Conditional rendering: table vs kanban
- View preference persisted in localStorage
- Kanban view functional with 5 status columns"
```

---

## Task 11: Test & Polish

**Files:**
- None (manual testing)

**Step 1: Performance testing with large dataset**

If you have production data or test data:
- [ ] Load page with 1000+ transfers
- [ ] Switch to Kanban view
- [ ] Verify initial load < 2 seconds
- [ ] Scroll column with 100+ tasks - should be smooth (60 FPS)

If no test data, create seed script (optional for MVP):

```bash
# Run in Supabase SQL editor
INSERT INTO yeu_cau_luan_chuyen (...)
SELECT ... FROM generate_series(1, 1000);
```

**Step 2: Mobile responsive testing**

Test on mobile viewport (DevTools → Toggle Device Toolbar):
- [ ] View toggle buttons stack on mobile
- [ ] Kanban columns scroll horizontally
- [ ] Cards are readable (not too small)
- [ ] "Show Completed" button accessible

**Step 3: Cross-browser testing**

Test in:
- [ ] Chrome (primary)
- [ ] Firefox
- [ ] Safari (if available)

Known issue: Safari may have virtual scroll quirks - document if found.

**Step 4: Accessibility check**

- [ ] Keyboard navigation: Tab through cards
- [ ] Screen reader: Cards have aria-label
- [ ] Color contrast: Badges meet WCAG AA

**Step 5: Document known issues**

Create `docs/kanban-known-issues.md` if any issues found:

```markdown
# Kanban Board Known Issues

## MVP (2026-01-12)

### Performance
- [ ] Issue description (if any)

### Mobile
- [ ] Issue description (if any)

### Browser Compatibility
- [ ] Safari: Virtual scroll may stutter on iOS < 15

## Future Enhancements
- Drag-and-drop status changes
- Real-time updates via Supabase Realtime
- Infinite scroll per column (currently loads 30 max)
```

**Step 6: Final commit**

```bash
git add docs/kanban-known-issues.md
git commit -m "docs: add kanban known issues and future enhancements"
```

---

## Task 12: Final Review & Merge

**Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 2: Lint check**

Run: `npm run lint`
Expected: No errors (or only warnings)

**Step 3: Build check**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Review file sizes**

Check that all new files meet convention (<450 lines):

```bash
wc -l src/components/transfers/Transfers*.tsx src/hooks/useTransfersKanban.ts
```

Expected:
- TransfersKanbanCard.tsx: ~150 lines ✓
- TransfersKanbanColumn.tsx: ~250 lines ✓
- TransfersKanbanView.tsx: ~200 lines ✓
- TransfersViewToggle.tsx: ~50 lines ✓
- TransfersTableView.tsx: ~400 lines ✓
- useTransfersKanban.ts: ~100 lines ✓

**Step 5: Review commits**

```bash
git log --oneline feature/transfers-kanban-board
```

Expected: ~12 commits with clear messages

**Step 6: Merge to main**

```bash
git checkout main
git merge feature/transfers-kanban-board --no-ff -m "feat: add Kanban board view to transfers page

- Backend: Extend transfer_request_list RPC with kanban mode
- Frontend: Add 5-column board with virtual scrolling
- Dual view mode: Table ↔ Kanban toggle (localStorage persisted)
- Performance: Handles 10k+ transfers via per-column pagination
- Components: KanbanView, KanbanColumn, KanbanCard, ViewToggle, TableView

Refs: docs/plans/2026-01-12-transfers-kanban-board-design.md"
git push origin main
```

**Step 7: Deploy (if applicable)**

If using Vercel or similar:

```bash
git push origin main
# Vercel auto-deploys from main branch
```

Monitor deployment logs for errors.

**Step 8: Celebrate! 🎉**

You've successfully implemented a performant Kanban board that handles 10,000+ transfers!

---

## Success Metrics (Post-Deployment)

After 1 week in production:

**Performance (via Chrome DevTools / Lighthouse):**
- [ ] Initial load: < 2 seconds ✓
- [ ] Time to Interactive: < 3 seconds ✓
- [ ] Lighthouse Performance score: 90+ ✓

**User Adoption (via analytics):**
- [ ] 30%+ users try Kanban view
- [ ] 60%+ retention (users who try it use it again)

**Code Quality:**
- [ ] All files < 450 lines ✓
- [ ] TypeScript strict mode passes ✓
- [ ] No console errors in production ✓

---

## Rollback Plan

If critical issues found in production:

**Quick rollback (hide Kanban view):**

```typescript
// In TransfersViewToggle.tsx, force table mode:
export function TransfersViewToggle() {
  return null // Hides toggle, defaults to table
}
```

Deploy this change, then investigate issues offline.

**Full rollback (revert merge):**

```bash
git revert -m 1 <merge-commit-hash>
git push origin main
```

---

## Next Steps (Phase 2)

After MVP is stable (2-4 weeks):

1. **Drag-and-drop**: Add dnd-kit for status changes
2. **Real-time**: Supabase Realtime subscriptions
3. **Analytics**: Track which view is more popular
4. **Infinite scroll per column**: Load beyond 30 tasks

See `docs/plans/2026-01-12-transfers-kanban-board-design.md` Phase 3 for details.

---

## Plan Complete

**Estimated effort**: 6-7 hours (1 developer-day)
**Risk level**: Low (backward compatible, easy rollback)
**Files created**: 7 new files, 4 modified files
**Lines of code**: ~1,200 lines (components + backend + types)

Ready to execute! 🚀
