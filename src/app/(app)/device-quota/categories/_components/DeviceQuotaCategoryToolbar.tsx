"use client"

import * as React from "react"
import { Download, PlusCircle, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { downloadCategoryImportTemplate } from "@/lib/category-excel"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"

export function DeviceQuotaCategoryToolbar() {
  const { openCreateDialog, openImportDialog } = useDeviceQuotaCategoryContext()
  const { toast } = useToast()
  const [isDownloading, setIsDownloading] = React.useState(false)

  const handleDownloadTemplate = async () => {
    setIsDownloading(true)
    try {
      await downloadCategoryImportTemplate()
    } catch (error) {
      console.error("Failed to download template:", error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải file mẫu. Vui lòng thử lại.",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          disabled={isDownloading}
        >
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? "Đang tải..." : "Tải mẫu Excel"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={openImportDialog}
        >
          <Upload className="mr-2 h-4 w-4" />
          Nhập từ Excel
        </Button>
        <Button onClick={openCreateDialog}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Tạo danh mục
        </Button>
      </div>
    </div>
  )
}
