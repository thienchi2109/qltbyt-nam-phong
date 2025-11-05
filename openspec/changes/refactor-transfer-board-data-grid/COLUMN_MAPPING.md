# Transfer Data Grid - Column Mapping by Type

**Date**: 2025-11-04
**Purpose**: Define column configurations for tabbed data grid based on TransferCard layout
**Related**: openspec/changes/refactor-transfer-board-data-grid/

---

## Database Schema Reference

**Table**: `yeu_cau_luan_chuyen`

```sql
CREATE TABLE public.yeu_cau_luan_chuyen (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ma_yeu_cau TEXT NOT NULL,                      -- Transfer code
  thiet_bi_id BIGINT NOT NULL,                   -- Equipment FK
  loai_hinh TEXT NOT NULL,                       -- Type: noi_bo, ben_ngoai, thanh_ly
  trang_thai TEXT NOT NULL DEFAULT 'cho_duyet',  -- Status
  nguoi_yeu_cau_id BIGINT,                       -- Requester FK
  ly_do_luan_chuyen TEXT NOT NULL,               -- Reason

  -- Internal transfer fields
  khoa_phong_hien_tai TEXT,                      -- Current department
  khoa_phong_nhan TEXT,                          -- Receiving department

  -- External/Liquidation fields
  muc_dich TEXT,                                 -- Purpose (mainly liquidation)
  don_vi_nhan TEXT,                              -- Receiving entity name
  dia_chi_don_vi TEXT,                           -- Entity address
  nguoi_lien_he TEXT,                            -- Contact person
  so_dien_thoai TEXT,                            -- Contact phone

  -- Date fields
  ngay_du_kien_tra TIMESTAMPTZ,                  -- Expected return date (external)
  ngay_ban_giao TIMESTAMPTZ,                     -- Handover date (external)
  ngay_hoan_tra TIMESTAMPTZ,                     -- Actual return date (external)
  ngay_hoan_thanh TIMESTAMPTZ,                   -- Completion date (all types)
  nguoi_duyet_id BIGINT,                         -- Approver FK
  ngay_duyet TIMESTAMPTZ,                        -- Approval date
  ghi_chu_duyet TEXT,                            -- Approval notes

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT,
  updated_by BIGINT
);
```

**Equipment Join**: `thiet_bi` table provides `ma_thiet_bi`, `ten_thiet_bi`, `don_vi` (facility).

---

## Transfer Types

| Type | Value | Vietnamese Label | Badge Color |
|------|-------|------------------|-------------|
| Internal | `noi_bo` | Nội bộ | default (blue) |
| External | `ben_ngoai` | Bên ngoài | secondary (gray) |
| Liquidation | `thanh_ly` | Thanh lý | destructive (red) |

---

## Transfer Statuses

| Status | Vietnamese Label | Description |
|--------|------------------|-------------|
| `cho_duyet` | Chờ duyệt | Pending approval |
| `da_duyet` | Đã duyệt | Approved |
| `dang_luan_chuyen` | Đang luân chuyển | In progress |
| `da_ban_giao` | Đã bàn giao | Handed over (external only) |
| `hoan_thanh` | Hoàn thành | Completed |

---

## Column Definitions

### Common Columns (All Types)

These columns appear in ALL three tabs:

| Column | Field | Width | Sortable | Notes |
|--------|-------|-------|----------|-------|
| Transfer Code | `ma_yeu_cau` | 150px | Yes | Primary identifier |
| Equipment | `thiet_bi.ma_thiet_bi` + `thiet_bi.ten_thiet_bi` | 300px | Yes | Format: "CODE - NAME" |
| Status | `trang_thai` | 150px | Yes | Badge with color coding |
| Reason | `ly_do_luan_chuyen` | 250px | No | Truncate with ellipsis (line-clamp-2) |
| Created Date | `created_at` | 120px | Yes | Format: `dd/MM/yyyy` (vi-VN) |
| Actions | - | 150px | No | Buttons: View, Approve, Edit, Delete |

---

### Tab 1: Internal Transfers (`noi_bo`)

**Additional Columns**:

| Column | Field | Width | Sortable | Notes |
|--------|-------|-------|----------|-------|
| From Department | `khoa_phong_hien_tai` | 150px | No | Current location |
| To Department | `khoa_phong_nhan` | 150px | No | Destination |
| Receiving Facility | `don_vi_nhan` | 150px | No | If inter-facility transfer |

**Column Order**:
1. Transfer Code
2. Equipment
3. From Department
4. To Department
5. Receiving Facility
6. Reason
7. Status
8. Created Date
9. Actions

**TransferCard Mobile Layout**:
```
┌────────────────────────────────────┐
│ YC-2025-001  [Nội bộ badge]       │
│                                    │
│ Thiết bị: TB-001 - Máy XN         │
│ Từ → Đến: Khoa A → Khoa B         │
│ Lý do: Thiếu thiết bị...           │
│                                    │
│ 01/11/2025        [Actions]        │
└────────────────────────────────────┘
```

---

### Tab 2: External Transfers (`ben_ngoai`)

**Additional Columns**:

| Column | Field | Width | Sortable | Notes |
|--------|-------|-------|----------|-------|
| Receiving Entity | `don_vi_nhan` | 180px | No | External organization name |
| Contact Person | `nguoi_lien_he` | 150px | No | External contact |
| Phone | `so_dien_thoai` | 120px | No | Contact phone |
| Expected Return | `ngay_du_kien_tra` | 130px | Yes | With overdue indicator if past date and status is `da_ban_giao` or `dang_luan_chuyen` |
| Handover Date | `ngay_ban_giao` | 130px | Yes | Actual handover date |
| Return Date | `ngay_hoan_tra` | 130px | Yes | Actual return date |

**Column Order**:
1. Transfer Code
2. Equipment
3. Receiving Entity
4. Contact Person
5. Phone
6. Expected Return
7. Handover Date
8. Return Date
9. Reason
10. Status
11. Created Date
12. Actions

**Overdue Logic**:
```typescript
const isOverdue =
  transfer.ngay_du_kien_tra &&
  (transfer.trang_thai === 'da_ban_giao' || transfer.trang_thai === 'dang_luan_chuyen') &&
  new Date(transfer.ngay_du_kien_tra) < new Date()
```

**TransferCard Mobile Layout**:
```
┌────────────────────────────────────┐
│ YC-2025-002  [Bên ngoài badge]    │
│                                    │
│ Thiết bị: TB-002 - Máy siêu âm    │
│ Đơn vị nhận: Bệnh viện X          │
│ Dự kiến hoàn trả: 15/11/2025      │
│                   [Quá hạn badge] │
│ Lý do: Hỗ trợ...                  │
│                                    │
│ 01/11/2025        [Actions]        │
└────────────────────────────────────┘
```

---

### Tab 3: Liquidation (`thanh_ly`)

**Additional Columns**:

| Column | Field | Width | Sortable | Notes |
|--------|-------|-------|----------|-------|
| Purpose | `muc_dich` | 200px | No | Liquidation purpose/reason |
| Receiving Entity | `don_vi_nhan` | 180px | No | Entity receiving liquidated equipment |
| Contact Person | `nguoi_lien_he` | 150px | No | Contact at receiving entity |
| Completion Date | `ngay_hoan_thanh` | 130px | Yes | Date liquidation completed |

**Column Order**:
1. Transfer Code
2. Equipment
3. Purpose
4. Receiving Entity
5. Contact Person
6. Reason
7. Status
8. Completion Date
9. Created Date
10. Actions

**TransferCard Mobile Layout**:
```
┌────────────────────────────────────┐
│ YC-2025-003  [Thanh lý badge]     │
│                                    │
│ Thiết bị: TB-003 - Máy XN cũ     │
│ Đơn vị nhận: Trung tâm Y          │
│ Mục đích: Hỏng không sửa được     │
│ Lý do: Hết tuổi thọ...            │
│                                    │
│ 01/11/2025        [Actions]        │
└────────────────────────────────────┘
```

---

## Status Badge Configuration

**Above each tab's table**, display 5 status badges with counts filtered by active tab type:

```typescript
const STATUS_CONFIG = {
  cho_duyet: {
    label: 'Chờ duyệt',
    color: 'bg-yellow-100 text-yellow-800',
    hoverColor: 'hover:bg-yellow-200'
  },
  da_duyet: {
    label: 'Đã duyệt',
    color: 'bg-blue-100 text-blue-800',
    hoverColor: 'hover:bg-blue-200'
  },
  dang_luan_chuyen: {
    label: 'Đang luân chuyển',
    color: 'bg-purple-100 text-purple-800',
    hoverColor: 'hover:bg-purple-200'
  },
  da_ban_giao: {
    label: 'Đã bàn giao',
    color: 'bg-indigo-100 text-indigo-800',
    hoverColor: 'hover:bg-indigo-200'
  },
  hoan_thanh: {
    label: 'Hoàn thành',
    color: 'bg-green-100 text-green-800',
    hoverColor: 'hover:bg-green-200'
  }
}
```

**Badge Click Behavior**: Clicking a badge toggles that status in the status filter.

---

## Actions Column Configuration

**Role-Based Button Visibility**:

| Action | Roles | Conditions |
|--------|-------|------------|
| View | All | Always visible |
| Approve | `global`, `to_qltb` | Only if status = `cho_duyet` |
| Edit | `global`, `to_qltb` | Only if status = `cho_duyet` or `da_duyet` |
| Delete | `global`, `to_qltb` | Only if status = `cho_duyet` |

**Button Styling**:
- View: Ghost button, default color
- Approve: Default button, primary color
- Edit: Ghost button, default color
- Delete: Ghost button, destructive color

**IMPORTANT**: All action buttons must use `onClick={(e) => e.stopPropagation()}` to prevent row click from firing.

---

## Tab Badge Counts

**Tab labels with total counts per type**:

```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="noi_bo">
      Nội bộ <Badge variant="secondary">{internalCount}</Badge>
    </TabsTrigger>
    <TabsTrigger value="ben_ngoai">
      Bên ngoài <Badge variant="secondary">{externalCount}</Badge>
    </TabsTrigger>
    <TabsTrigger value="thanh_ly">
      Thanh lý <Badge variant="secondary">{liquidationCount}</Badge>
    </TabsTrigger>
  </TabsList>
</Tabs>
```

**Data Source**: Call `/api/transfers/counts` **without** type filter to get total counts across all types, then sum per type from returned status counts.

---

## URL State Management

**Query Parameter**: `?tab=noi_bo|ben_ngoai|thanh_ly`

```typescript
// Read from URL
const searchParams = useSearchParams()
const activeTab = searchParams.get('tab') || 'noi_bo'

// Update URL on tab change
const router = useRouter()
const pathname = usePathname()

const handleTabChange = (newTab: string) => {
  const params = new URLSearchParams(searchParams.toString())
  params.set('tab', newTab)
  router.push(`${pathname}?${params.toString()}`)
}
```

---

## TanStack Table Integration

**Column Visibility Pattern**:

```typescript
// Define all possible columns
const allColumns = {
  common: [...],
  internal: [...],
  external: [...],
  liquidation: [...]
}

// Select columns based on active tab
const visibleColumns = useMemo(() => {
  switch (activeTab) {
    case 'noi_bo':
      return [...allColumns.common, ...allColumns.internal]
    case 'ben_ngoai':
      return [...allColumns.common, ...allColumns.external]
    case 'thanh_ly':
      return [...allColumns.common, ...allColumns.liquidation]
    default:
      return allColumns.common
  }
}, [activeTab])

// Pass to TanStack Table
const table = useReactTable({
  data,
  columns: visibleColumns,
  // ... other config
})
```

---

## Responsive Breakpoint

**Breakpoint**: `md` (768px)

```tsx
<div>
  {/* Desktop: Table */}
  <div className="hidden md:block">
    <DataTable />
  </div>

  {/* Mobile: Cards */}
  <div className="md:hidden">
    {transfers.map(transfer => (
      <TransferCard key={transfer.id} transfer={transfer} type={activeTab} />
    ))}
  </div>
</div>
```

---

## Filter Interactions

**Filters apply within active tab**:

1. **Facility Filter**: Filters `thiet_bi.don_vi` (global/regional users only)
2. **Status Filter**: Multi-select from 5 statuses
3. **Date Range**: `created_at` between `dateFrom` and `dateTo`
4. **Search**: Full-text search in `ma_yeu_cau`, `ly_do_luan_chuyen`, `thiet_bi.ma_thiet_bi`, `thiet_bi.ten_thiet_bi`

**Clear Filters**: Resets all filters EXCEPT active tab.

---

## Implementation Checklist

- [ ] Create `src/components/transfers/columnDefinitions.ts` with column configs per type
- [ ] Create `src/components/transfers/TransferStatusBadges.tsx` for type-specific badges
- [ ] Create `src/components/transfers/TransferTabs.tsx` for tab navigation
- [ ] Update `src/components/transfers/TransferCard.tsx` to accept `type` prop for mobile layout
- [ ] Implement URL-based tab state in `src/app/(app)/transfers/page.tsx`
- [ ] Wire tab selection to `loai_hinh` filter parameter in API calls
- [ ] Implement dynamic column rendering based on active tab
- [ ] Test all 3 tabs with different data
- [ ] Verify mobile card layouts per tab
- [ ] Verify overdue indicator on external tab

---

## Performance Considerations

**Query Keys per Tab**:
```typescript
const transferKeys = {
  list: (tab: string, filters: TransferFilters) =>
    ['transfers', 'list', tab, filters] as const,
  counts: (tab: string, filters: Omit<TransferFilters, 'statuses'>) =>
    ['transfers', 'counts', tab, filters] as const,
}
```

This ensures:
- Separate cache per tab
- Switching tabs doesn't invalidate other tabs' data
- Filters within tab update cache correctly

---

## Summary

✅ **3 tabs** with type-specific columns
✅ **5 status badges** per tab (type-filtered counts)
✅ **URL-based tab state** for shareable links
✅ **Mobile card view** with type-relevant fields
✅ **Dynamic column rendering** via TanStack Table
✅ **Responsive at 768px** (md breakpoint)

**Next**: Start Task 4 implementation
