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
import { SearchInput } from "@/components/shared/SearchInput"
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
  searchTerm: string
  onSearchChange: (value: string) => void
  columnFilters: ColumnFiltersState
  isFiltered: boolean
  statuses: string[]
  departments: string[]
  users: string[]
  classifications: string[]
  fundingSources: string[]
  isMobile: boolean
  useTabletFilters: boolean
  isRegionalLeader: boolean
  canCreateEquipment: boolean
  hasFacilityFilter: boolean
  /** Whether export is currently in progress */
  isExporting?: boolean
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
  searchTerm,
  onSearchChange,
  columnFilters,
  isFiltered,
  statuses,
  departments,
  users,
  classifications,
  fundingSources,
  isMobile,
  useTabletFilters,
  isRegionalLeader,
  canCreateEquipment,
  hasFacilityFilter,
  isExporting = false,
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

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
          {/* Left: search + filters */}
          <div className="order-1 w-full flex flex-col gap-2 md:flex-row md:flex-1 md:flex-wrap md:items-center md:gap-2 md:min-w-0">
            <div className="w-full md:w-auto md:min-w-[260px]">
              <SearchInput
                placeholder="Tìm kiếm chung..."
                value={searchTerm}
                onChange={onSearchChange}
                showSearchIcon={false}
                className="h-8 w-full"
                endAddon={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={qr.handleStartScanning}
                    className="h-8 w-8 hover:bg-primary/10"
                    title="Quét mã QR"
                  >
                    <ScanLine className="h-4 w-4 text-muted-foreground hover:text-primary" />
                  </Button>
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {(isMobile || useTabletFilters) ? (
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
                        {columnFilters.reduce((acc, filter) => {
                          const vals = filter.value as string[] | undefined
                          return acc + (vals?.length || 0)
                        }, 0)}
                      </Badge>
                    )}
                  </Button>

                  {/* Mobile/Tablet Options button */}
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
              ) : (
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
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="order-3 w-full md:order-2 md:w-auto flex items-center gap-2 justify-between md:justify-end">
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
          </div>
        </div>
      </div>
    </>
  )
}
