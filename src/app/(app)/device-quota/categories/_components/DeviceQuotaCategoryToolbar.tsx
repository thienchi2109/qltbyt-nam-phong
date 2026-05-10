"use client"

import * as React from "react"
import { Download, PlusCircle, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { useToast } from "@/hooks/use-toast"
import { downloadCategoryImportTemplate } from "@/lib/category-excel"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"

export function DeviceQuotaCategoryToolbar() {
  const { openCreateDialog, openImportDialog, searchTerm, setSearchTerm } =
    useDeviceQuotaCategoryContext()
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

  const actions = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadTemplate}
        disabled={isDownloading}
      >
        <Download className="mr-2 size-4" />
        {isDownloading ? "Đang tải..." : "Tải mẫu Excel"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={openImportDialog}
      >
        <Upload className="mr-2 size-4" />
        Nhập từ Excel
      </Button>
      <Button onClick={openCreateDialog}>
        <PlusCircle className="mr-2 size-4" />
        Tạo danh mục
      </Button>
    </>
  )

  return (
    <ListFilterSearchCard
      surface="plain"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm theo mã, tên nhóm..."
      showSearchIcon={false}
      searchClassName="md:min-w-[220px] md:max-w-[320px]"
      actions={actions}
    />
  )
}
