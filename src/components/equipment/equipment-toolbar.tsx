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
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import {
  EquipmentToolbarDesktopFilters,
  EquipmentToolbarDesktopLayout,
} from "./equipment-toolbar-layout"
import { EquipmentHeroButton, EquipmentHeroDropdown } from "./heroui-pilot/controls"
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
      <span title="Quét mã QR" className="inline-flex">
        <EquipmentHeroButton
          type="button"
          variant="ghost"
          size="sm"
          isIconOnly
          onPress={qr.handleStartScanning}
          className="size-8 hover:bg-primary/10"
          aria-label="Quét mã QR"
        >
          <ScanLine className="size-4 text-muted-foreground hover:text-primary" />
        </EquipmentHeroButton>
      </span>
    ),
    [qr.handleStartScanning]
  )

  const mobileFilterControl = React.useMemo(
    () => (
      <div data-testid="equipment-compact-filter-actions" className="grid w-full grid-cols-2 gap-2">
        <EquipmentHeroButton
          type="button"
          variant="ghost"
          size="sm"
          onPress={onOpenFilterSheet}
          data-testid="equipment-heroui-compact-filter-trigger"
          className={cn(
            "h-9 w-full justify-center border-slate-200 shadow-sm transition-all",
            isFiltered
              ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
              : "hover:border-primary/30"
          )}
        >
          <Filter className="size-4 mr-2" />
          <span className="font-medium">Lọc</span>
          {isFiltered && (
            <span className="ml-2 h-5 min-w-[20px] rounded-full bg-primary text-white px-1.5 text-xs font-semibold">
              {activeFilterCount}
            </span>
          )}
        </EquipmentHeroButton>

        <EquipmentHeroDropdown
          ariaLabel="Tùy chọn"
          placement="bottom start"
          trigger={
            <>
              <Settings className="size-4" />
              Tùy chọn
            </>
          }
          triggerClassName="h-9 w-full justify-center gap-2"
          items={[
            {
              id: "columns",
              label: "Hiện/ẩn cột",
              textValue: "Hiện/ẩn cột",
              onAction: onOpenColumnsDialog,
            },
            {
              id: "template",
              label: "Tải Excel mẫu",
              textValue: "Tải Excel mẫu",
              onAction: onDownloadTemplate,
            },
            {
              id: "export",
              label: isExporting ? "Đang tải..." : "Tải về dữ liệu",
              textValue: isExporting ? "Đang tải..." : "Tải về dữ liệu",
              onAction: onExportData,
              isDisabled: isExporting,
            },
          ]}
        />
      </div>
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
          <EquipmentHeroDropdown
            ariaLabel="Thêm thiết bị"
            trigger={
              <>
                <PlusCircle className="size-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Thêm thiết bị</span>
              </>
            }
            triggerClassName="hidden h-8 gap-1 border-transparent bg-primary text-primary-foreground hover:bg-primary/90 md:inline-flex touch-target-sm md:h-8"
            items={[
              {
                id: "manual",
                label: "Thêm thủ công",
                textValue: "Thêm thủ công",
                onAction: onAddEquipment,
              },
              {
                id: "excel",
                label: "Nhập từ Excel",
                textValue: "Nhập từ Excel",
                onAction: onImportEquipment,
              },
            ]}
          />
        )}

        <EquipmentHeroDropdown
          ariaLabel="Tùy chọn"
          trigger={
            <>
              <Settings className="size-3.5" />
              Tùy chọn
            </>
          }
          triggerClassName="hidden h-8 gap-1 lg:inline-flex touch-target-sm md:h-8"
          items={[
            {
              id: "columns",
              label: "Hiện/ẩn cột",
              textValue: "Hiện/ẩn cột",
              onAction: onOpenColumnsDialog,
            },
            {
              id: "template",
              label: "Tải Excel mẫu",
              textValue: "Tải Excel mẫu",
              onAction: onDownloadTemplate,
            },
            {
              id: "export",
              label: isExporting ? "Đang tải..." : "Tải về dữ liệu",
              textValue: isExporting ? "Đang tải..." : "Tải về dữ liệu",
              onAction: onExportData,
              isDisabled: isExporting,
            },
          ]}
        />
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
