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
import { Filter, PlusCircle, Settings, ScanLine } from "lucide-react"
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
import {
  EquipmentToolbarDesktopFilters,
  EquipmentToolbarDesktopLayout,
} from "./equipment-toolbar-layout"
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
  onShowEquipmentDetails,
}: EquipmentToolbarProps) {
  const qr = useQRScanner()
  const compactFilters = filterMode === "sheet"
  const { isFiltered } = filterState
  const { canCreateEquipment, isExporting = false } = actionState
  const searchPlaceholder = "Tìm kiếm chung..."
  const activeFilterCount = columnFilters.reduce((acc, filter) => {
    const vals = filter.value as string[] | undefined
    return acc + (vals?.length || 0)
  }, 0)

  const searchEndAddon = React.useMemo(
    () => (
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
    ),
    [qr.handleStartScanning]
  )

  const mobileFilterControl = React.useMemo(
    () => (
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
    ),
    [
      activeFilterCount,
      isExporting,
      isFiltered,
      onDownloadTemplate,
      onExportData,
      onOpenColumnsDialog,
      onOpenFilterSheet,
    ]
  )

  const actions = React.useMemo(
    () => (
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
    ),
    [
      canCreateEquipment,
      isExporting,
      onAddEquipment,
      onDownloadTemplate,
      onExportData,
      onImportEquipment,
      onOpenColumnsDialog,
    ]
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

      {compactFilters ? (
        <ListFilterSearchCard
          title={title}
          description={description}
          tenantControl={tenantControl}
          searchValue={searchTerm}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          searchEndAddon={searchEndAddon}
          showSearchIcon={false}
          mobileFilterControl={mobileFilterControl}
          compactFilters
          selectionActions={selectionActions}
          actions={actions}
        />
      ) : (
        <EquipmentToolbarDesktopLayout
          title={title}
          description={description}
          searchValue={searchTerm}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          searchEndAddon={searchEndAddon}
          selectionActions={selectionActions}
          actions={actions}
        >
          <EquipmentToolbarDesktopFilters
            table={table}
            tenantControl={tenantControl}
            statuses={statuses}
            departments={departments}
            users={users}
            classifications={classifications}
            fundingSources={fundingSources}
            isFiltered={isFiltered}
          />
        </EquipmentToolbarDesktopLayout>
      )}
    </>
  )
}
