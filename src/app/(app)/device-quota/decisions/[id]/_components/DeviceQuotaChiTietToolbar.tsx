"use client"

import * as React from "react"
import { ArrowLeft, Download, Upload, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useDeviceQuotaChiTietContext } from "../_hooks/useDeviceQuotaChiTietContext"
import { generateDeviceQuotaImportTemplate } from "@/lib/device-quota-excel"

/**
 * Helper: Format date to DD/MM/YYYY
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  try {
    const [year, month, day] = dateStr.split("-")
    return `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}

/**
 * Helper: Status Badge
 */
function StatusBadge({ status }: { status: 'draft' | 'active' | 'inactive' }) {
  const variants = {
    draft: { variant: "outline" as const, label: "Bản nháp", className: "border-gray-400 text-gray-700" },
    active: { variant: "default" as const, label: "Đang hiệu lực", className: "bg-green-600 hover:bg-green-700" },
    inactive: { variant: "outline" as const, label: "Hết hiệu lực", className: "border-gray-400 text-gray-600" },
  }

  const config = variants[status] || variants.draft

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

/**
 * Toolbar for Device Quota Decision Detail page.
 * Features:
 * - Back button to decisions list
 * - Download template button (draft only)
 * - Import from Excel button (draft only)
 * - Decision status badge
 */
export function DeviceQuotaChiTietToolbar() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    decision,
    isDecisionLoading,
    leafCategories,
    isCategoriesLoading,
    openImportDialog,
  } = useDeviceQuotaChiTietContext()

  const [isDownloading, setIsDownloading] = React.useState(false)

  const isDraft = decision?.trang_thai === 'draft'

  // Handle download template
  const handleDownloadTemplate = React.useCallback(async () => {
    if (!leafCategories || leafCategories.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có danh mục",
        description: "Không có danh mục thiết bị để tạo file mẫu.",
      })
      return
    }

    setIsDownloading(true)
    try {
      // Generate template
      const blob = await generateDeviceQuotaImportTemplate(leafCategories)

      // Trigger download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Mau_Dinh_Muc_${decision?.so_quyet_dinh || 'Template'}_${new Date().getTime()}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Thành công",
        description: "Đã tải xuống file mẫu định mức.",
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định'
      toast({
        variant: "destructive",
        title: "Lỗi tải xuống",
        description: "Không thể tạo file mẫu. " + errorMessage,
      })
    } finally {
      setIsDownloading(false)
    }
  }, [leafCategories, decision, toast])

  return (
    <div className="space-y-4">
      {/* Decision Header with Back Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left: Back button and decision info */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/device-quota/decisions')}
            aria-label="Quay lại danh sách quyết định"
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">
              {isDecisionLoading ? "Đang tải..." : decision?.so_quyet_dinh || "Không tìm thấy"}
            </h2>
            {decision && (
              <p className="text-sm text-muted-foreground">
                Ngày ban hành: {formatDate(decision.ngay_ban_hanh)} |
                Hiệu lực: {formatDate(decision.ngay_hieu_luc)}
              </p>
            )}
          </div>
        </div>

        {/* Right: Status badge */}
        <div>
          {decision && <StatusBadge status={decision.trang_thai} />}
        </div>
      </div>

      {/* Action Buttons (Draft only) */}
      {isDraft && (
        <div className="space-y-2">
          {/* Alert when no categories available */}
          {!isCategoriesLoading && leafCategories.length === 0 && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <AlertDescription className="text-amber-800">
                Chưa có danh mục thiết bị. Vui lòng{" "}
                <Link
                  href="/device-quota/categories"
                  className="underline font-medium hover:text-amber-900"
                >
                  tạo danh mục
                </Link>{" "}
                trước khi nhập định mức.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={isDownloading || isCategoriesLoading || !leafCategories || leafCategories.length === 0}
              className="h-9 w-full sm:w-auto"
              aria-label="Tải xuống file mẫu Excel định mức"
            >
              <Download className="mr-2 h-4 w-4" />
              Tải mẫu Excel
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={openImportDialog}
              disabled={isCategoriesLoading || !leafCategories || leafCategories.length === 0}
              className="h-9 w-full sm:w-auto"
              aria-label="Nhập định mức từ file Excel"
            >
              <Upload className="mr-2 h-4 w-4" />
              Nhập từ Excel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
