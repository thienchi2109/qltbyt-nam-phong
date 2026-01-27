/**
 * equipment-toolbar.tsx
 *
 * Unified toolbar for the equipment table with search, filters, and action buttons.
 * Contains DataTableFacetedFilter component and handles responsive layouts.
 */

"use client"

import * as React from "react"
import type { Column, Table, ColumnFiltersState } from "@tanstack/react-table"
import dynamic from "next/dynamic"
import {
  Check,
  Filter,
  FilterX,
  PlusCircle,
  Settings,
  ScanLine,
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
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import type { Equipment } from "@/types/database"

// Dynamic imports to avoid SSR issues with camera components
const QRScannerCamera = dynamic(
  () => import("@/components/qr-scanner-camera").then(mod => ({ default: mod.QRScannerCamera })),
  { 
    ssr: false,
    loading: () => null
  }
)

const QRActionSheet = dynamic(
  () => import("@/components/qr-action-sheet").then(mod => ({ default: mod.QRActionSheet })),
  { 
    ssr: false,
    loading: () => null
  }
)

/**
 * DataTableFacetedFilter - Faceted filter dropdown for table columns
 */
interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  options: {
    label: string
    value: string
  }[]
}

function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const selectedValues = new Set((column?.getFilterValue() as string[]) || [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 border-slate-200 shadow-sm transition-all",
            selectedValues?.size > 0
              ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
              : "hover:border-primary/30"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{title}</span>
            {selectedValues?.size > 0 && (
              <Badge
                variant="secondary"
                className="h-5 min-w-[20px] rounded-full bg-primary text-white px-1.5 text-xs font-semibold"
              >
                {selectedValues.size}
              </Badge>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[240px] max-h-[400px] overflow-hidden rounded-xl border border-slate-200 shadow-lg p-0"
        align="start"
      >
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm text-slate-900">{title}</span>
          </div>
        </div>

        {/* Options List */}
        <div className="max-h-[300px] overflow-y-auto py-1">
          {options.map((option) => {
            const isSelected = selectedValues.has(option.value)
            return (
              <button
                key={option.value}
                onClick={(e) => {
                  e.preventDefault()
                  if (isSelected) {
                    selectedValues.delete(option.value)
                  } else {
                    selectedValues.add(option.value)
                  }
                  const filterValues = Array.from(selectedValues)
                  column?.setFilterValue(
                    filterValues.length ? filterValues : undefined
                  )
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                  "hover:bg-slate-50 active:bg-slate-100",
                  isSelected && "bg-primary/5 hover:bg-primary/10"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-5 w-5 rounded border-2 transition-all shrink-0",
                  isSelected
                    ? "bg-primary border-primary"
                    : "border-slate-300 hover:border-primary/50"
                )}>
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </div>
                <span className={cn(
                  "truncate text-left flex-1",
                  isSelected ? "font-medium text-slate-900" : "text-slate-600"
                )}>
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer - Clear button */}
        {selectedValues.size > 0 && (
          <div className="border-t border-slate-100 p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => column?.setFilterValue(undefined)}
              className="w-full h-8 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              Xóa bộ lọc
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export interface EquipmentToolbarProps {
  table: Table<Equipment>
  searchTerm: string
  onSearchChange: (value: string) => void
  columnFilters: ColumnFiltersState
  isFiltered: boolean
  statuses: (string | null)[]
  departments: (string | null)[]
  users: (string | null)[]
  classifications: (string | null)[]
  fundingSources: (string | null)[]
  isMobile: boolean
  useTabletFilters: boolean
  isRegionalLeader: boolean
  hasFacilityFilter: boolean
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
  hasFacilityFilter,
  onOpenFilterSheet,
  onOpenColumnsDialog,
  onDownloadTemplate,
  onExportData,
  onAddEquipment,
  onImportEquipment,
  onClearFacilityFilter,
  onShowEquipmentDetails,
}: EquipmentToolbarProps) {
  const { toast } = useToast()
  
  // QR Scanner state
  const [isCameraActive, setIsCameraActive] = React.useState(false)
  const [scannedCode, setScannedCode] = React.useState<string>("")
  const [showActionSheet, setShowActionSheet] = React.useState(false)

  const handleStartScanning = () => {
    // Check if we're in browser environment
    if (typeof window === "undefined") {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Chức năng này chỉ hoạt động trên trình duyệt."
      })
      return
    }

    // Check if camera is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: "destructive",
        title: "Camera không được hỗ trợ",
        description: "Trình duyệt của bạn không hỗ trợ chức năng camera."
      })
      return
    }

    setIsCameraActive(true)
  }

  const handleScanSuccess = (result: string) => {
    setScannedCode(result)
    setIsCameraActive(false)
    setShowActionSheet(true)
    
    toast({
      title: "Quét thành công!",
      description: `Đã quét mã: ${result}`,
      duration: 3000,
    })
  }

  const handleCloseCamera = () => {
    setIsCameraActive(false)
  }

  const handleAction = (action: string, equipment?: Equipment) => {
    setShowActionSheet(false)
    setScannedCode("")

    if (action === 'view-details' && equipment && onShowEquipmentDetails) {
      onShowEquipmentDetails(equipment)
    }
    // Other actions can be handled by the parent component if needed
  }

  const handleCloseActionSheet = () => {
    setShowActionSheet(false)
    setScannedCode("")
  }

  return (
    <>
      {/* QR Scanner Camera */}
      {isCameraActive && (
        <QRScannerCamera
          onScanSuccess={handleScanSuccess}
          onClose={handleCloseCamera}
          isActive={isCameraActive}
        />
      )}

      {/* QR Action Sheet */}
      {showActionSheet && scannedCode && (
        <QRActionSheet
          qrCode={scannedCode}
          onClose={handleCloseActionSheet}
          onAction={handleAction}
        />
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
          {/* Left: search + filters */}
          <div className="order-1 w-full flex flex-col gap-2 md:flex-row md:flex-1 md:flex-wrap md:items-center md:gap-2 md:min-w-0">
            <div className="w-full md:w-auto md:min-w-[260px]">
              <div className="relative">
                <Input
                  placeholder="Tìm kiếm chung..."
                  value={searchTerm}
                  onChange={(event) => onSearchChange(event.target.value)}
                  className="h-8 w-full pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleStartScanning}
                  className="absolute right-0 top-0 h-8 w-8 hover:bg-primary/10"
                  title="Quét mã QR"
                >
                  <ScanLine className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </Button>
              </div>
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

                  {/* Mobile/Tablet Options button placed next to Filter */}
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
                      <DropdownMenuItem onSelect={onExportData}>
                        Tải về dữ liệu
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <DataTableFacetedFilter
                    column={table.getColumn("tinh_trang_hien_tai")}
                    title="Tình trạng"
                    options={statuses.map(s => ({label: s!, value: s!}))}
                  />
                  <DataTableFacetedFilter
                    column={table.getColumn("khoa_phong_quan_ly")}
                    title="Khoa/Phòng"
                    options={departments.filter((d): d is string => !!d).map(d => ({label: d, value: d}))}
                  />
                  <DataTableFacetedFilter
                    column={table.getColumn("nguoi_dang_truc_tiep_quan_ly")}
                    title="Người sử dụng"
                    options={users.filter((d): d is string => !!d).map(d => ({label: d, value: d}))}
                  />
                  <DataTableFacetedFilter
                    column={table.getColumn("phan_loai_theo_nd98")}
                    title="Phân loại"
                    options={classifications.filter((c): c is string => !!c).map(c => ({label: c, value: c}))}
                  />
                  <DataTableFacetedFilter
                    column={table.getColumn("nguon_kinh_phi")}
                    title="Nguồn kinh phí"
                    options={fundingSources.filter((f): f is string => !!f).map(f => ({label: f, value: f}))}
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

          {/* Right: actions only (tenant filter moved to header) */}
          <div className="order-3 w-full md:order-2 md:w-auto flex items-center gap-2 justify-between md:justify-end">
            {/* Add button - Desktop only */}
            {!isRegionalLeader && (
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

            {/* Options menu - Hidden on mobile */}
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
                <DropdownMenuItem onSelect={onExportData}>
                  Tải về dữ liệu
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  )
}
