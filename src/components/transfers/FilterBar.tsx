/**
 * FilterBar Component for Transfer Kanban
 * Provides comprehensive filtering: assignee, type, status, date range, search
 */

import * as React from 'react'
import { Search, X, Calendar, User, Tag, Filter as FilterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { TransferKanbanFilters } from '@/types/transfer-kanban'
import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'

// ============================================================================
// Types
// ============================================================================

interface FilterBarProps {
  filters: TransferKanbanFilters
  onFiltersChange: (filters: TransferKanbanFilters) => void
  facilityId?: number // Current facility for assignee lookup
}

interface Assignee {
  id: number
  ho_ten: string
  email: string | null
}

// ============================================================================
// Component
// ============================================================================

export function FilterBar({ filters, onFiltersChange, facilityId }: FilterBarProps) {
  const [searchInput, setSearchInput] = React.useState(filters.searchText || '')
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false)

  // Debounce search input
  const searchTimeoutRef = React.useRef<NodeJS.Timeout>()
  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      if (searchInput !== filters.searchText) {
        onFiltersChange({ ...filters, searchText: searchInput || undefined })
      }
    }, 300)
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchInput])

  // Fetch assignees for current facility
  const { data: assignees = [] } = useQuery<Assignee[]>({
    queryKey: ['equipment_users_list_for_tenant', facilityId],
    queryFn: async () => {
      if (!facilityId) return []
      try {
        const result = await callRpc<Assignee[]>({
          fn: 'equipment_users_list_for_tenant',
          args: { p_don_vi: facilityId },
        })
        return result || []
      } catch (error) {
        console.error('Failed to fetch assignees:', error)
        return []
      }
    },
    enabled: !!facilityId,
    staleTime: 5 * 60_000, // 5 minutes
  })

  // Calculate active filter count
  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (filters.assigneeIds && filters.assigneeIds.length > 0) count++
    if (filters.types && filters.types.length > 0) count++
    if (filters.statuses && filters.statuses.length > 0) count++
    if (filters.dateFrom || filters.dateTo) count++
    if (filters.searchText) count++
    return count
  }, [filters])

  // Clear user-applied filters but preserve smart defaults (30-day window + safety limit)
  const handleClearFilters = () => {
    setSearchInput('')
    
    // Reset to smart defaults instead of clearing everything
    // This prevents global/regional_leader users from accidentally loading unbounded historical data
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    onFiltersChange({
      dateFrom: thirtyDaysAgo.toISOString().split('T')[0], // Preserve 30-day smart default
      limit: 500, // Preserve safety net
      // Clear user-applied filters: assigneeIds, types, statuses, searchText, dateTo, facilityIds
    })
  }

  // Toggle type filter
  const handleToggleType = (type: 'noi_bo' | 'ben_ngoai') => {
    const current = filters.types || []
    const next = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    onFiltersChange({ ...filters, types: next.length > 0 ? next : undefined })
  }

  // Toggle status filter
  const handleToggleStatus = (
    status: 'cho_duyet' | 'da_duyet' | 'dang_luan_chuyen' | 'da_ban_giao' | 'hoan_thanh'
  ) => {
    const current = filters.statuses || []
    const next = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status]
    onFiltersChange({ ...filters, statuses: next.length > 0 ? next : undefined })
  }

  // Set assignee filter
  const handleSetAssignee = (assigneeId: string) => {
    if (assigneeId === 'all') {
      onFiltersChange({ ...filters, assigneeIds: undefined })
    } else {
      onFiltersChange({ ...filters, assigneeIds: [parseInt(assigneeId)] })
    }
  }

  // Set date range
  const handleSetDateFrom = (date: string) => {
    onFiltersChange({ ...filters, dateFrom: date || undefined })
  }

  const handleSetDateTo = (date: string) => {
    onFiltersChange({ ...filters, dateTo: date || undefined })
  }

  // Check if we're at the default 30-day window (within 1 day tolerance for date comparisons)
  const isAtDefaultDateWindow = React.useMemo(() => {
    if (!filters.dateFrom || filters.dateTo) return false
    
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const defaultDateStr = thirtyDaysAgo.toISOString().split('T')[0]
    
    // Allow 1 day tolerance (user might have cleared filters at different times)
    const filterDate = new Date(filters.dateFrom)
    const defaultDate = new Date(defaultDateStr)
    const diffDays = Math.abs((filterDate.getTime() - defaultDate.getTime()) / (1000 * 60 * 60 * 24))
    
    return diffDays <= 1
  }, [filters.dateFrom, filters.dateTo])

  return (
    <div className="space-y-3">
      {/* Search Bar with Date Range Hint */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm mã yêu cầu, tên thiết bị, lý do..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Date Range Info Badge - shows when at default 30-day window */}
        {isAtDefaultDateWindow && (
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs font-normal text-muted-foreground border-dashed">
            <Calendar className="h-3.5 w-3.5" />
            <span>Hiển thị: 30 ngày gần đây</span>
          </Badge>
        )}

        {/* Advanced Filters Popover */}
        <Popover open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FilterIcon className="h-4 w-4" />
              Lọc
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[400px] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Bộ lọc nâng cao</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Xóa tất cả
                </Button>
              )}
            </div>

            {/* Assignee Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                Người yêu cầu
              </Label>
              <Select
                value={filters.assigneeIds?.[0]?.toString() || 'all'}
                onValueChange={handleSetAssignee}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả người yêu cầu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {assignees.map((assignee) => (
                    <SelectItem key={assignee.id} value={assignee.id.toString()}>
                      {assignee.ho_ten}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-2">
                <Tag className="h-3.5 w-3.5" />
                Loại hình
              </Label>
              <div className="flex gap-2">
                <Button
                  variant={filters.types?.includes('noi_bo') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleType('noi_bo')}
                  className="flex-1"
                >
                  Nội bộ
                </Button>
                <Button
                  variant={filters.types?.includes('ben_ngoai') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleType('ben_ngoai')}
                  className="flex-1"
                >
                  Bên ngoài
                </Button>
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Trạng thái</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'cho_duyet' as const, label: 'Chờ duyệt' },
                  { value: 'da_duyet' as const, label: 'Đã duyệt' },
                  { value: 'dang_luan_chuyen' as const, label: 'Đang LC' },
                  { value: 'da_ban_giao' as const, label: 'Đã BG' },
                  { value: 'hoan_thanh' as const, label: 'Hoàn thành' },
                ].map((status) => (
                  <Button
                    key={status.value}
                    variant={filters.statuses?.includes(status.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleStatus(status.value)}
                    className="text-xs"
                  >
                    {status.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Khoảng thời gian
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Từ ngày</Label>
                  <Input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => handleSetDateFrom(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Đến ngày</Label>
                  <Input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => handleSetDateTo(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Đang lọc:</span>
          
          {filters.searchText && (
            <Badge variant="secondary" className="gap-1">
              <Search className="h-3 w-3" />
              {filters.searchText.slice(0, 20)}
              {filters.searchText.length > 20 && '...'}
              <button
                onClick={() => {
                  setSearchInput('')
                  onFiltersChange({ ...filters, searchText: undefined })
                }}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.assigneeIds && filters.assigneeIds.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <User className="h-3 w-3" />
              {assignees.find(a => a.id === filters.assigneeIds![0])?.ho_ten || 'Người yêu cầu'}
              <button
                onClick={() => onFiltersChange({ ...filters, assigneeIds: undefined })}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.types && filters.types.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Tag className="h-3 w-3" />
              {filters.types.map(t => t === 'noi_bo' ? 'Nội bộ' : 'Bên ngoài').join(', ')}
              <button
                onClick={() => onFiltersChange({ ...filters, types: undefined })}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.statuses && filters.statuses.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              {filters.statuses.length} trạng thái
              <button
                onClick={() => onFiltersChange({ ...filters, statuses: undefined })}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {(filters.dateFrom || filters.dateTo) && (
            <Badge variant="secondary" className="gap-1">
              <Calendar className="h-3 w-3" />
              {filters.dateFrom && new Date(filters.dateFrom).toLocaleDateString('vi-VN')}
              {filters.dateFrom && filters.dateTo && ' - '}
              {filters.dateTo && new Date(filters.dateTo).toLocaleDateString('vi-VN')}
              <button
                onClick={() => onFiltersChange({ 
                  ...filters, 
                  dateFrom: undefined,
                  dateTo: undefined 
                })}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Xóa tất cả
          </Button>
        </div>
      )}
    </div>
  )
}
