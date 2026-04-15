"use client"

import React from "react"
import { format } from "date-fns"
import { Printer, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEquipmentUsageLogs } from "@/hooks/use-usage-logs"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { parseDateInputAsLocalDate } from "@/components/usage-log-print-builder-utils"
import { buildUsageLogCsv, buildUsageLogPrintHtml } from "@/components/usage-log-print-builders"
import { type Equipment } from "@/types/database"

interface UsageLogPrintProps {
  equipment: Pick<Equipment, 'id' | 'ten_thiet_bi' | 'ma_thiet_bi'> & Partial<Equipment>
}

// Status filter options configuration
const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'hoan_thanh', label: 'Hoàn thành' },
  { value: 'dang_su_dung', label: 'Đang sử dụng' },
] as const

export function UsageLogPrint({ equipment }: UsageLogPrintProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  const { data: usageLogs } = useEquipmentUsageLogs(equipment.id.toString())
  const branding = useTenantBranding()
  const tenantName = branding.data?.name || 'Nền tảng QLTBYT'
  const tenantLogoUrl = branding.data?.logo_url || 'https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png'

  // Filter logs based on date range and status
  const filteredLogs = React.useMemo(() => {
    if (!usageLogs) return []

    // Pre-calculate date boundaries to avoid creating Date objects in loop
    const fromDate = dateFrom ? parseDateInputAsLocalDate(dateFrom) : null
    const toDate = dateTo ? (() => {
      const date = parseDateInputAsLocalDate(dateTo)
      date.setHours(23, 59, 59, 999) // End of day
      return date
    })() : null

    return usageLogs.filter(log => {
      // Date filtering with pre-calculated boundaries
      const logDate = new Date(log.thoi_gian_bat_dau)

      if (fromDate && logDate < fromDate) return false
      if (toDate && logDate > toDate) return false

      // Status filtering
      if (statusFilter !== "all" && log.trang_thai !== statusFilter) return false

      return true
    })
  }, [usageLogs, dateFrom, dateTo, statusFilter])

  const handlePrint = () => {
    const printContent = buildUsageLogPrintHtml({
      equipment,
      filteredLogs,
      tenantName,
      tenantLogoUrl,
      dateFrom,
      dateTo,
      now: new Date(),
    })
    const printWindow = window.open('', '_blank')

    if (printWindow) {
      // Use modern approach to avoid deprecated document.write
      printWindow.document.documentElement.innerHTML = printContent
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }

    setIsDialogOpen(false)
  }

  const handleExport = () => {
    const csvContent = buildUsageLogCsv({
      equipment,
      filteredLogs,
      now: new Date(),
    })
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `nhat-ky-su-dung-${equipment.ma_thiet_bi}-${format(new Date(), 'yyyy-MM-dd')}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    
    setIsDialogOpen(false)
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" />
          In báo cáo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>In báo cáo nhật ký sử dụng</DialogTitle>
          <DialogDescription>
            Thiết bị: {equipment.ten_thiet_bi} ({equipment.ma_thiet_bi})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">Từ ngày</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">Đến ngày</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status-filter">Trạng thái</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Số bản ghi sẽ in: <span className="font-medium">{filteredLogs.length}</span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
            Hủy
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Xuất CSV
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            In báo cáo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
