# Device Quota Compliance Dashboard - Frontend Design Review

**Date**: 2026-01-31
**Reviewer**: Claude Code (Frontend Specialist)
**Focus**: Compliance Dashboard UI/UX Design for Device Quota Feature

---

## Executive Summary

This document provides a comprehensive frontend design review for the **Device Quota Compliance Dashboard**, which visualizes actual equipment inventory against approved quota limits with three status indicators:

- **Đạt** (Compliant) - Green - Actual within quota range
- **Thiếu** (Below) - Amber - Actual < minimum required
- **Vượt** (Over) - Red - Actual > maximum quota (cannot procure more)

**Key Recommendations**:
1. Use existing `DynamicPieChart` and `DynamicBarChart` components from recharts
2. Follow established KPI card pattern from dashboard
3. Implement color-blind friendly status indicators (icons + colors)
4. Add PDF/Excel export for Ministry portal submission
5. Use TanStack Query with optimistic updates for real-time compliance

---

## 1. Existing Dashboard Patterns Analysis

### 1.1 Discovered Design System

**Component Library**: Radix UI + Tailwind CSS
**Charting**: Recharts (with dynamic loading via `DynamicChart` wrapper)
**Data Fetching**: TanStack Query v5
**Icons**: Lucide React

**Established Patterns**:

| Pattern | Example File | Notes |
|---------|-------------|-------|
| KPI Cards | `components/dashboard/kpi-cards.tsx` | Mobile-first, shadow-elevated cards |
| Summary Stats | `components/equipment-distribution-summary.tsx` | 4-column grid with health score |
| Dynamic Charts | `components/dynamic-chart.tsx` | Lazy-loaded recharts with fallbacks |
| Status Badges | `components/ui/badge.tsx` | Variants: default, secondary, destructive, outline |

### 1.2 Color Scheme Analysis

**Current Status Colors** (from `equipment-distribution-summary.tsx`):
- Green (#10b981) - Active/Healthy
- Red (#ef4444) - Critical/Repair
- Amber (#f59e0b) - Warning/Maintenance
- Purple (#8b5cf6) - Calibration
- Gray (#6b7280) - Inactive

**Recommended Compliance Colors**:
```typescript
const COMPLIANCE_COLORS = {
  dat: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    chart: '#10b981', // emerald-500
    icon: CheckCircle
  },
  thieu: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    chart: '#f59e0b', // amber-500
    icon: AlertTriangle
  },
  vuot: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    chart: '#ef4444', // red-500
    icon: XCircle
  }
}
```

---

## 2. Component Architecture Recommendation

### 2.1 File Structure (Following RepairRequests Pattern)

```
src/app/(app)/device-quota/
├── _components/
│   ├── DeviceQuotaContext.tsx              # State management
│   ├── DeviceQuotaPageClient.tsx           # Smart container
│   ├── ComplianceDashboard.tsx             # Main dashboard (THIS REVIEW)
│   ├── ComplianceSummaryCards.tsx          # Summary KPI cards
│   ├── ComplianceStatusChart.tsx           # Pie/Donut chart
│   ├── ComplianceDetailTable.tsx           # Detailed table
│   ├── QuotaDecisionSelector.tsx           # Select active decision
│   ├── ExportComplianceDialog.tsx          # PDF/Excel export
│   └── QuotaDecision*.tsx                  # Other dialogs
├── _hooks/
│   └── useDeviceQuotaContext.ts
├── types.ts
└── page.tsx
```

### 2.2 Context-Driven Architecture

```typescript
// DeviceQuotaContext.tsx
interface DeviceQuotaContextValue {
  // State
  activeDecision: QuyetDinhDinhMuc | null
  complianceData: ComplianceReport | null

  // Queries
  decisionsQuery: UseQueryResult<QuyetDinhDinhMuc[]>
  complianceQuery: UseQueryResult<ComplianceReport>

  // Mutations
  activateMutation: UseMutationResult<...>
  publishMutation: UseMutationResult<...>

  // Actions
  openExportDialog: () => void
  refreshCompliance: () => void
  selectDecision: (id: number) => void
}
```

**Why**: Follows existing `RepairRequestsContext` pattern, avoids prop drilling, centralizes data fetching.

---

## 3. Compliance Dashboard Component Design

### 3.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  [Quota Decision Selector]  [Active: 15/QĐ-BVBM]  [Export]      │ <- Header
└─────────────────────────────────────────────────────────────────┘

┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Đạt        │  Thiếu      │  Vượt       │  Tổng       │ <- Summary Cards
│  15 items   │  3 items    │  2 items    │  20 items   │
└─────────────┴─────────────┴─────────────┴─────────────┘

┌───────────────────────────────────────────────────────────┐
│         Compliance Overview (Pie Chart)                    │ <- Visualization
│    ╱────╲     Đạt: 75% (15 categories)                    │
│   │  Đạt │    Thiếu: 15% (3 categories)                   │
│   │      │    Vượt: 10% (2 categories)                    │
│    ╲────╱                                                  │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│  Detailed Compliance Table                                │ <- Table
│  ┌────────────────┬──────┬─────────┬────────┬─────────┐   │
│  │ Equipment      │ Quota│ Minimum │ Actual │ Status  │   │
│  ├────────────────┼──────┼─────────┼────────┼─────────┤   │
│  │ CT Scanner     │  2   │   1     │   2    │  Đạt    │   │
│  │ MRI System     │  1   │   1     │   0    │  Thiếu  │   │
│  │ Ventilator     │ 12   │   8     │  15    │  Vượt   │   │
│  └────────────────┴──────┴─────────┴────────┴─────────┘   │
│  [Filter: All | Đạt | Thiếu | Vượt]  [Search]             │
└───────────────────────────────────────────────────────────┘
```

### 3.2 Implementation: Summary Cards

**Pattern**: Follow `KPICards` component from existing dashboard

```typescript
// ComplianceSummaryCards.tsx
export function ComplianceSummaryCards() {
  const { complianceData } = useDeviceQuotaContext()
  const summary = complianceData?.summary

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 md:gap-6">
      {/* Compliant (Đạt) */}
      <Card className="mobile-kpi-card bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
          <CardTitle className="text-sm font-semibold text-slate-600">
            Đạt định mức
          </CardTitle>
          <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          <div className="text-4xl font-bold text-green-600">
            {summary?.dat ?? 0}
          </div>
          <p className="text-sm text-neutral-500">
            Danh mục đạt yêu cầu
          </p>
        </CardContent>
      </Card>

      {/* Below Minimum (Thiếu) */}
      <Card className="mobile-kpi-card bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
          <CardTitle className="text-sm font-semibold text-slate-600">
            Thiếu
          </CardTitle>
          <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          <div className="text-4xl font-bold text-amber-600">
            {summary?.thieu ?? 0}
          </div>
          <p className="text-sm text-neutral-500">
            Cần bổ sung thiết bị
          </p>
        </CardContent>
      </Card>

      {/* Over Quota (Vượt) */}
      <Card className="mobile-kpi-card bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
          <CardTitle className="text-sm font-semibold text-slate-600">
            Vượt định mức
          </CardTitle>
          <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          <div className="text-4xl font-bold text-red-600">
            {summary?.vuot ?? 0}
          </div>
          <p className="text-sm text-neutral-500">
            Không được mua thêm
          </p>
        </CardContent>
      </Card>

      {/* Total Categories */}
      <Card className="mobile-kpi-card bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
          <CardTitle className="text-sm font-semibold text-slate-600">
            Tổng danh mục
          </CardTitle>
          <Package className="h-5 w-5 text-blue-600" aria-hidden="true" />
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
          <div className="text-4xl font-bold text-blue-600">
            {summary?.total_categories ?? 0}
          </div>
          <p className="text-sm text-neutral-500">
            Trong quyết định hiện hành
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 3.3 Implementation: Status Chart

**Chart Type**: Donut Chart (Pie with inner radius) for visual appeal

```typescript
// ComplianceStatusChart.tsx
import { DynamicPieChart } from '@/components/dynamic-chart'

export function ComplianceStatusChart() {
  const { complianceData } = useDeviceQuotaContext()
  const summary = complianceData?.summary

  const chartData = [
    { name: 'Đạt', value: summary?.dat ?? 0, color: '#10b981' },
    { name: 'Thiếu', value: summary?.thieu ?? 0, color: '#f59e0b' },
    { name: 'Vượt', value: summary?.vuot ?? 0, color: '#ef4444' },
  ].filter(item => item.value > 0) // Hide zero values

  if (!chartData.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-80 text-muted-foreground">
          Không có dữ liệu tuân thủ
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tổng quan tuân thủ định mức</CardTitle>
        <CardDescription>
          Phân bố trạng thái {summary?.total_categories ?? 0} danh mục thiết bị
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DynamicPieChart
          data={chartData}
          height={400}
          dataKey="value"
          nameKey="name"
          colors={chartData.map(d => d.color)}
          innerRadius={60} // Donut chart
          showLabels={true}
          showTooltip={true}
        />

        {/* Legend with icons */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {chartData.map(item => (
            <div key={item.name} className="flex items-center gap-3 p-3 border rounded-lg">
              {item.name === 'Đạt' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {item.name === 'Thiếu' && <AlertTriangle className="h-5 w-5 text-amber-600" />}
              {item.name === 'Vượt' && <XCircle className="h-5 w-5 text-red-600" />}
              <div className="flex-1">
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {item.value} danh mục ({Math.round((item.value / (summary?.total_categories ?? 1)) * 100)}%)
                </div>
              </div>
              <div className="text-2xl font-bold" style={{ color: item.color }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 3.4 Implementation: Detailed Table

**Pattern**: Use TanStack Table (already in use) with filtering and sorting

```typescript
// ComplianceDetailTable.tsx
import { useState, useMemo } from 'react'
import { flexRender, getCoreRowModel, useReactTable, getSortedRowModel, getFilteredRowModel } from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle, XCircle, ArrowUpDown } from 'lucide-react'

export function ComplianceDetailTable() {
  const { complianceData } = useDeviceQuotaContext()
  const [statusFilter, setStatusFilter] = useState<'all' | 'dat' | 'thieu' | 'vuot'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const columns = useMemo(() => [
    {
      accessorKey: 'ten_nhom',
      header: ({ column }) => (
        <button
          className="flex items-center gap-2"
          onClick={() => column.toggleSorting()}
        >
          Thiết bị
          <ArrowUpDown className="h-4 w-4" />
        </button>
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.ten_nhom}</div>
          <div className="text-xs text-muted-foreground">{row.original.phan_loai}</div>
        </div>
      ),
    },
    {
      accessorKey: 'quota',
      header: 'Định mức tối đa',
      cell: ({ row }) => (
        <div className="text-center font-semibold">{row.original.quota}</div>
      ),
    },
    {
      accessorKey: 'minimum',
      header: 'Tối thiểu',
      cell: ({ row }) => (
        <div className="text-center text-muted-foreground">
          {row.original.minimum ?? 'N/A'}
        </div>
      ),
    },
    {
      accessorKey: 'actual_count',
      header: 'Thực tế',
      cell: ({ row }) => (
        <div className="text-center font-bold text-lg">
          {row.original.actual_count}
        </div>
      ),
    },
    {
      accessorKey: 'trang_thai_tuan_thu',
      header: 'Trạng thái',
      cell: ({ row }) => {
        const status = row.original.trang_thai_tuan_thu
        return (
          <div className="flex items-center gap-2 justify-center">
            {status === 'dat' && (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <Badge className="bg-green-100 text-green-700">Đạt</Badge>
              </>
            )}
            {status === 'thieu' && (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <Badge className="bg-amber-100 text-amber-700">Thiếu</Badge>
              </>
            )}
            {status === 'vuot' && (
              <>
                <XCircle className="h-4 w-4 text-red-600" />
                <Badge className="bg-red-100 text-red-700">Vượt</Badge>
              </>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Thao tác',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewEquipmentList(row.original)}
        >
          Xem danh sách
        </Button>
      ),
    },
  ], [])

  const filteredData = useMemo(() => {
    let data = complianceData?.details ?? []

    // Status filter
    if (statusFilter !== 'all') {
      data = data.filter(item => item.trang_thai_tuan_thu === statusFilter)
    }

    // Search filter
    if (searchQuery) {
      data = data.filter(item =>
        item.ten_nhom.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return data
  }, [complianceData, statusFilter, searchQuery])

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chi tiết tuân thủ định mức</CardTitle>
        <CardDescription>
          Danh sách đầy đủ {filteredData.length} danh mục thiết bị
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Tất cả
            </Button>
            <Button
              variant={statusFilter === 'dat' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('dat')}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Đạt
            </Button>
            <Button
              variant={statusFilter === 'thieu' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('thieu')}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              Thiếu
            </Button>
            <Button
              variant={statusFilter === 'vuot' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('vuot')}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Vượt
            </Button>
          </div>
          <Input
            placeholder="Tìm kiếm thiết bị..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="md:max-w-sm"
          />
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    Không tìm thấy dữ liệu
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function handleViewEquipmentList(category: SoSanhDinhMuc) {
  // Navigate to equipment list filtered by category
  window.location.href = `/equipment?category=${category.nhom_thiet_bi_id}`
}
```

---

## 4. Data Visualization Options

### 4.1 Recommended: Donut Chart (Primary)

**Why**:
- Clean, modern aesthetic (matches existing dashboard)
- Easy to parse percentages at a glance
- Inner circle can show total count
- Mobile-friendly (no x-axis labels)

**Implementation**: Already shown in Section 3.3

### 4.2 Alternative: Horizontal Bar Chart

For users who prefer traditional charts:

```typescript
// ComplianceBarChart.tsx
import { DynamicBarChart } from '@/components/dynamic-chart'

export function ComplianceBarChart() {
  const { complianceData } = useDeviceQuotaContext()

  const chartData = [
    {
      status: 'Đạt',
      count: complianceData?.summary.dat ?? 0,
    },
    {
      status: 'Thiếu',
      count: complianceData?.summary.thieu ?? 0,
    },
    {
      status: 'Vượt',
      count: complianceData?.summary.vuot ?? 0,
    },
  ]

  return (
    <DynamicBarChart
      data={chartData}
      height={300}
      xAxisKey="status"
      bars={[
        {
          key: 'count',
          color: '#3b82f6', // blue-500
          name: 'Số lượng danh mục'
        }
      ]}
      showGrid={true}
      showLegend={false}
    />
  )
}
```

### 4.3 Advanced: Animated Counters

For visual appeal on summary cards:

```typescript
// Use react-countup or framer-motion
import { motion } from 'framer-motion'

<motion.div
  className="text-4xl font-bold text-green-600"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  {summary?.dat ?? 0}
</motion.div>
```

**Decision**: Skip for MVP (adds dependency), consider post-launch.

---

## 5. Export Functionality

### 5.1 PDF Export (Ministry Portal Submission)

**Library**: jsPDF (already available) or browser print API

```typescript
// ExportComplianceDialog.tsx
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

export function ExportComplianceDialog({ open, onOpenChange }) {
  const { complianceData, activeDecision } = useDeviceQuotaContext()

  const handleExportPDF = () => {
    const doc = new jsPDF()

    // Header
    doc.setFontSize(18)
    doc.text('BÁO CÁO TUÂN THỦ ĐỊNH MỨC THIẾT BỊ Y TẾ', 105, 20, { align: 'center' })

    // Decision info
    doc.setFontSize(12)
    doc.text(`Quyết định: ${activeDecision?.so_quyet_dinh}`, 20, 40)
    doc.text(`Ngày ban hành: ${activeDecision?.ngay_ban_hanh}`, 20, 50)
    doc.text(`Đơn vị: ${activeDecision?.ten_don_vi}`, 20, 60)

    // Summary table
    doc.autoTable({
      startY: 70,
      head: [['Trạng thái', 'Số lượng danh mục', 'Tỷ lệ']],
      body: [
        ['Đạt định mức', complianceData?.summary.dat ?? 0, `${calculatePercentage('dat')}%`],
        ['Thiếu', complianceData?.summary.thieu ?? 0, `${calculatePercentage('thieu')}%`],
        ['Vượt định mức', complianceData?.summary.vuot ?? 0, `${calculatePercentage('vuot')}%`],
      ],
    })

    // Detailed table
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Thiết bị', 'Định mức', 'Tối thiểu', 'Thực tế', 'Trạng thái']],
      body: complianceData?.details.map(item => [
        item.ten_nhom,
        item.quota,
        item.minimum ?? 'N/A',
        item.actual_count,
        item.trang_thai_tuan_thu === 'dat' ? 'Đạt' :
        item.trang_thai_tuan_thu === 'thieu' ? 'Thiếu' : 'Vượt'
      ]) ?? [],
    })

    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(10)
      doc.text(
        `Trang ${i} / ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }

    doc.save(`bao-cao-tuan-thu-${activeDecision?.so_quyet_dinh}.pdf`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xuất báo cáo tuân thủ</DialogTitle>
          <DialogDescription>
            Chọn định dạng xuất file để gửi Bộ Y tế hoặc lưu trữ nội bộ
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Button onClick={handleExportPDF} className="gap-2">
            <FileText className="h-4 w-4" />
            Xuất PDF (Gửi Bộ Y tế)
          </Button>
          <Button onClick={handleExportExcel} variant="outline" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Xuất Excel (Báo cáo nội bộ)
          </Button>
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />
            In báo cáo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### 5.2 Excel Export (Internal Reporting)

**Library**: exceljs (already in package.json)

```typescript
import ExcelJS from 'exceljs'

const handleExportExcel = async () => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Tuân thủ định mức')

  // Header
  worksheet.mergeCells('A1:E1')
  worksheet.getCell('A1').value = 'BÁO CÁO TUÂN THỦ ĐỊNH MỨC THIẾT BỊ Y TẾ'
  worksheet.getCell('A1').font = { bold: true, size: 16 }
  worksheet.getCell('A1').alignment = { horizontal: 'center' }

  // Decision info
  worksheet.getCell('A3').value = `Quyết định: ${activeDecision?.so_quyet_dinh}`
  worksheet.getCell('A4').value = `Ngày ban hành: ${activeDecision?.ngay_ban_hanh}`

  // Summary table
  worksheet.addRow([])
  worksheet.addRow(['Trạng thái', 'Số lượng', 'Tỷ lệ'])
  worksheet.addRow(['Đạt', complianceData?.summary.dat, `${calculatePercentage('dat')}%`])
  worksheet.addRow(['Thiếu', complianceData?.summary.thieu, `${calculatePercentage('thieu')}%`])
  worksheet.addRow(['Vượt', complianceData?.summary.vuot, `${calculatePercentage('vuot')}%`])

  // Detailed table
  worksheet.addRow([])
  worksheet.addRow(['Thiết bị', 'Định mức', 'Tối thiểu', 'Thực tế', 'Trạng thái'])
  complianceData?.details.forEach(item => {
    worksheet.addRow([
      item.ten_nhom,
      item.quota,
      item.minimum ?? 'N/A',
      item.actual_count,
      item.trang_thai_tuan_thu === 'dat' ? 'Đạt' :
      item.trang_thai_tuan_thu === 'thieu' ? 'Thiếu' : 'Vượt'
    ])
  })

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = 20
  })

  // Download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bao-cao-tuan-thu-${activeDecision?.so_quyet_dinh}.xlsx`
  a.click()
}
```

### 5.3 Print-Friendly View

```typescript
// Print CSS (in globals.css)
@media print {
  .no-print {
    display: none !important;
  }

  .print-full-width {
    width: 100% !important;
  }

  .page-break {
    page-break-after: always;
  }
}

// In component
<Button
  onClick={() => window.print()}
  variant="outline"
  className="no-print"
>
  <Printer className="h-4 w-4 mr-2" />
  In báo cáo
</Button>
```

---

## 6. Real-Time Considerations

### 6.1 Optimistic Updates Strategy

**Scenario**: User adds equipment → compliance should update immediately

```typescript
// In DeviceQuotaContext
const equipmentMutation = useMutation({
  mutationFn: (data: CreateEquipmentInput) =>
    callRpc({ fn: 'equipment_create', args: data }),

  onMutate: async (newEquipment) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({
      queryKey: deviceQuotaKeys.compliance(donViId!)
    })

    // Snapshot previous value
    const previousCompliance = queryClient.getQueryData(
      deviceQuotaKeys.compliance(donViId!)
    )

    // Optimistically update compliance
    queryClient.setQueryData(
      deviceQuotaKeys.compliance(donViId!),
      (old: ComplianceReport) => {
        // Find affected category
        const updated = old.details.map(item => {
          if (item.nhom_thiet_bi_id === newEquipment.nhom_thiet_bi_id) {
            const newActual = item.actual_count + 1
            return {
              ...item,
              actual_count: newActual,
              trang_thai_tuan_thu: calculateStatus(
                newActual,
                item.quota,
                item.minimum
              )
            }
          }
          return item
        })

        return {
          ...old,
          details: updated,
          summary: recalculateSummary(updated)
        }
      }
    )

    return { previousCompliance }
  },

  onError: (err, newEquipment, context) => {
    // Rollback on error
    queryClient.setQueryData(
      deviceQuotaKeys.compliance(donViId!),
      context?.previousCompliance
    )
    toast({
      variant: 'destructive',
      title: 'Lỗi',
      description: 'Không thể cập nhật. Đã hoàn tác thay đổi.'
    })
  },

  onSettled: () => {
    // Refetch to ensure sync
    queryClient.invalidateQueries({
      queryKey: deviceQuotaKeys.compliance(donViId!)
    })
  }
})

function calculateStatus(actual: number, quota: number, minimum?: number): TrangThaiTuanThu {
  if (actual > quota) return 'vuot'
  if (minimum && actual < minimum) return 'thieu'
  return 'dat'
}
```

### 6.2 Refetch Strategy

**Triggers for refetch**:
- Equipment added/transferred/disposed
- Quota decision activated/published
- Manual refresh button

```typescript
const complianceQuery = useQuery({
  queryKey: deviceQuotaKeys.compliance(donViId!),
  queryFn: () => callRpc({
    fn: 'dinh_muc_bao_cao_tuan_thu',
    args: {}
  }),
  enabled: !!donViId,
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: true,
  refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 min
})
```

### 6.3 Loading States

```typescript
// Skeleton for summary cards
{complianceQuery.isLoading && (
  <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
    {[...Array(4)].map((_, i) => (
      <Card key={i}>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-16 mb-2" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    ))}
  </div>
)}
```

---

## 7. Accessibility

### 7.1 Color-Blind Friendly Design

**Icons + Colors**: Always pair status colors with icons

```typescript
// Status indicators MUST include both
<div className="flex items-center gap-2">
  <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
  <Badge className="bg-green-100 text-green-700">Đạt</Badge>
</div>
```

**Patterns**: Use different shapes/patterns for chart segments

```typescript
// In DynamicPieChart
<Pie
  // ... other props
  label={({ name, value, percent }) => {
    const icon =
      name === 'Đạt' ? '✓' :
      name === 'Thiếu' ? '⚠' :
      name === 'Vượt' ? '✕' : ''
    return `${icon} ${name}: ${value} (${(percent * 100).toFixed(0)}%)`
  }}
/>
```

### 7.2 Screen Reader Support

```typescript
// ARIA labels on charts
<div role="img" aria-label={`Biểu đồ tuân thủ định mức: ${summary.dat} đạt, ${summary.thieu} thiếu, ${summary.vuot} vượt`}>
  <DynamicPieChart ... />
</div>

// Table accessibility
<Table>
  <caption className="sr-only">
    Chi tiết tuân thủ định mức thiết bị y tế
  </caption>
  <TableHeader>...</TableHeader>
</Table>

// Status announcements
<div className="sr-only" role="status" aria-live="polite">
  {complianceQuery.isFetching && "Đang cập nhật dữ liệu tuân thủ"}
</div>
```

### 7.3 Keyboard Navigation

```typescript
// Focus management in table
<TableRow
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleViewEquipmentList(row.original)
    }
  }}
>
  ...
</TableRow>

// Skip to content link
<a href="#compliance-content" className="sr-only focus:not-sr-only">
  Bỏ qua điều hướng
</a>
```

---

## 8. Performance Optimizations

### 8.1 Code Splitting

```typescript
// Lazy load heavy components
const ExportComplianceDialog = lazy(() =>
  import('./ExportComplianceDialog').then(m => ({ default: m.ExportComplianceDialog }))
)

const ComplianceStatusChart = lazy(() =>
  import('./ComplianceStatusChart').then(m => ({ default: m.ComplianceStatusChart }))
)

// Usage with Suspense
<Suspense fallback={<ChartLoadingFallback height={400} />}>
  <ComplianceStatusChart />
</Suspense>
```

### 8.2 Memoization

```typescript
// In ComplianceDetailTable
const filteredData = useMemo(() => {
  // Expensive filtering logic
}, [complianceData, statusFilter, searchQuery])

const columns = useMemo(() => [...], []) // Define once

// In ComplianceSummaryCards
const summary = useMemo(() =>
  complianceData?.summary,
  [complianceData]
)
```

### 8.3 Virtual Scrolling (for large datasets)

```typescript
// If compliance table has 100+ rows
import { useVirtualizer } from '@tanstack/react-virtual'

const rowVirtualizer = useVirtualizer({
  count: filteredData.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => 60, // Row height
  overscan: 5,
})

// Render only visible rows
{rowVirtualizer.getVirtualItems().map(virtualRow => {
  const row = filteredData[virtualRow.index]
  return <TableRow key={virtualRow.key}>...</TableRow>
})}
```

**Decision**: Skip for MVP (quota decisions typically have <50 categories). Add if needed.

---

## 9. Mobile Responsiveness

### 9.1 Mobile-First Grid

```typescript
// Summary cards: 2 cols mobile, 4 cols desktop
<div className="grid gap-3 grid-cols-2 md:grid-cols-4 md:gap-6">
  ...
</div>

// Chart: Stack on mobile
<div className="grid gap-4 md:grid-cols-2">
  <ComplianceStatusChart />
  <ComplianceBarChart />
</div>
```

### 9.2 Responsive Table

**Problem**: Wide tables break on mobile

**Solution 1**: Horizontal scroll

```typescript
<div className="overflow-x-auto">
  <Table className="min-w-[600px]">
    ...
  </Table>
</div>
```

**Solution 2**: Card layout on mobile (RECOMMENDED)

```typescript
{/* Desktop: Table view */}
<div className="hidden md:block">
  <Table>...</Table>
</div>

{/* Mobile: Card view */}
<div className="md:hidden space-y-4">
  {filteredData.map(item => (
    <Card key={item.nhom_thiet_bi_id}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="font-medium">{item.ten_nhom}</div>
          <StatusBadge status={item.trang_thai_tuan_thu} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Định mức</div>
            <div className="font-semibold">{item.quota}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Tối thiểu</div>
            <div className="font-semibold">{item.minimum ?? 'N/A'}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Thực tế</div>
            <div className="font-bold text-lg">{item.actual_count}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  ))}
</div>
```

### 9.3 Touch Targets

```typescript
// Ensure buttons are at least 44x44px (iOS guideline)
<Button
  size="sm"
  className="min-h-[44px] min-w-[44px]"
>
  <Filter className="h-4 w-4" />
</Button>

// Swipe gestures for table rows (future enhancement)
<TableRow
  {...swipeHandlers}
  className="touch-pan-x"
>
  ...
</TableRow>
```

---

## 10. Testing Strategy

### 10.1 Unit Tests (Vitest)

```typescript
// ComplianceSummaryCards.test.tsx
import { render, screen } from '@testing-library/react'
import { ComplianceSummaryCards } from './ComplianceSummaryCards'
import { DeviceQuotaProvider } from './DeviceQuotaContext'

describe('ComplianceSummaryCards', () => {
  it('displays correct compliance counts', () => {
    const mockData = {
      summary: { dat: 15, thieu: 3, vuot: 2, total_categories: 20 }
    }

    render(
      <DeviceQuotaProvider value={{ complianceData: mockData }}>
        <ComplianceSummaryCards />
      </DeviceQuotaProvider>
    )

    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows loading skeleton when data is null', () => {
    render(
      <DeviceQuotaProvider value={{ complianceData: null }}>
        <ComplianceSummaryCards />
      </DeviceQuotaProvider>
    )

    expect(screen.getAllByRole('status')).toHaveLength(4) // Skeletons
  })
})
```

### 10.2 Integration Tests

```typescript
// ComplianceDashboard.integration.test.tsx
it('updates compliance when equipment is added', async () => {
  const { user } = renderWithProviders(<ComplianceDashboard />)

  // Initial state
  expect(screen.getByText('15')).toBeInTheDocument() // Dat count

  // Add equipment
  await user.click(screen.getByText('Thêm thiết bị'))
  // ... fill form
  await user.click(screen.getByText('Lưu'))

  // Wait for optimistic update
  await waitFor(() => {
    expect(screen.getByText('16')).toBeInTheDocument() // Updated count
  })
})
```

### 10.3 Accessibility Tests

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

it('has no accessibility violations', async () => {
  const { container } = render(<ComplianceDashboard />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

---

## 11. Implementation Roadmap

### Phase 1: Core Dashboard (Week 1)
- [ ] Create DeviceQuotaContext with state management
- [ ] Implement ComplianceSummaryCards
- [ ] Implement ComplianceDetailTable (desktop view)
- [ ] Add basic filtering (status filter)
- [ ] Connect to `dinh_muc_bao_cao_tuan_thu` RPC function

### Phase 2: Visualizations (Week 2)
- [ ] Implement ComplianceStatusChart (donut chart)
- [ ] Add QuotaDecisionSelector (select active decision)
- [ ] Mobile-responsive card layout for table
- [ ] Loading states and error boundaries

### Phase 3: Export & Polish (Week 3)
- [ ] Implement ExportComplianceDialog
- [ ] PDF export with jsPDF
- [ ] Excel export with exceljs
- [ ] Print-friendly CSS
- [ ] Accessibility audit and fixes

### Phase 4: Enhancements (Post-MVP)
- [ ] Optimistic updates for equipment mutations
- [ ] Virtual scrolling for large datasets
- [ ] Historical compliance trends (line chart)
- [ ] Email/webhook notifications for non-compliance
- [ ] Bulk actions (mark as reviewed, add notes)

---

## 12. Design Mockup Summary

### Desktop View (1920x1080)
```
┌────────────────────────────────────────────────────────────────────┐
│  [Logo] Device Quota Management          [User] [Settings] [Logout]│
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Tuân thủ định mức thiết bị                                        │
│  [Quyết định: 15/QĐ-BVBM ▼]  [Export PDF ↓] [Print 🖨]            │
│                                                                     │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐        │
│  │  ✓ Đạt      │  ⚠ Thiếu    │  ✕ Vượt     │  📦 Tổng    │        │
│  │  15 items   │  3 items    │  2 items    │  20 items   │        │
│  │  75%        │  15%        │  10%        │  100%       │        │
│  └─────────────┴─────────────┴─────────────┴─────────────┘        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │         Tổng quan tuân thủ định mức                      │      │
│  │                                                           │      │
│  │               ╱────────╲                                 │      │
│  │              │  Đạt 75% │                                │      │
│  │              │   Thiếu  │                                │      │
│  │              │   15%    │                                │      │
│  │               ╲────────╱                                 │      │
│  │                                                           │      │
│  │  ✓ Đạt: 15 (75%)   ⚠ Thiếu: 3 (15%)   ✕ Vượt: 2 (10%)  │      │
│  └─────────────────────────────────────────────────────────┘      │
│                                                                     │
│  Chi tiết tuân thủ định mức                                        │
│  [All | Đạt | Thiếu | Vượt]  [Search: _________]                  │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ Thiết bị          │ Định mức │ Tối thiểu │ Thực tế│Status│     │
│  ├──────────────────────────────────────────────────────────┤     │
│  │ CT Scanner        │    2     │     1     │    2   │ ✓ Đạt│     │
│  │ MRI System        │    1     │     1     │    0   │ ⚠ Thiếu│   │
│  │ Ventilator        │   12     │     8     │   15   │ ✕ Vượt│   │
│  │ Ultrasound        │    5     │     3     │    4   │ ✓ Đạt│     │
│  └──────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
```

### Mobile View (375x667 - iPhone SE)
```
┌───────────────────────────┐
│  ☰  Device Quota     👤   │
├───────────────────────────┤
│ Quyết định: 15/QĐ-BVBM ▼  │
│ [Export] [Print]          │
│                           │
│ ┌──────────┬──────────┐   │
│ │ ✓ Đạt    │ ⚠ Thiếu  │   │
│ │   15     │    3     │   │
│ └──────────┴──────────┘   │
│ ┌──────────┬──────────┐   │
│ │ ✕ Vượt   │ 📦 Tổng  │   │
│ │    2     │   20     │   │
│ └──────────┴──────────┘   │
│                           │
│ ┌─────────────────────┐   │
│ │   ╱──────╲          │   │
│ │  │ Đạt 75%│         │   │
│ │   ╲──────╱          │   │
│ │                     │   │
│ │ ✓ 15  ⚠ 3  ✕ 2     │   │
│ └─────────────────────┘   │
│                           │
│ [All|Đạt|Thiếu|Vượt]      │
│ [Search: ______]          │
│                           │
│ ┌─────────────────────┐   │
│ │ CT Scanner     ✓ Đạt│   │
│ │ Định mức: 2         │   │
│ │ Thực tế: 2          │   │
│ └─────────────────────┘   │
│ ┌─────────────────────┐   │
│ │ MRI System   ⚠ Thiếu│   │
│ │ Định mức: 1         │   │
│ │ Thực tế: 0          │   │
│ └─────────────────────┘   │
│ ┌─────────────────────┐   │
│ │ Ventilator   ✕ Vượt │   │
│ │ Định mức: 12        │   │
│ │ Thực tế: 15         │   │
│ └─────────────────────┘   │
└───────────────────────────┘
```

---

## 13. Final Recommendations

### Must-Have (MVP)
1. Summary KPI cards (4 metrics)
2. Donut chart visualization
3. Detailed table with filtering
4. PDF export for Ministry portal
5. Mobile-responsive layout
6. Icons + colors for accessibility
7. Loading states and error handling

### Nice-to-Have (Post-Launch)
1. Excel export
2. Historical trend chart (line chart over time)
3. Animated counters
4. Virtual scrolling
5. Email alerts for non-compliance
6. Bulk actions (notes, approval)
7. Comparison view (multiple decisions)

### Critical Success Factors
- **Performance**: Dashboard must load in <2 seconds
- **Accuracy**: Compliance calculations MUST match RPC function output
- **Accessibility**: WCAG 2.1 AA compliance (color contrast, keyboard nav, screen readers)
- **Export Quality**: PDF must be suitable for Ministry submission (professional formatting)
- **Mobile UX**: Touch-friendly, readable on 375px screens

---

## 14. Dependency Check

**Required packages** (already installed):
- ✅ recharts (charts)
- ✅ @tanstack/react-table (table)
- ✅ @tanstack/react-query (data fetching)
- ✅ lucide-react (icons)
- ✅ exceljs (Excel export)

**Additional packages needed**:
- ❌ jsPDF + jspdf-autotable (PDF export)
  ```bash
  npm install jspdf jspdf-autotable
  npm install --save-dev @types/jspdf
  ```

**Optional enhancements**:
- ❌ framer-motion (animations) - Skip for MVP
- ❌ react-countup (animated counters) - Skip for MVP

---

## 15. Next Steps

1. **Backend team**: Ensure `dinh_muc_bao_cao_tuan_thu` RPC function returns data in expected format (see implementation plan)
2. **Frontend team**: Create component stubs and context provider
3. **Design review**: Present mockups to stakeholders for approval
4. **Implementation**: Follow roadmap (Phase 1-3, 3 weeks)
5. **Testing**: Run accessibility audit before launch

**Estimated Timeline**: 3 weeks for MVP + 1 week buffer = 4 weeks total

**Files to create**: ~10 new TypeScript files (components, hooks, types)

**Lines of code**: ~1,500 LOC (components + tests)

---

## Appendix A: TypeScript Interfaces

```typescript
// types.ts
export interface ComplianceSummary {
  total_categories: number
  dat: number
  thieu: number
  vuot: number
}

export interface ComplianceDetail {
  don_vi_id: number
  quyet_dinh_id: number
  nhom_thiet_bi_id: number
  ten_nhom: string
  phan_loai: 'A' | 'B' | null
  don_vi_tinh: string
  quota: number
  minimum: number | null
  actual_count: number
  trang_thai_tuan_thu: 'dat' | 'thieu' | 'vuot'
}

export interface ComplianceReport {
  don_vi_id: number
  quyet_dinh: QuyetDinhDinhMuc | null
  summary: ComplianceSummary
  details: ComplianceDetail[]
}
```

---

## Appendix B: Color Palette Reference

```css
/* Compliance Status Colors */
:root {
  /* Đạt (Compliant) */
  --compliance-dat-bg: #f0fdf4;
  --compliance-dat-border: #86efac;
  --compliance-dat-text: #166534;
  --compliance-dat-chart: #10b981;

  /* Thiếu (Below) */
  --compliance-thieu-bg: #fef3c7;
  --compliance-thieu-border: #fcd34d;
  --compliance-thieu-text: #92400e;
  --compliance-thieu-chart: #f59e0b;

  /* Vượt (Over) */
  --compliance-vuot-bg: #fee2e2;
  --compliance-vuot-border: #fca5a5;
  --compliance-vuot-text: #991b1b;
  --compliance-vuot-chart: #ef4444;
}
```

---

**End of Review**

**Reviewer**: Claude Code (Frontend Specialist)
**Date**: 2026-01-31
**Confidence**: High (based on thorough codebase analysis)
**Risk Level**: Low (uses established patterns, no new tech stack)
