"use client"

import * as React from "react"
import { FileText, Printer, Download, Eye, Edit3 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { type TransferRequest } from "@/types/database"

interface HandoverPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transfer: TransferRequest | null
}

interface HandoverData {
  department: string
  handoverDate: string
  reason: string
  requestCode: string
  giverName: string
  directorName: string
  receiverName: string
  device: {
    code: string
    name: string
    model: string
    serial: string
    condition: string
    accessories: string
    note: string
  }
}

export function HandoverPreviewDialog({ open, onOpenChange, transfer }: HandoverPreviewDialogProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = React.useState(false)
  const [handoverData, setHandoverData] = React.useState<HandoverData | null>(null)
  const [isPrinting, setIsPrinting] = React.useState(false)
  const [isPreviewing, setIsPreviewing] = React.useState(false)

  React.useEffect(() => {
    if (open && transfer?.thiet_bi) {
      // Auto-fill data from transfer request
      const formatValue = (value: string | number | null | undefined) => String(value ?? "")

      const data: HandoverData = {
        department: formatValue(transfer.khoa_phong_hien_tai || "Tổ QLTB"),
        handoverDate: new Date().toLocaleDateString('vi-VN'),
        reason: formatValue(transfer.ly_do_luan_chuyen),
        requestCode: formatValue(transfer.ma_yeu_cau),
        giverName: transfer.khoa_phong_hien_tai === "Tổ QLTB"
          ? "Đại diện Tổ QLTB"
          : `Đại diện ${transfer.khoa_phong_hien_tai}`,
        directorName: "", // Default empty for manual entry
        receiverName: transfer.khoa_phong_nhan === "Tổ QLTB"
          ? "Đại diện Tổ QLTB"
          : `Đại diện ${transfer.khoa_phong_nhan}`,
        device: {
          code: formatValue(transfer.thiet_bi.ma_thiet_bi),
          name: formatValue(transfer.thiet_bi.ten_thiet_bi),
          model: formatValue(transfer.thiet_bi.model),
          serial: formatValue(transfer.thiet_bi.serial_number),
          condition: formatValue(transfer.thiet_bi.tinh_trang),
          accessories: "", // Default empty for manual entry
          note: "" // Default empty for manual entry
        }
      }

      setHandoverData(data)

      // Show tips for new users
      if (isEditing) {
        toast({
          title: "💡 Mẹo sử dụng",
          description: "Sử dụng Ctrl+E để chuyển đổi chế độ, Ctrl+P để in nhanh",
          duration: 3000,
        })
      }
    }
  }, [open, transfer, isEditing, toast])

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return

      // Ctrl+P for print
      if (event.ctrlKey && event.key === 'p') {
        event.preventDefault()
        handlePrint()
      }
      // Ctrl+E for edit toggle
      if (event.ctrlKey && event.key === 'e') {
        event.preventDefault()
        setIsEditing(!isEditing)
      }
      // Ctrl+Shift+P for preview
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        event.preventDefault()
        handlePreview()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, isEditing])

  const handleInputChange = (field: string, value: string) => {
    if (!handoverData) return

    if (field.startsWith('device.')) {
      const deviceField = field.replace('device.', '')
      setHandoverData({
        ...handoverData,
        device: {
          ...handoverData.device,
          [deviceField]: value
        }
      })
    } else {
      setHandoverData({
        ...handoverData,
        [field]: value
      })
    }
  }

  const validateHandoverData = (data: HandoverData): { isValid: boolean; missingFields: string[] } => {
    const missingFields: string[] = []

    if (!data.department?.trim()) missingFields.push('Khoa/Phòng lập')
    if (!data.reason?.trim()) missingFields.push('Lý do bàn giao')
    if (!data.giverName?.trim()) missingFields.push('Đại diện bên giao')
    if (!data.receiverName?.trim()) missingFields.push('Đại diện bên nhận')
    // Note: directorName is optional, not required for validation

    return {
      isValid: missingFields.length === 0,
      missingFields
    }
  }

  const handlePrint = async () => {
    if (!handoverData) return

    // Validate required fields
    const validation = validateHandoverData(handoverData)
    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: "⚠️ Thiếu thông tin bắt buộc",
        description: `Vui lòng điền đầy đủ: ${validation.missingFields.join(', ')}`,
      })
      setIsEditing(true) // Switch to edit mode to fill missing info
      return
    }

    setIsPrinting(true)
    try {
      const htmlContent = generateHandoverHTML(handoverData)
      const newWindow = window.open("", "_blank")

      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(htmlContent)
        newWindow.document.close()

        // Auto print after loading
        newWindow.onload = () => {
          setTimeout(() => {
            newWindow.print()

            // Close dialog after printing
            setTimeout(() => {
              onOpenChange(false)
            }, 1000)
          }, 500)
        }

        toast({
          title: "✅ Thành công",
          description: "Đã mở cửa sổ in phiếu bàn giao. Dialog sẽ tự động đóng sau khi in.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "🚫 Bị chặn popup",
          description: "Vui lòng cho phép popup để sử dụng tính năng in. Kiểm tra thanh địa chỉ trình duyệt.",
        })
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi in phiếu",
        description: getUnknownErrorMessage(error, "Có lỗi không xác định xảy ra khi in phiếu.")
      })
    } finally {
      setIsPrinting(false)
    }
  }

  const handlePreview = async () => {
    if (!handoverData) return

    setIsPreviewing(true)
    try {
      const htmlContent = generateHandoverHTML(handoverData)
      const newWindow = window.open("", "_blank")

      if (newWindow) {
        newWindow.document.open()
        newWindow.document.write(htmlContent)
        newWindow.document.close()

        toast({
          title: "👁️ Xem trước",
          description: "Đã mở cửa sổ xem trước phiếu bàn giao.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "🚫 Bị chặn popup",
          description: "Vui lòng cho phép popup để xem trước. Kiểm tra cài đặt trình duyệt.",
        })
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "❌ Lỗi xem trước",
        description: getUnknownErrorMessage(error, "Có lỗi không xác định xảy ra khi xem trước phiếu.")
      })
    } finally {
      setIsPreviewing(false)
    }
  }

  const generateHandoverHTML = (data: HandoverData) => {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Biên Bản Bàn Giao Thiết Bị</title>
    <style>
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 13px;
            color: #000;
            background-color: #e5e7eb;
            line-height: 1.4;
            margin: 0;
            padding: 0;
        }

        .a4-landscape-page {
            width: 29.7cm;
            min-height: 21cm;
            padding: 1cm 2cm 1cm 1cm;
            margin: 1cm auto;
            background: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            position: relative;
            display: flex;
            flex-direction: column;
        }

        .content-body {
            flex-grow: 1;
        }

        .form-input-line {
            font-family: inherit;
            font-size: inherit;
            border: none;
            border-bottom: 1px dotted #000;
            background-color: transparent;
            padding: 2px 1px;
            outline: none;
            width: 100%;
            min-height: 1.1em;
        }

        .form-input-readonly {
            border-bottom: 1px solid #000;
            font-weight: 500;
        }

        .editable-cell {
            border-bottom: 1px solid #ccc !important;
            background-color: #f9f9f9;
            cursor: text;
            min-height: 18px;
            padding: 3px 4px !important;
        }

        .editable-cell:focus {
            background-color: #fff;
            border-bottom: 1px solid #007bff !important;
            outline: none;
        }

        .editable-cell:empty:before {
            content: attr(data-placeholder);
            color: #999;
            font-style: italic;
        }

        .font-bold { font-weight: 700; }
        .title-main { font-size: 20px; }
        .title-sub { font-size: 16px; }
        .text-center { text-align: center; }
        .uppercase { text-transform: uppercase; }
        .italic { font-style: italic; }
        .whitespace-nowrap { white-space: nowrap; }

        .flex { display: flex; }
        .items-center { align-items: center; }
        .items-baseline { align-items: baseline; }
        .items-start { align-items: flex-start; }
        .justify-between { justify-content: space-between; }
        .justify-around { justify-content: space-around; }
        .flex-grow { flex-grow: 1; }

        .mt-3 { margin-top: 0.4rem; }
        .mt-4 { margin-top: 0.5rem; }
        .mt-8 { margin-top: 1rem; }
        .ml-2 { margin-left: 0.5rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .space-y-2 > * + * { margin-top: 0.3rem; }

        .w-14 { width: 3.5rem; }
        .w-full { width: 100%; }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 3px;
            text-align: center;
            vertical-align: middle;
            word-wrap: break-word;
        }

        .data-table th {
            background-color: #f8f9fa;
            font-weight: bold;
        }

        .data-table .col-stt { width: 2%; }
        .data-table .col-code { width: 7%; }
        .data-table .col-name { width: 16%; text-align: left; }
        .data-table .col-model { width: 10%; }
        .data-table .col-serial { width: 10%; }
        .data-table .col-accessories { width: 18%; text-align: center; }
        .data-table .col-condition { width: 15%; }
        .data-table .col-note { width: 12%; }

        .signature-area {
            text-align: center;
            min-width: 180px;
        }

        .signature-space {
            height: 50px;
            border-bottom: 1px solid #ddd;
            margin: 8px 0;
        }

        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background-color: #fff !important;
                font-size: 11px;
            }

            .a4-landscape-page {
                width: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                padding: 1cm 1.2cm 1cm 1cm !important;
                box-shadow: none !important;
                border: none !important;
                page-break-inside: avoid;
            }

            body > *:not(.a4-landscape-page) {
                display: none !important;
            }

            .data-table {
                font-size: 13px;
            }

            .data-table th, .data-table td {
                padding: 3px;
            }

            .data-table thead {
                display: table-header-group;
            }

            .data-table tr, .signature-area {
                page-break-inside: avoid;
            }

            .print-footer {
                position: fixed;
                bottom: 0.4cm;
                left: 0.6cm;
                right: 0.6cm;
                width: calc(100% - 1.2cm);
            }

            .content-body {
                padding-bottom: 35px;
            }

            .editable-cell {
                background-color: transparent !important;
                border-bottom: 1px solid #000 !important;
            }

            .title-main { font-size: 16px; }
            .title-sub { font-size: 13px; }
            .signature-space { height: 40px; }
        }

        @media (max-width: 768px) {
            .a4-landscape-page {
                width: 100%;
                margin: 0;
                padding: 0.4cm;
                box-shadow: none;
            }

            .title-main { font-size: 16px; }
            .title-sub { font-size: 12px; }
            .data-table { font-size: 9px; }
            .data-table th, .data-table td { padding: 2px 1px; }
        }

        .edit-instruction {
            font-size: 10px;
            color: #666;
            font-style: italic;
            margin-top: 6px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="a4-landscape-page">
        <div class="content-body">
            <header class="text-center">
                <div class="flex justify-between items-start">
                    <div class="text-center">
                        <img src="https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png"
                             alt="Logo CDC"
                             class="w-14 mx-auto mb-1"
                             onerror="this.style.display='none';">
                    </div>
                    <div class="flex-grow">
                        <h2 class="title-sub uppercase font-bold">TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ CẦN THƠ</h2>
                        <h1 class="title-main uppercase mt-3 font-bold">BIÊN BẢN BÀN GIAO THIẾT BỊ</h1>
                    </div>
                    <div class="w-14"></div>
                </div>
            </header>

            <section class="mt-4 space-y-2">
                <div class="flex items-baseline">
                    <label class="whitespace-nowrap">Khoa/Phòng lập:</label>
                    <div class="form-input-line form-input-readonly ml-2">${data.department}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="whitespace-nowrap">Ngày nhận/giao:</label>
                    <div class="form-input-line form-input-readonly ml-2">${data.handoverDate}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="whitespace-nowrap">Lý do nhận bàn giao:</label>
                    <div class="form-input-line form-input-readonly ml-2">${data.reason}</div>
                </div>
                <div class="flex items-baseline">
                    <label class="whitespace-nowrap">Mã yêu cầu:</label>
                    <div class="form-input-line form-input-readonly ml-2">${data.requestCode}</div>
                </div>
            </section>

            <section class="mt-3">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="col-stt">STT</th>
                            <th class="col-code">Mã thiết bị</th>
                            <th class="col-name">Tên thiết bị</th>
                            <th class="col-model">Model</th>
                            <th class="col-serial">Serial</th>
                            <th class="col-accessories">Tài liệu/phụ kiện kèm theo (nếu có)</th>
                            <th class="col-condition">Tình trạng khi nhận/giao</th>
                            <th class="col-note">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="col-stt">1</td>
                            <td class="col-code">${data.device.code}</td>
                            <td class="col-name">${data.device.name}</td>
                            <td class="col-model">${data.device.model}</td>
                            <td class="col-serial">${data.device.serial}</td>
                            <td class="col-accessories">${data.device.accessories}</td>
                            <td class="col-condition">${data.device.condition}</td>
                            <td class="col-note">${data.device.note}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section class="mt-8">
                <div class="flex justify-around">
                    <div class="signature-area">
                        <p class="font-bold">Đại diện bên giao</p>
                        <p class="italic">(Ký, ghi rõ họ tên)</p>
                        <div class="signature-space"></div>
                        <div class="font-bold">${data.giverName}</div>
                    </div>
                    <div class="signature-area">
                        <p class="font-bold">Ban Giám đốc</p>
                        <p class="italic">(Ký, ghi rõ họ tên)</p>
                        <div class="signature-space"></div>
                        <div class="font-bold">${data.directorName}</div>
                    </div>
                    <div class="signature-area">
                        <p class="font-bold">Đại diện bên nhận</p>
                        <p class="italic">(Ký, ghi rõ họ tên)</p>
                        <div class="signature-space"></div>
                        <div class="font-bold">${data.receiverName}</div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</body>
</html>`
  }

  if (!transfer || !handoverData) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Xem trước phiếu bàn giao - {transfer.ma_yeu_cau}
          </DialogTitle>
          <DialogDescription>
            Xem trước và chỉnh sửa thông tin trước khi xuất phiếu bàn giao thiết bị
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-auto space-y-6">
          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{transfer.loai_hinh === 'noi_bo' ? 'Nội bộ' : 'Bên ngoài'}</Badge>
              <Badge variant="secondary">{transfer.thiet_bi?.ma_thiet_bi}</Badge>
            </div>
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      <Edit3 className="size-4 mr-1" />
                      {isEditing ? 'Xem' : 'Sửa'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Chuyển đổi chế độ chỉnh sửa (Ctrl+E)</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreview}
                      disabled={isPreviewing || isPrinting}
                    >
                      <Eye className="size-4 mr-1" />
                      {isPreviewing ? 'Đang xử lý...' : 'Xem trước'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Xem trước phiếu bàn giao (Ctrl+Shift+P)</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handlePrint}
                      disabled={isPrinting || isPreviewing}
                    >
                      <Printer className="size-4 mr-1" />
                      {isPrinting ? 'Đang in...' : 'In phiếu'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>In phiếu bàn giao (Ctrl+P)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          <Separator />

          {/* Editable Form */}
          {isEditing ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Khoa/Phòng lập</Label>
                  <Input
                    id="department"
                    value={handoverData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="handoverDate">Ngày bàn giao</Label>
                  <Input
                    id="handoverDate"
                    value={handoverData.handoverDate}
                    onChange={(e) => handleInputChange('handoverDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Lý do bàn giao</Label>
                <Textarea
                  id="reason"
                  value={handoverData.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="giverName">Đại diện bên giao</Label>
                  <Input
                    id="giverName"
                    value={handoverData.giverName}
                    onChange={(e) => handleInputChange('giverName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="directorName">Ban Giám đốc</Label>
                  <Input
                    id="directorName"
                    value={handoverData.directorName}
                    onChange={(e) => handleInputChange('directorName', e.target.value)}
                    placeholder="Tên Ban Giám đốc (tùy chọn)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverName">Đại diện bên nhận</Label>
                  <Input
                    id="receiverName"
                    value={handoverData.receiverName}
                    onChange={(e) => handleInputChange('receiverName', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Thông tin thiết bị</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accessories">Tài liệu/Phụ kiện kèm theo</Label>
                    <Textarea
                      id="accessories"
                      value={handoverData.device.accessories}
                      onChange={(e) => handleInputChange('device.accessories', e.target.value)}
                      placeholder="Nhập tài liệu, phụ kiện kèm theo…"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note">Ghi chú</Label>
                    <Textarea
                      id="note"
                      value={handoverData.device.note}
                      onChange={(e) => handleInputChange('device.note', e.target.value)}
                      placeholder="Nhập ghi chú…"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Preview Mode */
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Thông tin bàn giao</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Khoa/Phòng:</span> {handoverData.department}</div>
                  <div><span className="font-medium">Ngày:</span> {handoverData.handoverDate}</div>
                  <div className="md:col-span-2"><span className="font-medium">Lý do:</span> {handoverData.reason}</div>
                  <div><span className="font-medium">Bên giao:</span> {handoverData.giverName}</div>
                  <div><span className="font-medium">Ban Giám đốc:</span> {handoverData.directorName || 'Chưa nhập'}</div>
                  <div><span className="font-medium">Bên nhận:</span> {handoverData.receiverName}</div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Thông tin thiết bị</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Mã TB:</span> {handoverData.device.code}</div>
                  <div><span className="font-medium">Tên TB:</span> {handoverData.device.name}</div>
                  <div><span className="font-medium">Model:</span> {handoverData.device.model}</div>
                  <div><span className="font-medium">Serial:</span> {handoverData.device.serial}</div>
                  <div><span className="font-medium">Tình trạng:</span> {handoverData.device.condition}</div>
                  <div className="md:col-span-2">
                    <span className="font-medium">Phụ kiện:</span> {handoverData.device.accessories || 'Chưa nhập'}
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-medium">Ghi chú:</span> {handoverData.device.note || 'Chưa có'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Keyboard shortcuts info */}
        <div className="pt-4 border-t text-xs text-muted-foreground">
          <p className="flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl+E</kbd> Chỉnh sửa</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl+P</kbd> In phiếu</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl+Shift+P</kbd> Xem trước</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd> Đóng</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
