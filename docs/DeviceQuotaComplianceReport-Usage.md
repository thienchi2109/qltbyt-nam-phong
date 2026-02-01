# DeviceQuotaComplianceReport - Usage Guide

## Overview

The `DeviceQuotaComplianceReport` component renders a Vietnamese government-compliant compliance report for medical equipment quotas following Vietnamese document formatting standards (Thông tư 08/2019/TT-BYT).

**File:** `D:\qltbyt-nam-phong\src\app\(app)\device-quota\dashboard\_components\DeviceQuotaComplianceReport.tsx`

## Features

- ✅ Print-optimized A4 layout with proper margins
- ✅ Vietnamese government document header format
- ✅ Vietnamese locale date formatting (via date-fns/locale/vi)
- ✅ Responsive table with compliance status color-coding
- ✅ Print-friendly black/white styling (colors hidden in print)
- ✅ Summary statistics (dat/thieu/vuot counts)
- ✅ Signature blocks for approval
- ✅ TanStack Query for data fetching with caching
- ✅ Proper error and loading states
- ✅ RPC security (tenant isolation via JWT claims)

## Props

```typescript
interface DeviceQuotaComplianceReportProps {
  decisionId: number        // ID of quota decision
  facilityName: string      // Facility name (e.g., "Bệnh viện Đa khoa Trung ương")
  decisionNumber: string    // Decision document number (e.g., "123/QĐ-BYT")
}
```

## Basic Usage

### Example 1: Standalone Report Page

```tsx
// src/app/(app)/device-quota/reports/[id]/page.tsx
"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { DeviceQuotaComplianceReport } from "../../dashboard/_components/DeviceQuotaComplianceReport"
import { Skeleton } from "@/components/ui/skeleton"

export default function ComplianceReportPage() {
  const params = useParams()
  const decisionId = parseInt(params.id as string, 10)

  // Fetch decision details
  const { data: decision, isLoading } = useQuery({
    queryKey: ["decision", decisionId],
    queryFn: async () => {
      const result = await callRpc({
        fn: "dinh_muc_decision_by_id",
        args: { p_decision_id: decisionId },
      })
      return result?.[0]
    },
    enabled: !!decisionId,
  })

  if (isLoading) {
    return <Skeleton className="h-screen" />
  }

  if (!decision) {
    return <div>Không tìm thấy quyết định</div>
  }

  return (
    <DeviceQuotaComplianceReport
      decisionId={decisionId}
      facilityName={decision.facility_name}
      decisionNumber={decision.so_quyet_dinh}
    />
  )
}
```

### Example 2: Add Report Link to Dashboard

Update the active decision card to include a link to the report:

```tsx
// src/app/(app)/device-quota/dashboard/_components/DeviceQuotaActiveDecision.tsx

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"

// Inside the component render:
<CardFooter>
  <Link href={`/device-quota/reports/${decisionId}`} passHref>
    <Button variant="outline" className="w-full">
      <FileText className="mr-2 h-4 w-4" />
      Xem báo cáo tuân thủ
    </Button>
  </Link>
</CardFooter>
```

### Example 3: Modal/Dialog Integration

```tsx
// src/app/(app)/device-quota/dashboard/_components/DeviceQuotaReportDialog.tsx
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DeviceQuotaComplianceReport } from "./DeviceQuotaComplianceReport"

interface DeviceQuotaReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  decisionId: number
  facilityName: string
  decisionNumber: string
}

export function DeviceQuotaReportDialog({
  open,
  onOpenChange,
  decisionId,
  facilityName,
  decisionNumber,
}: DeviceQuotaReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Báo cáo tuân thủ định mức</DialogTitle>
        </DialogHeader>
        <DeviceQuotaComplianceReport
          decisionId={decisionId}
          facilityName={facilityName}
          decisionNumber={decisionNumber}
        />
      </DialogContent>
    </Dialog>
  )
}
```

## Data Flow

```
Component → useQuery → callRpc → /api/rpc/[fn] → Supabase RPC → PostgreSQL

Security:
1. NextAuth session validated in /api/rpc/[fn]
2. JWT claims signed with tenant info
3. RPC function enforces tenant isolation
4. Non-global users CANNOT access other tenants' data
```

## RPC Function

The component uses `dinh_muc_compliance_detail` RPC:

```sql
-- Returns per-category compliance status
-- Automatically enforces tenant isolation via JWT claims
-- If p_quyet_dinh_id is NULL, uses active decision for tenant

SELECT * FROM dinh_muc_compliance_detail(
  p_quyet_dinh_id := 123,  -- Decision ID (or NULL for active)
  p_don_vi := NULL         -- Tenant ID (enforced by RPC)
);
```

**Returned columns:**
- `quyet_dinh_id`: Decision ID
- `nhom_thiet_bi_id`: Category ID
- `ma_nhom`: Category code
- `ten_nhom`: Category name
- `phan_loai`: Classification (I, II, III, IV)
- `so_luong_toi_thieu`: Minimum quota
- `so_luong_toi_da`: Maximum quota
- `so_luong_hien_co`: Current equipment count
- `trang_thai_tuan_thu`: Compliance status ('dat' | 'thieu' | 'vuot')
- `chenh_lech`: Difference from acceptable range

## Print Behavior

### Print Button

The component includes a print button that:
1. Triggers `window.print()`
2. Shows loading state during print dialog
3. Hides itself during print (`print:hidden` class)

### Print Styles

The component uses:
- **@media print** CSS for A4 portrait layout
- **@page** directive for 15mm margins
- **Black borders** for table (colors removed)
- **Page break control** to avoid breaking table rows
- **Font size optimization** (12pt for readability)

### Print-Specific Classes

```tsx
// Hidden in print
className="print:hidden"

// Black text in print (colored on screen)
className="text-green-700 print:text-black"

// Background preserved in print
className="bg-gray-100 print:bg-gray-100"
```

## Accessibility

- ✅ Semantic HTML table structure
- ✅ Proper heading hierarchy (h1 for title)
- ✅ ARIA labels on button
- ✅ Color contrast meets WCAG AA (screen view)
- ✅ Print-friendly (no color dependence)
- ✅ Keyboard navigation supported

## Performance Considerations

1. **Query Caching**: 60-second stale time to reduce RPC calls
2. **Memoized Summary**: Summary statistics computed with `useMemo`
3. **Print Optimization**: No re-renders during print dialog
4. **Conditional Rendering**: Loading/error states prevent unnecessary renders

## Testing

### Manual Test Checklist

- [ ] Report loads with correct data
- [ ] Print preview shows A4 layout
- [ ] Colors visible on screen, black/white in print
- [ ] Table borders render correctly
- [ ] Signature blocks positioned properly
- [ ] Summary statistics match table data
- [ ] Error state shows when RPC fails
- [ ] Loading skeleton renders during fetch
- [ ] Date formatted in Vietnamese locale

### Browser Compatibility

Tested on:
- Chrome/Edge (Chromium): ✅
- Firefox: ✅
- Safari: ⚠️ (Check @page margins)

## Troubleshooting

### Issue: Report shows no data

**Solution:** Verify decision ID exists and user has access to tenant:
```sql
SELECT * FROM quyet_dinh_dinh_muc WHERE id = <decisionId>;
```

### Issue: Print layout broken

**Solution:** Check browser print settings:
- Paper size: A4
- Margins: Default
- Scale: 100%
- Background graphics: Enabled (for table backgrounds)

### Issue: Colors don't hide in print

**Solution:** Ensure browser supports print media queries. Use "Print preview" to verify.

### Issue: RPC permission denied

**Solution:** User's JWT claims may not include correct tenant. Check:
```typescript
const session = await getServerSession(authOptions)
console.log(session?.user) // Verify don_vi matches decision's don_vi_id
```

## Related Files

- **RPC Migration:** `D:\qltbyt-nam-phong\supabase\migrations\20260201_device_quota_rpc_compliance.sql`
- **RPC Client:** `D:\qltbyt-nam-phong\src\lib\rpc-client.ts`
- **Dashboard Context:** `D:\qltbyt-nam-phong\src\app\(app)\device-quota\dashboard\_components\DeviceQuotaDashboardContext.tsx`

## Future Enhancements

- [ ] PDF export (using jsPDF or Puppeteer server-side)
- [ ] Email report functionality
- [ ] Historical comparison (multiple decisions)
- [ ] Chart/graph visualizations (Recharts)
- [ ] Export to Excel (ExcelJS)
- [ ] QR code with report verification link

---

**References:**
- Vietnamese Document Standards: Thông tư 08/2019/TT-BYT
- Date-fns Vietnamese locale: `date-fns/locale/vi`
- Print CSS: MDN Web Docs - @media print
