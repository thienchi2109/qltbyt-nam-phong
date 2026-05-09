"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { TenantSelector } from "@/components/shared/TenantSelector"

export type PlanFiltersBarProps = {
  showFacilityFilter: boolean
  totalCount: number

  searchTerm: string
  onSearchChange: (value: string) => void

  isRegionalLeader: boolean
}

export function PlanFiltersBar({
  showFacilityFilter,
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
            <AlertTriangle className="size-5 text-blue-600 mt-0.5" />
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

      <ListFilterSearchCard
        tenantControl={showFacilityFilter ? <TenantSelector className="w-full" /> : undefined}
        surface="plain"
        searchValue={searchTerm}
        onSearchChange={onSearchChange}
        searchPlaceholder="Tìm kiếm theo tên kế hoạch, khoa/phòng, người lập..."
        showSearchIcon={false}
        searchClassName="md:min-w-[280px] md:max-w-[420px]"
        actions={(
          <Badge variant="outline" className="shrink-0">
            {totalCount} kế hoạch
          </Badge>
        )}
        className="mb-4"
      />
    </>
  )
}
