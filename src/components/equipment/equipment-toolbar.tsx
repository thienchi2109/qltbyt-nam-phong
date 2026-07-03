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
import {
  Building2,
  Filter,
  FilterX,
  ListFilter,
  PlusCircle,
  Settings,
  ScanLine,
  Tags,
  UserRound,
  WalletCards,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { FacetedMultiSelectFilter } from "@/components/shared/table-filters/FacetedMultiSelectFilter"
import { useQRScanner } from "./useEquipmentQRScanner"
import type { Equipment } from "@/types/database"

const QRScannerCamera = dynamic(
  () => import("@/components/qr-scanner-camera").then((mod) => ({ default: mod.QRScannerCamera })),
  { ssr: false, loading: () => null }
)

const QRActionSheet = dynamic(
  () => import("@/components/qr-action-sheet").then((mod) => ({ default: mod.QRActionSheet })),
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

/** Renders the equipment page search, command filters, actions, and QR scanner controls. */
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
  const overflowFilterCount = columnFilters.reduce((acc, filter) => {
    if (filter.id !== "nguoi_dang_truc_tiep_quan_ly" && filter.id !== "nguon_kinh_phi") {
      return acc
    }
    const vals = filter.value as string[] | undefined
    return acc + (vals?.length || 0)
  }, 0)

  const searchEndAddon = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={qr.handleStartScanning}
      className="size-8 hover:bg-primary/10"
      title="Quét mã QR"
      aria-label="Quét mã QR"
    >
      <ScanLine className="size-4 text-muted-foreground hover:text-primary" />
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
        <Filter className="size-4 mr-2" />
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
            <Settings className="size-4 mr-2" />
            Tùy chọn
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={onOpenColumnsDialog}>Hiện/ẩn cột</DropdownMenuItem>
          <DropdownMenuItem onSelect={onDownloadTemplate}>Tải Excel mẫu</DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportData} disabled={isExporting}>
            {isExporting ? "Đang tải..." : "Tải về dữ liệu"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )

  const filterControls = (
    <div
      data-testid="equipment-command-filter-row"
      data-layout="command-overflow"
      className="flex min-w-0 flex-wrap items-center gap-2"
    >
      <FacetedMultiSelectFilter
        column={table.getColumn("tinh_trang_hien_tai")}
        title="Tình trạng"
        options={statuses.map((s) => ({ label: s, value: s }))}
        triggerVariant="command"
        triggerIcon={<Filter className="size-3.5" aria-hidden="true" />}
      />
      <FacetedMultiSelectFilter
        column={table.getColumn("khoa_phong_quan_ly")}
        title="Khoa/Phòng"
        options={departments.map((d) => ({ label: d, value: d }))}
        triggerVariant="command"
        triggerIcon={<Building2 className="size-3.5" aria-hidden="true" />}
      />
      <FacetedMultiSelectFilter
        column={table.getColumn("phan_loai_theo_nd98")}
        title="Phân loại"
        options={classifications.map((c) => ({ label: c, value: c }))}
        triggerVariant="command"
        triggerIcon={<Tags className="size-3.5" aria-hidden="true" />}
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 min-w-[112px] justify-between rounded-lg border-slate-200 bg-slate-100/80 px-3 shadow-none transition-all hover:border-primary/30 hover:bg-slate-100"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                <ListFilter className="size-3.5" aria-hidden="true" />
              </span>
              <span className="truncate font-medium">Bộ lọc</span>
            </span>
            {overflowFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-[20px] rounded-full bg-primary px-1.5 text-xs font-semibold text-white"
              >
                {overflowFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2 p-2">
          <FacetedMultiSelectFilter
            column={table.getColumn("nguoi_dang_truc_tiep_quan_ly")}
            title="Người sử dụng"
            options={users.map((d) => ({ label: d, value: d }))}
            triggerVariant="command"
            triggerIcon={<UserRound className="size-3.5" aria-hidden="true" />}
          />
          <FacetedMultiSelectFilter
            column={table.getColumn("nguon_kinh_phi")}
            title="Nguồn kinh phí"
            options={fundingSources.map((f) => ({ label: f, value: f }))}
            triggerVariant="command"
            triggerIcon={<WalletCards className="size-3.5" aria-hidden="true" />}
          />
        </PopoverContent>
      </Popover>
      {isFiltered && (
        <Button
          variant="ghost"
          onClick={() => table.resetColumnFilters()}
          className="h-9 rounded-lg px-2 text-muted-foreground hover:bg-slate-100 hover:text-foreground lg:px-3"
        >
          <FilterX className="size-4" aria-hidden="true" />
          <span className="ml-1.5 text-sm font-medium">Xóa</span>
        </Button>
      )}
      {hasFacilityFilter && (
        <Button variant="ghost" onClick={onClearFacilityFilter} className="h-8 px-2 lg:px-3">
          <span className="hidden sm:inline">Xóa lọc cơ sở</span>
          <FilterX className="size-4 sm:ml-2" />
        </Button>
      )}
    </div>
  )

  const actions = (
    <>
      {canCreateEquipment && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="hidden md:flex h-8 gap-1 touch-target-sm md:h-8">
              <PlusCircle className="size-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Thêm thiết bị</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onAddEquipment}>Thêm thủ công</DropdownMenuItem>
            <DropdownMenuItem onSelect={onImportEquipment}>Nhập từ Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="hidden lg:flex h-8 gap-1 touch-target-sm md:h-8">
            <Settings className="size-3.5" />
            Tùy chọn
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={onOpenColumnsDialog}>Hiện/ẩn cột</DropdownMenuItem>
          <DropdownMenuItem onSelect={onDownloadTemplate}>Tải Excel mẫu</DropdownMenuItem>
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
