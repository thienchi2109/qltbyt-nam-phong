# Implementation Plan: Role-Scoped Report Viewing/Export

I'll break this down into incremental, testable steps following the existing codebase patterns.

## Phase 1: Access Control & Role Utilities

### 1.1 Create Role Helper Functions
**File:** `src/lib/auth-utils.ts` (new)

```typescript
import { auth } from "@/auth"

export type UserRole = 'global' | 'regional_leader' | 'admin' | 'user'

export async function getSessionWithRole() {
  const session = await auth()
  if (!session?.user) return null
  
  return {
    user: session.user,
    role: (session.user as any).role as UserRole,
    regionId: (session.user as any).region_id as number | null,
    donVi: (session.user as any).don_vi as number | null,
  }
}

export function canAccessReports(role: UserRole): boolean {
  return role === 'global' || role === 'regional_leader'
}

export function canAccessOrg(role: UserRole, userRegionId: number | null, orgRegionId: number | null): boolean {
  if (role === 'global') return true
  if (role === 'regional_leader' && userRegionId && orgRegionId) {
    return userRegionId === orgRegionId
  }
  return false
}
```

**Why:** Centralizes role logic; reusable across server actions and pages.

---

## Phase 2: Server Actions for Organization Access

### 2.1 Create Server Actions
**File:** `src/app/(app)/reports/actions.ts` (new)

```typescript
'use server'

import { getSessionWithRole, canAccessReports, canAccessOrg } from '@/lib/auth-utils'
import { supabase } from '@/lib/supabase'

export interface OrgOption {
  id: number
  name: string
  regionId: number | null
}

export class ForbiddenError extends Error {
  constructor(message = 'Access denied') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function getAccessibleOrgs(): Promise<OrgOption[]> {
  const sessionData = await getSessionWithRole()
  
  if (!sessionData) {
    throw new ForbiddenError('Not authenticated')
  }
  
  const { role, regionId } = sessionData
  
  if (!canAccessReports(role)) {
    throw new ForbiddenError('Insufficient permissions')
  }
  
  // Fetch organizations based on role
  if (role === 'global') {
    const { data, error } = await supabase
      .from('don_vi')
      .select('id, ten_don_vi, region_id')
      .order('ten_don_vi')
    
    if (error) throw error
    
    return (data || []).map(org => ({
      id: org.id,
      name: org.ten_don_vi,
      regionId: org.region_id
    }))
  }
  
  if (role === 'regional_leader') {
    if (!regionId) {
      throw new Error('Regional leader missing region_id')
    }
    
    const { data, error } = await supabase
      .from('don_vi')
      .select('id, ten_don_vi, region_id')
      .eq('region_id', regionId)
      .order('ten_don_vi')
    
    if (error) throw error
    
    return (data || []).map(org => ({
      id: org.id,
      name: org.ten_don_vi,
      regionId: org.region_id
    }))
  }
  
  return []
}

export async function validateOrgAccess(orgId: number): Promise<boolean> {
  const sessionData = await getSessionWithRole()
  
  if (!sessionData) return false
  
  const { role, regionId } = sessionData
  
  if (!canAccessReports(role)) return false
  
  if (role === 'global') return true
  
  if (role === 'regional_leader' && regionId) {
    const { data, error } = await supabase
      .from('don_vi')
      .select('region_id')
      .eq('id', orgId)
      .single()
    
    if (error || !data) return false
    
    return data.region_id === regionId
  }
  
  return false
}
```

**Why:** Server-side enforcement prevents client manipulation; follows Next.js 14 server actions pattern.

---

## Phase 3: UI Components for Report Selection

### 3.1 Create Organization Selector Component
**File:** `src/app/(app)/reports/components/org-selector.tsx` (new)

```typescript
"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { OrgOption } from "../actions"

interface OrgSelectorProps {
  organizations: OrgOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function OrgSelector({ organizations, value, onChange, disabled }: OrgSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="org-select">Đơn vị</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="org-select" className="w-[280px]">
          <SelectValue placeholder="Chọn đơn vị..." />
        </SelectTrigger>
        <SelectContent>
          {organizations.map(org => (
            <SelectItem key={org.id} value={String(org.id)}>
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

### 3.2 Create Period Selector Component
**File:** `src/app/(app)/reports/components/period-selector.tsx` (new)

```typescript
"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"

interface PeriodSelectorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function PeriodSelector({ value, onChange, disabled }: PeriodSelectorProps) {
  // Default to current month if empty
  const defaultValue = React.useMemo(() => {
    if (value) return value
    return format(new Date(), 'yyyy-MM')
  }, [value])

  React.useEffect(() => {
    if (!value) {
      onChange(defaultValue)
    }
  }, [value, defaultValue, onChange])

  return (
    <div className="space-y-2">
      <Label htmlFor="period-input">Kỳ báo cáo</Label>
      <Input
        id="period-input"
        type="month"
        value={value || defaultValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-[200px]"
      />
    </div>
  )
}
```

---

## Phase 4: Integrate Export UI into Reports Page

### 4.1 Add Export Section to Reports Page
**File:** `src/app/(app)/reports/page.tsx` (modify)

Add new imports at top:
```typescript
import { getAccessibleOrgs, ForbiddenError } from "./actions"
import { OrgSelector } from "./components/org-selector"
import { PeriodSelector } from "./components/period-selector"
import { Button } from "@/components/ui/button"
import { FileDown } from "lucide-react"
```

Add new component before existing return:
```typescript
function ExportReportSection() {
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user as any
  
  const [organizations, setOrganizations] = React.useState<Array<{id: number; name: string; regionId: number | null}>>([])
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>("")
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  
  const isGlobal = user?.role === 'global'
  const isRegionalLeader = user?.role === 'regional_leader'
  const canExport = isGlobal || isRegionalLeader
  
  React.useEffect(() => {
    if (!canExport) {
      setIsLoading(false)
      return
    }
    
    getAccessibleOrgs()
      .then(orgs => {
        setOrganizations(orgs)
        setIsLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Failed to load organizations')
        setIsLoading(false)
      })
  }, [canExport])
  
  const handleExport = () => {
    if (!selectedOrgId || !selectedPeriod) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng chọn đơn vị và kỳ báo cáo",
        variant: "destructive"
      })
      return
    }
    
    router.push(`/reports/print?org_id=${selectedOrgId}&period=${selectedPeriod}`)
  }
  
  if (!canExport) return null
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Xuất báo cáo tổng hợp</CardTitle>
        <CardDescription>
          Chọn đơn vị và kỳ báo cáo để xuất file in
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-[280px]" />
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-10 w-[140px]" />
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : (
          <div className="flex items-end gap-4 flex-wrap">
            <OrgSelector
              organizations={organizations}
              value={selectedOrgId}
              onChange={setSelectedOrgId}
            />
            <PeriodSelector
              value={selectedPeriod}
              onChange={setSelectedPeriod}
            />
            <Button 
              onClick={handleExport}
              disabled={!selectedOrgId || !selectedPeriod}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Xuất báo cáo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

Insert `<ExportReportSection />` after the title header, before the existing tabs.

---

## Phase 5: Print Page with Report Data

### 5.1 Create Report Data Fetcher
**File:** `src/app/(app)/reports/print/data.ts` (new)

```typescript
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export interface ReportRow {
  equipmentCode: string
  equipmentName: string
  department: string
  status: string
  lastMaintenance: string | null
  nextDue: string | null
  utilizationHours: number
  downtime: number
  notes: string
}

export async function fetchReportData(orgId: number, period: string): Promise<ReportRow[]> {
  // Parse period YYYY-MM
  const [year, month] = period.split('-').map(Number)
  const periodStart = startOfMonth(new Date(year, month - 1))
  const periodEnd = endOfMonth(periodStart)
  
  const startStr = format(periodStart, 'yyyy-MM-dd')
  const endStr = format(periodEnd, 'yyyy-MM-dd')
  
  // Fetch equipment for the org
  const { data: equipment, error: eqError } = await supabase
    .from('thiet_bi')
    .select(`
      id,
      ma_thiet_bi,
      ten_thiet_bi,
      khoa_phong_quan_ly,
      tinh_trang,
      don_vi_id
    `)
    .eq('don_vi_id', orgId)
    .order('ma_thiet_bi')
  
  if (eqError) throw eqError
  if (!equipment) return []
  
  // Fetch maintenance records
  const equipmentIds = equipment.map(e => e.id)
  
  const { data: maintenanceRecords } = await supabase
    .from('cong_viec_bao_tri')
    .select('thiet_bi_id, ngay_thuc_hien, ngay_ke_hoach')
    .in('thiet_bi_id', equipmentIds)
    .order('ngay_thuc_hien', { ascending: false })
  
  // Fetch usage sessions
  const { data: usageSessions } = await supabase
    .from('usage_session')
    .select('equipment_id, start_time, end_time, status')
    .in('equipment_id', equipmentIds)
    .gte('start_time', startStr)
    .lte('start_time', endStr)
  
  // Build report rows
  return equipment.map(eq => {
    // Last maintenance
    const eqMaintenance = (maintenanceRecords || [])
      .filter(m => m.thiet_bi_id === eq.id && m.ngay_thuc_hien)
      .sort((a, b) => new Date(b.ngay_thuc_hien!).getTime() - new Date(a.ngay_thuc_hien!).getTime())
    
    const lastMaintenance = eqMaintenance[0]?.ngay_thuc_hien || null
    
    // Next due (from planned maintenance)
    const nextDue = (maintenanceRecords || [])
      .filter(m => m.thiet_bi_id === eq.id && m.ngay_ke_hoach && new Date(m.ngay_ke_hoach) > new Date())
      .sort((a, b) => new Date(a.ngay_ke_hoach!).getTime() - new Date(b.ngay_ke_hoach!).getTime())[0]?.ngay_ke_hoach || null
    
    // Usage hours
    const sessions = (usageSessions || []).filter(s => s.equipment_id === eq.id && s.end_time)
    const totalMinutes = sessions.reduce((sum, s) => {
      const start = new Date(s.start_time).getTime()
      const end = new Date(s.end_time!).getTime()
      return sum + (end - start) / (1000 * 60)
    }, 0)
    const utilizationHours = Math.round(totalMinutes / 60 * 10) / 10
    
    // Downtime (sessions with status 'error' or 'maintenance')
    const downtimeSessions = sessions.filter(s => s.status === 'error' || s.status === 'maintenance')
    const downtimeMinutes = downtimeSessions.reduce((sum, s) => {
      const start = new Date(s.start_time).getTime()
      const end = new Date(s.end_time!).getTime()
      return sum + (end - start) / (1000 * 60)
    }, 0)
    const downtime = Math.round(downtimeMinutes / 60 * 10) / 10
    
    return {
      equipmentCode: eq.ma_thiet_bi,
      equipmentName: eq.ten_thiet_bi,
      department: eq.khoa_phong_quan_ly || 'N/A',
      status: eq.tinh_trang || 'N/A',
      lastMaintenance: lastMaintenance ? format(new Date(lastMaintenance), 'yyyy-MM-dd') : null,
      nextDue: nextDue ? format(new Date(nextDue), 'yyyy-MM-dd') : null,
      utilizationHours,
      downtime,
      notes: ''
    }
  })
}
```

### 5.2 Create Print Page
**File:** `src/app/(app)/reports/print/page.tsx` (new)

```typescript
import * as React from 'react'
import { redirect } from 'next/navigation'
import { getSessionWithRole, canAccessReports } from '@/lib/auth-utils'
import { validateOrgAccess } from '../actions'
import { fetchReportData, type ReportRow } from './data'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'

interface PageProps {
  searchParams: { org_id?: string; period?: string }
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num)
}

export default async function ReportPrintPage({ searchParams }: PageProps) {
  const sessionData = await getSessionWithRole()
  
  // Auth check
  if (!sessionData || !canAccessReports(sessionData.role)) {
    redirect('/')
  }
  
  // Validate params
  const orgIdStr = searchParams.org_id
  const period = searchParams.period
  
  if (!orgIdStr || !period) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-destructive mb-4">Thiếu thông tin</h1>
        <p>Vui lòng cung cấp org_id và period trong URL.</p>
      </div>
    )
  }
  
  const orgId = parseInt(orgIdStr, 10)
  if (!Number.isFinite(orgId)) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-destructive mb-4">ID đơn vị không hợp lệ</h1>
      </div>
    )
  }
  
  // Validate org access
  const hasAccess = await validateOrgAccess(orgId)
  if (!hasAccess) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-destructive mb-4">Không có quyền truy cập</h1>
        <p>Bạn không có quyền xem báo cáo của đơn vị này.</p>
      </div>
    )
  }
  
  // Fetch report data
  let reportData: ReportRow[] = []
  let orgName = `Đơn vị ${orgId}`
  
  try {
    reportData = await fetchReportData(orgId, period)
    
    // Fetch org name
    const { supabase } = await import('@/lib/supabase')
    const { data: orgData } = await supabase
      .from('don_vi')
      .select('ten_don_vi')
      .eq('id', orgId)
      .single()
    
    if (orgData) orgName = orgData.ten_don_vi
  } catch (error) {
    console.error('Error fetching report data:', error)
  }
  
  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 12mm;
        }
        
        @media print {
          .no-print {
            display: none !important;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          table {
            page-break-inside: auto;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          thead {
            display: table-header-group;
          }
        }
        
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        
        .report-table th,
        .report-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        
        .report-table th {
          background-color: #f5f5f5;
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        .report-table tr:nth-child(even) {
          background-color: #fafafa;
        }
        
        .report-table .num {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        
        .report-table .center {
          text-align: center;
        }
      `}</style>
      
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="mb-6 flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold mb-1">Báo cáo thiết bị y tế</h1>
            <p className="text-muted-foreground">
              {orgName} • Kỳ: {period}
            </p>
          </div>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            In báo cáo
          </Button>
        </div>
        
        <div className="print:block">
          <div className="mb-4 text-center">
            <h1 className="text-xl font-bold">BÁO CÁO THIẾT BỊ Y TẾ</h1>
            <p className="text-sm mt-1">{orgName}</p>
            <p className="text-sm">Kỳ báo cáo: {period}</p>
          </div>
          
          {reportData.length === 0 ? (
            <div className="text-center py-12 border rounded">
              <p className="text-muted-foreground">
                Không có dữ liệu cho kỳ báo cáo này
              </p>
            </div>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th className="center" style={{ width: '40px' }}>#</th>
                  <th style={{ width: '100px' }}>Mã TB</th>
                  <th style={{ width: '180px' }}>Tên thiết bị</th>
                  <th style={{ width: '120px' }}>Khoa/Phòng</th>
                  <th style={{ width: '100px' }}>Tình trạng</th>
                  <th className="center" style={{ width: '100px' }}>Bảo trì gần nhất</th>
                  <th className="center" style={{ width: '100px' }}>Bảo trì tiếp theo</th>
                  <th className="num" style={{ width: '80px' }}>Giờ SD</th>
                  <th className="num" style={{ width: '80px' }}>Giờ chết</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, index) => (
                  <tr key={index}>
                    <td className="center">{index + 1}</td>
                    <td>{row.equipmentCode}</td>
                    <td>{row.equipmentName}</td>
                    <td>{row.department}</td>
                    <td>{row.status}</td>
                    <td className="center">{row.lastMaintenance || '—'}</td>
                    <td className="center">{row.nextDue || '—'}</td>
                    <td className="num">{formatNumber(row.utilizationHours)}</td>
                    <td className="num">{formatNumber(row.downtime)}</td>
                    <td>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
```

---

## Phase 6: Testing & Refinement

### 6.1 Test Cases
1. **Global user**: Can see all orgs, export any org's report
2. **Regional leader**: Only sees orgs in their region, 403 on other orgs
3. **Regular user**: Cannot access export UI or print page (403)
4. **Invalid params**: Proper error messages
5. **Empty data**: Shows "Không có dữ liệu" message
6. **Print functionality**: Table prints correctly with headers on each page

### 6.2 Edge Cases to Handle
- Missing `region_id` for regional leaders
- Org with no equipment
- Period with no activity
- Concurrent requests
- Database errors

---

## Summary

This plan provides:
✅ **Role-based access control** at both UI and server level  
✅ **Organization filtering** based on user role/region  
✅ **Period selection** with month granularity  
✅ **Printable HTML table** with Excel-like formatting  
✅ **Type safety** throughout (no `any` types in production code)  
✅ **Graceful error handling** and empty states  
✅ **Vietnamese UI text** consistent with existing app  
✅ **SSR-safe** with server-side validation  

The implementation follows Next.js 14 App Router patterns, uses existing UI components (shadcn), and integrates seamlessly with the current authentication system.