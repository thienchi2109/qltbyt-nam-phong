# Fix: Transfer History Logging Issue

## Problem Description

The equipment history tab in the equipment detail dialog was not displaying transfer (luân chuyển) history when transfer status was marked as "Hoàn thành" (completed). Investigation revealed that while the system had comprehensive transfer history logging implemented, there was a missing field in the history insert statement.

## Root Cause Analysis

The system implements a dual-history approach:

1. **Transfer-specific history**: `lich_su_luan_chuyen` table with automatic triggers
2. **General equipment history**: `lich_su_thiet_bi` table with manual inserts

The issue was in the `handleCompleteTransfer` function in `src/app/(app)/transfers/page.tsx` where the `ngay_thuc_hien` field was missing from the history insert statement.

### Comparison

**Working example (Maintenance module):**
```javascript
const { data: historyData, error: historyError } = await supabase
    .from('lich_su_thiet_bi')
    .insert({
        thiet_bi_id: task.thiet_bi_id,
        loai_su_kien: selectedPlan.loai_cong_viec,
        mo_ta: `Hoàn thành ${selectedPlan.loai_cong_viec}...`,
        chi_tiet: { ... },
        ngay_thuc_hien: completionDate,  // ✅ PRESENT
    })
```

**Broken example (Transfer module - before fix):**
```javascript
const { error: historyError } = await supabase
    .from('lich_su_thiet_bi')
    .insert({
        thiet_bi_id: transfer.thiet_bi_id,
        loai_su_kien: loai_su_kien,
        mo_ta: mo_ta,
        chi_tiet: { ... },
        yeu_cau_id: transfer.id,
        nguoi_thuc_hien_id: user?.id
        // ❌ MISSING ngay_thuc_hien
    });
```

## Solution Implemented

### 1. Fixed Missing Field in Transfer History Insert

**File:** `src/app/(app)/transfers/page.tsx`

Added the missing `ngay_thuc_hien` field to the history insert statement:

```javascript
const { error: historyError } = await supabase
    .from('lich_su_thiet_bi')
    .insert({
        thiet_bi_id: transfer.thiet_bi_id,
        loai_su_kien: loai_su_kien,
        mo_ta: mo_ta,
        chi_tiet: {
            ma_yeu_cau: transfer.ma_yeu_cau,
            loai_hinh: transfer.loai_hinh,
            khoa_phong_hien_tai: transfer.khoa_phong_hien_tai,
            khoa_phong_nhan: transfer.khoa_phong_nhan,
            don_vi_nhan: transfer.don_vi_nhan,
        },
        yeu_cau_id: transfer.id,
        nguoi_thuc_hien_id: user?.id,
        ngay_thuc_hien: new Date().toISOString()  // ✅ ADDED
    });
```

### 2. Enhanced History Display

**File:** `src/app/(app)/equipment/page.tsx`

#### Updated Type Definition
Extended `HistoryItem` type to include transfer-specific fields:

```typescript
type HistoryItem = {
    id: number;
    ngay_thuc_hien: string;
    loai_su_kien: string;
    mo_ta: string;
    chi_tiet: {
        // Repair request fields
        mo_ta_su_co?: string;
        hang_muc_sua_chua?: string;
        nguoi_yeu_cau?: string;
        // Maintenance fields
        cong_viec_id?: number;
        thang?: number;
        ten_ke_hoach?: string;
        khoa_phong?: string;
        nam?: number;
        // Transfer fields ✅ ADDED
        ma_yeu_cau?: string;
        loai_hinh?: string;
        khoa_phong_hien_tai?: string;
        khoa_phong_nhan?: string;
        don_vi_nhan?: string;
    } | null;
};
```

#### Enhanced History Detail Display
Added transfer-specific information display:

```javascript
{/* Transfer details */}
{item.chi_tiet?.ma_yeu_cau && <p className="text-sm text-muted-foreground mt-1">Mã yêu cầu: {item.chi_tiet.ma_yeu_cau}</p>}
{item.chi_tiet?.loai_hinh && <p className="text-sm text-muted-foreground">Loại hình: {item.chi_tiet.loai_hinh === 'noi_bo' ? 'Nội bộ' : item.chi_tiet.loai_hinh === 'ben_ngoai' ? 'Bên ngoài' : 'Thanh lý'}</p>}
{item.chi_tiet?.khoa_phong_hien_tai && item.chi_tiet?.khoa_phong_nhan && (
    <p className="text-sm text-muted-foreground">Từ: {item.chi_tiet.khoa_phong_hien_tai} → {item.chi_tiet.khoa_phong_nhan}</p>
)}
{item.chi_tiet?.don_vi_nhan && <p className="text-sm text-muted-foreground">Đơn vị nhận: {item.chi_tiet.don_vi_nhan}</p>}
```

#### Improved History Icons
Enhanced `getHistoryIcon` function with specific icons for different event types:

```javascript
const getHistoryIcon = (eventType: string) => {
    switch (eventType) {
        case 'Sửa chữa':
            return <Wrench className="h-4 w-4 text-muted-foreground" />;
        case 'Bảo trì':
        case 'Bảo trì định kỳ':
        case 'Bảo trì dự phòng':
            return <Settings className="h-4 w-4 text-muted-foreground" />;
        case 'Luân chuyển':
        case 'Luân chuyển nội bộ':
        case 'Luân chuyển bên ngoài':
            return <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />; // ✅ ADDED
        case 'Hiệu chuẩn':
        case 'Kiểm định':
            return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
        case 'Thanh lý':
            return <Trash2 className="h-4 w-4 text-muted-foreground" />;
        default:
            return <Calendar className="h-4 w-4 text-muted-foreground" />;
    }
};
```

### 3. Database Performance Optimization

**File:** `supabase/migrations/20241227_optimize_lich_su_thiet_bi_indexes.sql`

Added comprehensive indexes for equipment history queries:

```sql
-- Primary composite index for equipment history queries
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_equipment_date
ON lich_su_thiet_bi (thiet_bi_id, ngay_thuc_hien DESC);

-- Event type filtering
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_loai_su_kien
ON lich_su_thiet_bi (loai_su_kien);

-- Request tracking
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_yeu_cau_id
ON lich_su_thiet_bi (yeu_cau_id)
WHERE yeu_cau_id IS NOT NULL;
```

### 4. Test Coverage

**File:** `src/app/(app)/transfers/__tests__/transfer-history.test.ts`

Added comprehensive test suite to verify:
- `ngay_thuc_hien` field is included in history inserts
- Transfer descriptions are formatted correctly
- Event types are set properly based on transfer type
- All required fields are included in `chi_tiet` object

## Testing Instructions

1. **Manual Testing:**
   - Create a new transfer request
   - Mark it as "Hoàn thành" (completed)
   - Check the equipment detail dialog → History tab
   - Verify transfer history appears with proper details

2. **Automated Testing:**
   ```bash
   npm test src/app/(app)/transfers/__tests__/transfer-history.test.ts
   ```

3. **Database Testing:**
   ```sql
   -- Check if history is being recorded
   SELECT * FROM lich_su_thiet_bi 
   WHERE loai_su_kien LIKE '%Luân chuyển%' 
   ORDER BY ngay_thuc_hien DESC;
   ```

## Impact

- ✅ Transfer history now appears in equipment history tab
- ✅ Improved user experience with detailed transfer information
- ✅ Better visual representation with appropriate icons
- ✅ Optimized database performance for history queries
- ✅ Comprehensive test coverage for future maintenance

## Files Modified

1. `src/app/(app)/transfers/page.tsx` - Fixed missing `ngay_thuc_hien` field
2. `src/app/(app)/equipment/page.tsx` - Enhanced history display and icons
3. `supabase/migrations/20241227_optimize_lich_su_thiet_bi_indexes.sql` - Database optimization
4. `src/app/(app)/transfers/__tests__/transfer-history.test.ts` - Test coverage
5. `docs/transfer-history-fix.md` - Documentation
