"use client"

import * as React from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDeviceQuotaDecisionsContext } from "../_hooks/useDeviceQuotaDecisionsContext"
import type { StatusFilter } from "./DeviceQuotaDecisionsContext"

// Status filter options
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'active', label: 'Đang hiệu lực' },
  { value: 'inactive', label: 'Hết hiệu lực' },
]

/**
 * Toolbar for Device Quota Decisions page.
 * Features:
 * - Status filter dropdown
 * - Create decision button
 * - Refresh button
 */
export function DeviceQuotaDecisionsToolbar() {
  const {
    statusFilter,
    setStatusFilter,
    openCreateDialog,
    refetch,
    isLoading,
  } = useDeviceQuotaDecisionsContext()

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      {/* Left: Filter controls */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="h-9"
          aria-label="Làm mới dữ liệu"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="ml-2 hidden sm:inline">Làm mới</span>
        </Button>
      </div>

      {/* Right: Create button */}
      <Button
        onClick={openCreateDialog}
        size="sm"
        className="h-9 w-full sm:w-auto"
      >
        <Plus className="mr-2 h-4 w-4" />
        Tạo quyết định
      </Button>
    </div>
  )
}
