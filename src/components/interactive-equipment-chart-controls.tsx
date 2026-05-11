import * as React from "react"
import { Filter } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface EquipmentChartFiltersProps {
  viewType: "department" | "location"
  selectedFilter: string
  onFilterChange: (value: string) => void
  departments: string[]
  locations: string[]
  isLoading: boolean
}

export function EquipmentChartFilters({
  viewType,
  selectedFilter,
  onFilterChange,
  departments,
  locations,
  isLoading,
}: EquipmentChartFiltersProps) {
  const options = viewType === "department" ? departments : locations
  const placeholder = viewType === "department" ? "Tất cả khoa/phòng" : "Tất cả vị trí"

  return (
    <div className="flex items-center gap-2">
      <Filter className="size-4 text-muted-foreground" />
      <Select value={selectedFilter} onValueChange={onFilterChange} disabled={isLoading}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
