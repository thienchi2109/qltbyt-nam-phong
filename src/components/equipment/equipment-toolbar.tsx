/**
 * equipment-toolbar.tsx
 *
 * Unified toolbar for the equipment table with search, filters, and action buttons.
 * Uses shared FacetedMultiSelectFilter and extracted useQRScanner hook.
 */

"use client"

import * as React from "react"
import type { Table, ColumnFiltersState } from "@tanstack/react-table"
import dynamic from "next/dynamic"
import { Filter, FilterX, PlusCircle, Settings, ScanLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { FacetedMultiSelectFilter } from "@/components/shared/table-filters/FacetedMultiSelectFilter"
import { useQRScanner } from "./useEquipmentQRScanner"
import type { Equipment } from "@/types/database"

const QRScannerCamera = dynamic(
  () => import("@/components/qr-scanner-camera").then(mod => ({ default: mod.QRScannerCamera })),
  { ssr: false, loading: () => null }
)

const QRActionSheet = dynamic(
  () => import("@/components/qr-action-sheet").then(mod => ({ default: mod.QRActionSheet })),
  { ssr: false, loading: () => null }
)

export interface EquipmentToolbarProps {
  table: Table<Equipment>
  title?: React.ReactNode
  description?: React.ReactNode
  tenantControl?: React.ReactNode
  searchTerm: string
  onSearchChange: (value: string) => void
  columnFilters: ColumnFiltersState
  statuses: string[]
  departments: string[]
  users: string[]
  classifications: string[]
  fundingSources: string[]
  filterMode: "faceted" | "sheet"
  filterState: {
    isFiltered: boolean
    hasFacilityFilter: boolean
  }
  actionState: {
    canCreateEquipment: boolean
    isExporting?: boolean
  }
  selectionActions?: React.ReactNode
  onOpenFilterSheet: () => void
  onOpenColumnsDialog: () => void
  onDownloadTemplate: () => void
  onExportData: () => void
  onAddEquipment: () => void
  onImportEquipment: () => void
  onClearFacilityFilter: () => void
  onShowEquipmentDetails?: (equipment: Equipment) => void
}

export function EquipmentToolbar({
  table,
  title,
  description,
  tenantControl,
  searchTerm,
  onSearchChange,
  columnFilters,
  statuses,
  departments,
  users,
  classifications,
  fundingSources,
  filterMode,
  filterState,
  actionState,
  selectionActions,
  onOpenFilterSheet,
  onOpenColumnsDialog,
  onDownloadTemplate,
  onExportData,
  onAddEquipment,
  onImportEquipment,
  onClearFacilityFilter,
  onShowEquipmentDetails,
}: EquipmentToolbarProps) {
  const qr = useQRScanner()
  const compactFilters = filterMode === "sheet"
  const { isFiltered, hasFacilityFilter } = filterState
  const { canCreateEquipment, isExporting = false } = actionState
  const activeFilterCount = columnFilters.reduce((acc, filter) => {
    const vals = filter.value as string[] | undefined
    return acc + (vals?.length || 0)
  }, 0)

  const searchEndAddon = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={qr.handleStartScanning}
      className="h-8 w-8 hover:bg-primary/10"
      title="Quét mã QR"
      aria-label="Quét mã QR"
    >
      <ScanLine className="h-4 w-4 text-muted-foreground hover:text-primary" />
    </Button>
  )

  const mobileFilterControl = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenFilterSheet}
        className={cn(
          "h-9 border-slate-200 shadow-sm transition-all",
          isFiltered
            ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
            : "hover:border-primary/30"
        )}
      >
        <Filter className="h-4 w-4 mr-2" />
        <span className="font-medium">Lọc</span>
        {isFiltered && (
          <Badge
            variant="secondary"
            className="ml-2 h-5 min-w-[20px] rounded-full bg-primary text-white px-1.5 text-xs font-semibold"
          >
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Settings className="h-4 w-4 mr-2" />
            Tùy chọn
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={onOpenColumnsDialog}>
            Hiện/ẩn cột
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDownloadTemplate}>
            Tải Excel mẫu
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportData} disabled={isExporting}>
            {isExporting ? "Đang tải..." : "Tải về dữ liệu"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )

  const filterControls = (
    <>
      <FacetedMultiSelectFilter
        column={table.getColumn("tinh_trang_hien_tai")}
        title="Tình trạng"
        options={statuses.map(s => ({ label: s, value: s }))}
      />
      <FacetedMultiSelectFilter
        column={table.getColumn("khoa_phong_quan_ly")}
        title="Khoa/Phòng"
        options={departments.map(d => ({ label: d, value: d }))}
      />
      <FacetedMultiSelectFilter
        column={table.getColumn("nguoi_dang_truc_tiep_quan_ly")}
        title="Người sử dụng"
        options={users.map(d => ({ label: d, value: d }))}
      />
      <FacetedMultiSelectFilter
        column={table.getColumn("phan_loai_theo_nd98")}
        title="Phân loại"
        options={classifications.map(c => ({ label: c, value: c }))}
      />
      <FacetedMultiSelectFilter
        column={table.getColumn("nguon_kinh_phi")}
        title="Nguồn kinh phí"
        options={fundingSources.map(f => ({ label: f, value: f }))}
      />
      {isFiltered && (
        <Button
          variant="ghost"
          onClick={() => table.resetColumnFilters()}
          className="h-8 px-2 lg:px-3"
        >
          <span className="hidden sm:inline">Xóa tất cả</span>
          <FilterX className="h-4 w-4 sm:ml-2" />
        </Button>
      )}
      {hasFacilityFilter && (
        <Button
          variant="ghost"
          onClick={onClearFacilityFilter}
          className="h-8 px-2 lg:px-3"
        >
          <span className="hidden sm:inline">Xóa lọc cơ sở</span>
          <FilterX className="h-4 w-4 sm:ml-2" />
        </Button>
      )}
    </>
  )

  const actions = (
    <>
      {canCreateEquipment && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="hidden md:flex h-8 gap-1 touch-target-sm md:h-8">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Thêm thiết bị
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onAddEquipment}>
              Thêm thủ công
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onImportEquipment}>
              Nhập từ Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="hidden lg:flex h-8 gap-1 touch-target-sm md:h-8">
            <Settings className="h-3.5 w-3.5" />
            Tùy chọn
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={onOpenColumnsDialog}>
            Hiện/ẩn cột
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDownloadTemplate}>
            Tải Excel mẫu
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportData} disabled={isExporting}>
            {isExporting ? "Đang tải..." : "Tải về dữ liệu"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )

  return (
    <>
      {/* QR Scanner Camera */}
      {qr.isCameraActive && (
        <QRScannerCamera
          onScanSuccess={qr.handleScanSuccess}
          onClose={qr.handleCloseCamera}
          isActive={qr.isCameraActive}
        />
      )}

      {/* QR Action Sheet */}
      {qr.showActionSheet && qr.scannedCode && (
        <QRActionSheet
          qrCode={qr.scannedCode}
          onClose={qr.handleCloseActionSheet}
          onAction={(action: string, equipment?: Equipment) =>
            qr.handleAction(action, equipment, onShowEquipmentDetails)
          }
        />
      )}

      <ListFilterSearchCard
        title={title}
        description={description}
        tenantControl={tenantControl}
        searchValue={searchTerm}
        onSearchChange={onSearchChange}
        searchPlaceholder="Tìm kiếm chung..."
        searchEndAddon={searchEndAddon}
        showSearchIcon={false}
        filterControls={filterControls}
        mobileFilterControl={mobileFilterControl}
        compactFilters={compactFilters}
        selectionActions={selectionActions}
        actions={actions}
      />
    </>
  )
}
