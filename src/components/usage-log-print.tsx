"use client"

import React from "react"
import { format, differenceInMinutes } from "date-fns"
import { vi } from "date-fns/locale"
import { Printer, Download, Calendar, Filter } from "lucide-react"

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
import { type Equipment, type UsageLog } from "@/types/database"

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

  // Filter logs based on date range and status
  const filteredLogs = React.useMemo(() => {
    if (!usageLogs) return []

    // Pre-calculate date boundaries to avoid creating Date objects in loop
    const fromDate = dateFrom ? new Date(dateFrom) : null
    const toDate = dateTo ? (() => {
      const date = new Date(dateTo)
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

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const minutes = differenceInMinutes(end, start)
    
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours} giờ ${mins} phút`
    }
    return `${mins} phút`
  }

  const handlePrint = () => {
    const printContent = generatePrintContent()
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
    const csvContent = generateCSVContent()
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

  const generatePrintContent = () => {
    const currentDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: vi })
    const dateRange = dateFrom || dateTo 
      ? `(${dateFrom ? format(new Date(dateFrom), 'dd/MM/yyyy', { locale: vi }) : '...'} - ${dateTo ? format(new Date(dateTo), 'dd/MM/yyyy', { locale: vi }) : '...'})`
      : ''

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nhật ký sử dụng thiết bị - ${equipment.ten_thiet_bi}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 1cm;
          }
          
          body {
            font-family: 'Times New Roman', serif;
            font-size: 13px;
            line-height: 1.4;
            margin: 0;
            padding: 0;
            color: #000;
          }
          
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }

          .header-content {
            flex-grow: 1;
            text-align: center;
          }

          .header-logo {
            width: 80px;
            height: 80px;
          }

          .header-spacer {
            width: 80px;
            height: 80px;
          }

          /* Print footer styles */
          .print-footer {
            position: fixed;
            bottom: 1cm;
            left: 2cm;
            right: 2cm;
            width: calc(100% - 4cm);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
          }

          .content-body {
            padding-bottom: 30px; /* Space for footer */
          }
          
          .header h1 {
            font-size: 20px;
            font-weight: bold;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }
          
          .header h2 {
            font-size: 18px;
            margin: 0 0 5px 0;
          }
          
          .equipment-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid #ccc;
            background-color: #f9f9f9;
          }
          
          .info-item {
            display: flex;
            margin-bottom: 5px;
          }
          
          .info-label {
            font-weight: bold;
            min-width: 120px;
          }
          
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          .data-table th,
          .data-table td {
            border: 1px solid #000;
            padding: 6px 4px;
            text-align: left;
            vertical-align: top;
            font-size: 13px;
          }
          
          .data-table th {
            background-color: #f0f0f0;
            font-weight: bold;
            text-align: center;
          }
          
          .data-table td:nth-child(1) { width: 6%; } /* STT */
          .data-table td:nth-child(2) { width: 20%; } /* Người sử dụng */
          .data-table td:nth-child(3) { width: 15%; } /* Thời gian bắt đầu */
          .data-table td:nth-child(4) { width: 15%; } /* Thời gian kết thúc */
          .data-table td:nth-child(5) { width: 10%; } /* Thời lượng */
          .data-table td:nth-child(6) { width: 14%; } /* Trạng thái */
          .data-table td:nth-child(7) { width: 12%; } /* Ghi chú */
          
          .footer {
            margin-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 50px;
          }
          
          .signature-section {
            text-align: center;
          }
          
          .signature-title {
            font-weight: bold;
            margin-bottom: 50px;
          }
          
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 50px;
            padding-top: 5px;
          }
          
          .print-info {
            font-size: 11px;
            color: #666;
            text-align: right;
            margin-top: 20px;
          }
          
          .status-completed { color: #059669; }
          .status-active { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="content-body">
        <div class="header">
          <img src="https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png" alt="Logo CDC" class="header-logo" onerror="this.onerror=null;this.src='https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png';">
          <div class="header-content">
            <h2 style="font-size: 14px; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase;">TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ</h2>
            <h1>NHẬT KÝ SỬ DỤNG THIẾT BỊ</h1>
            <h2>${equipment.ten_thiet_bi}</h2>
            <div>Mã thiết bị: ${equipment.ma_thiet_bi} ${dateRange}</div>
          </div>
          <div class="header-spacer"></div>
        </div>
        
        <div class="equipment-info">
          <div>
            <div class="info-item">
              <span class="info-label">Tên thiết bị:</span>
              <span>${equipment.ten_thiet_bi}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Mã thiết bị:</span>
              <span>${equipment.ma_thiet_bi}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Khoa/Phòng:</span>
              <span>${equipment.khoa_phong_quan_ly || 'Chưa xác định'}</span>
            </div>
          </div>
          <div>
            <div class="info-item">
              <span class="info-label">Hãng sản xuất:</span>
              <span>${equipment.hang_san_xuat || 'Chưa có thông tin'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Model:</span>
              <span>${equipment.model || 'Chưa có thông tin'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tình trạng hiện tại:</span>
              <span>${equipment.tinh_trang_hien_tai || 'Chưa xác định'}</span>
            </div>
          </div>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Người sử dụng</th>
              <th>Thời gian bắt đầu</th>
              <th>Thời gian kết thúc</th>
              <th>Thời lượng</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${filteredLogs.map((log, index) => `
              <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>${log.nguoi_su_dung?.full_name || 'Không xác định'}</td>
                <td>${format(new Date(log.thoi_gian_bat_dau), 'dd/MM/yyyy HH:mm', { locale: vi })}</td>
                <td>${log.thoi_gian_ket_thuc ? format(new Date(log.thoi_gian_ket_thuc), 'dd/MM/yyyy HH:mm', { locale: vi }) : '-'}</td>
                <td>${formatDuration(log.thoi_gian_bat_dau, log.thoi_gian_ket_thuc)}</td>
                <td class="${log.trang_thai === 'dang_su_dung' ? 'status-active' : 'status-completed'}">
                  ${log.trang_thai === 'dang_su_dung' ? 'Đang sử dụng' : 'Hoàn thành'}
                </td>
                <td>${log.ghi_chu || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <div class="signature-section">
            <div class="signature-title">Người lập báo cáo</div>
            <div class="signature-line">Ký tên</div>
          </div>
          <div class="signature-section">
            <div class="signature-title">Phụ trách thiết bị</div>
            <div class="signature-line">Ký tên</div>
          </div>
        </div>
        
        <div class="print-info">
          In ngày: ${currentDate} | Tổng số bản ghi: ${filteredLogs.length}
        </div>
        </div>

        <!-- Footer -->
        <footer class="print-footer">
          <span>QLTB-BM.06</span>
          <span>BH.01 (05/2024)</span>
          <span>Trang: 1/1</span>
        </footer>
      </body>
      </html>
    `
  }

  const generateCSVContent = () => {
    const headers = [
      'STT',
      'Người sử dụng',
      'Khoa/Phòng',
      'Thời gian bắt đầu',
      'Thời gian kết thúc',
      'Thời lượng (phút)',
      'Tình trạng thiết bị',
      'Trạng thái',
      'Ghi chú'
    ]

    const rows = filteredLogs.map((log, index) => [
      index + 1,
      log.nguoi_su_dung?.full_name || 'Không xác định',
      log.nguoi_su_dung?.khoa_phong || '',
      format(new Date(log.thoi_gian_bat_dau), 'dd/MM/yyyy HH:mm', { locale: vi }),
      log.thoi_gian_ket_thuc ? format(new Date(log.thoi_gian_ket_thuc), 'dd/MM/yyyy HH:mm', { locale: vi }) : '',
      differenceInMinutes(
        log.thoi_gian_ket_thuc ? new Date(log.thoi_gian_ket_thuc) : new Date(),
        new Date(log.thoi_gian_bat_dau)
      ),
      log.tinh_trang_thiet_bi || '',
      log.trang_thai === 'dang_su_dung' ? 'Đang sử dụng' : 'Hoàn thành',
      log.ghi_chu || ''
    ])

    const csvContent = [
      `"Nhật ký sử dụng thiết bị: ${equipment.ten_thiet_bi}"`,
      `"Mã thiết bị: ${equipment.ma_thiet_bi}"`,
      `"Xuất ngày: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: vi })}"`,
      '',
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return '\uFEFF' + csvContent // Add BOM for UTF-8
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
