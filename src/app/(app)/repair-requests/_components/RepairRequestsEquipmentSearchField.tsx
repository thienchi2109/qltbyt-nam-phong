"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { EquipmentSelectItem } from "../types"

interface RepairRequestsEquipmentSearchFieldProps {
  searchQuery: string
  selectedEquipment: EquipmentSelectItem | null
  filteredEquipment: EquipmentSelectItem[]
  shouldShowNoResults: boolean
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSelectEquipment: (equipment: EquipmentSelectItem) => void
}

export function RepairRequestsEquipmentSearchField({
  searchQuery,
  selectedEquipment,
  filteredEquipment,
  shouldShowNoResults,
  onSearchChange,
  onSelectEquipment,
}: RepairRequestsEquipmentSearchFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="search-equipment">Thiết bị</Label>
      <div className="relative">
        <Input
          id="search-equipment"
          placeholder="Nhập tên hoặc mã để tìm kiếm..."
          value={searchQuery}
          onChange={onSearchChange}
          autoComplete="off"
          required
        />
        {filteredEquipment.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
            <div className="p-1">
              {filteredEquipment.map((equipment) => (
                <button
                  key={equipment.id}
                  type="button"
                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm mobile-interactive touch-target-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onSelectEquipment(equipment)}
                >
                  <div className="font-medium">{equipment.ten_thiet_bi}</div>
                  <div className="text-xs text-muted-foreground">
                    {equipment.ma_thiet_bi}
                    {equipment.khoa_phong_quan_ly && (
                      <span className="ml-2 text-blue-600">• {equipment.khoa_phong_quan_ly}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {shouldShowNoResults && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-3 shadow-lg">
            <div className="text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả phù hợp
            </div>
          </div>
        )}
      </div>
      {selectedEquipment && (
        <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-green-600" />
          <span>
            Đã chọn: {selectedEquipment.ten_thiet_bi} ({selectedEquipment.ma_thiet_bi})
          </span>
        </p>
      )}
    </div>
  )
}
