"use client"

import { AlertTriangle, Building2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type PlanFiltersBarProps = {
  // Facility filter
  showFacilityFilter: boolean
  facilities: Array<{ id: number; name: string }>
  selectedFacilityId: number | null
  onFacilityChange: (id: number | null) => void
  isLoadingFacilities: boolean
  totalCount: number

  // Search
  searchTerm: string
  onSearchChange: (value: string) => void

  // Regional leader banner
  isRegionalLeader: boolean
}

export function PlanFiltersBar({
  showFacilityFilter,
  facilities,
  selectedFacilityId,
  onFacilityChange,
  isLoadingFacilities,
  totalCount,
  searchTerm,
  onSearchChange,
  isRegionalLeader,
}: PlanFiltersBarProps) {
  return (
    <>
      {/* Regional Leader Info Banner */}
      {isRegionalLeader && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900">Chế độ xem của Sở Y tế</h4>
              <p className="text-sm text-blue-700 mt-1">
                Đang xem kế hoạch bảo trì thiết bị của tất cả cơ sở y tế trực thuộc trên địa bàn.
                Sở Y tế có thể xem chi tiết nhưng không được phép tạo, sửa, hoặc duyệt kế hoạch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Facility Filter */}
      {showFacilityFilter && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select
              value={selectedFacilityId?.toString() || "all"}
              onValueChange={(value) => onFacilityChange(value === "all" ? null : parseInt(value, 10))}
              disabled={isLoadingFacilities || facilities.length === 0}
            >
              <SelectTrigger className="h-9 border-dashed">
                <SelectValue placeholder={isLoadingFacilities ? "Đang tải..." : "Chọn cơ sở..."} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>Tất cả cơ sở</span>
                  </div>
                </SelectItem>
                {facilities.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    <span className="text-muted-foreground italic">Không có cơ sở</span>
                  </SelectItem>
                ) : (
                  facilities.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id.toString()}>
                      <span className="truncate">{facility.name}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedFacilityId && (
            <Badge variant="secondary" className="shrink-0">
              {totalCount} kế hoạch
            </Badge>
          )}
          {!selectedFacilityId && (
            <Badge variant="outline" className="shrink-0">
              {facilities.length} cơ sở • {totalCount} kế hoạch
            </Badge>
          )}
        </div>
      )}

      {/* Search Section */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Tìm kiếm theo tên kế hoạch, khoa/phòng, người lập..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-sm"
          />
        </div>
        {searchTerm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4 mr-1" />
            Xóa tìm kiếm
          </Button>
        )}
      </div>
    </>
  )
}
