"use client"

import * as React from "react"
import { BookOpenText, Download, PlusCircle, Upload } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { useToast } from "@/hooks/use-toast"
import { downloadCategoryImportTemplate } from "@/lib/category-excel"
import { isEquipmentManagerRole } from "@/lib/rbac"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"

/** Renders category search and permission-gated manager actions. */
export function DeviceQuotaCategoryToolbar() {
  const {
    canManageCategories,
    openCreateDialog,
    openImportDialog,
    searchTerm,
    setSearchTerm,
    user,
  } = useDeviceQuotaCategoryContext()
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

  const canOpenDraftCatalog = isEquipmentManagerRole(user?.role)
  const actions =
    canManageCategories || canOpenDraftCatalog ? (
      <>
        {canOpenDraftCatalog ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/device-quota/categories/draft-catalog">
              <BookOpenText className="mr-2 size-4" />
              Soạn danh mục dự thảo
            </Link>
          </Button>
        ) : null}
        {canManageCategories ? (
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
            <Button variant="outline" size="sm" onClick={openImportDialog}>
              <Upload className="mr-2 size-4" />
              Nhập từ Excel
            </Button>
            <Button onClick={openCreateDialog}>
              <PlusCircle className="mr-2 size-4" />
              Tạo danh mục
            </Button>
          </>
        ) : null}
      </>
    ) : undefined

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
