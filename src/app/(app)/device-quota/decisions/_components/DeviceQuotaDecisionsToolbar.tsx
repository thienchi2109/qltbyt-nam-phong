"use client"

import * as React from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
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

  const filterControls = (
    <>
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
    </>
  )

  const actions = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => refetch()}
        disabled={isLoading}
        className="h-9"
        aria-label="Làm mới dữ liệu"
      >
        <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
        <span className="ml-2 hidden sm:inline">Làm mới</span>
      </Button>

      <Button
        onClick={openCreateDialog}
        size="sm"
        className="h-9 w-full sm:w-auto"
      >
        <Plus className="mr-2 size-4" />
        Tạo quyết định
      </Button>
    </>
  )

  return (
    <ListFilterSearchCard
      surface="plain"
      filterControls={filterControls}
      actions={actions}
    />
  )
}
