'use client'

import React, { useState, useMemo } from 'react'
import { startOfDay, endOfDay } from 'date-fns'
import { 
  Activity, 
  Calendar, 
  Clock, 
  Filter, 
  Search, 
  User,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Eye,
  ChevronDown,
  Download,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { HydrationSafeRelativeTime } from '@/components/time/HydrationSafeRelativeTime'

import { 
  useAuditLogs, 
  useAuditLogsStats,
  useAuditLogsRecentSummary,
  AuditLogFilters,
  getActionTypeLabel,
  ACTION_TYPE_LABELS
} from '@/hooks/use-audit-logs'
import { ActivityLogEntry } from './activity-log-entry'

interface ActivityLogsViewerProps {
  className?: string
}

export function ActivityLogsViewer({ className }: ActivityLogsViewerProps) {
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 50,
    offset: 0,
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDateRange, setSelectedDateRange] = useState<{
    from?: Date
    to?: Date
  }>({})

  // Fetch data
  const { 
    data: auditLogs = [], 
    isLoading, 
    error, 
    refetch 
  } = useAuditLogs(filters)

  const { 
    data: recentSummary = [], 
    isLoading: isSummaryLoading 
  } = useAuditLogsRecentSummary()

  const { 
    data: stats = [], 
    isLoading: isStatsLoading 
  } = useAuditLogsStats({
    date_from: selectedDateRange.from ? selectedDateRange.from.toISOString() : null,
    date_to: selectedDateRange.to ? selectedDateRange.to.toISOString() : null,
  })


  // Memoized filtered data for client-side search
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return auditLogs
    
    const term = searchTerm.trim().toLowerCase()
    return auditLogs.filter((log) => {
      const adminUsername = (log.admin_username ?? '').toLowerCase()
      const adminFullName = (log.admin_full_name ?? '').toLowerCase()
      const actionType = getActionTypeLabel(log.action_type).toLowerCase()
      const targetUsername = (log.target_username ?? '').toLowerCase()
      const targetFullName = (log.target_full_name ?? '').toLowerCase()
      
      return (
        adminUsername.includes(term) ||
        adminFullName.includes(term) ||
        actionType.includes(term) ||
        targetUsername.includes(term) ||
        targetFullName.includes(term)
      )
    })
  }, [auditLogs, searchTerm])

  // Get summary data
  const summary = recentSummary[0]

  // Handle filter changes
  const updateFilters = (newFilters: Partial<AuditLogFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, offset: 0 }))
  }

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    setSelectedDateRange(range)
    updateFilters({
      date_from: range.from ? startOfDay(range.from).toISOString() : null,
      date_to: range.to ? endOfDay(range.to).toISOString() : null,
    })
  }

  const handlePagination = (direction: 'prev' | 'next') => {
    const newOffset = direction === 'next' 
      ? (filters.offset || 0) + (filters.limit || 50)
      : Math.max(0, (filters.offset || 0) - (filters.limit || 50))
    
    setFilters(prev => ({ ...prev, offset: newOffset }))
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Activity className="size-4 text-blue-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Hoạt động 24h</p>
                <p className="text-2xl font-bold">
                  {isSummaryLoading ? '…' : (summary?.total_activities || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <User className="size-4 text-green-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Người dùng hoạt động</p>
                <p className="text-2xl font-bold">
                  {isSummaryLoading ? '…' : (summary?.unique_users || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="size-4 text-orange-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Hoạt động phổ biến</p>
                <p className="text-sm font-semibold truncate">
                  {isSummaryLoading ? '…' : getActionTypeLabel(summary?.top_action_type || 'N/A')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="size-4 text-purple-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Hoạt động gần nhất</p>
                <p className="text-sm font-semibold">
                  {isSummaryLoading || !summary?.latest_activity 
                    ? '…'
                    : <HydrationSafeRelativeTime value={summary.latest_activity} />
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
            <CardTitle className="flex items-center space-x-2">
              <Filter className="size-5" />
              <span>Bộ lọc và tìm kiếm</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
              <Input
                placeholder="Tìm kiếm người dùng, hoạt động…"
                value={searchTerm}
                onChange={(e) => {
                  const v = e.target.value
                  setSearchTerm(v)
                  updateFilters({ text_search: v || null })
                }}
                className="pl-10"
              />
            </div>

            {/* Entity Type Filter */}
            <Select
              value={filters.entity_type || 'all'}
              onValueChange={(value) => updateFilters({ 
                entity_type: value === 'all'
                  ? null
                  : value as NonNullable<AuditLogFilters['entity_type']>
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Đối tượng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả đối tượng</SelectItem>
                <SelectItem value="device">Thiết bị</SelectItem>
                <SelectItem value="repair_request">Yêu cầu sửa chữa</SelectItem>
                <SelectItem value="transfer_request">Yêu cầu luân chuyển</SelectItem>
                <SelectItem value="maintenance_plan">Kế hoạch bảo trì</SelectItem>
                <SelectItem value="user">Người dùng</SelectItem>
              </SelectContent>
            </Select>

            {/* Action Type Filter */}
            <Select
              value={filters.action_type || 'all'}
              onValueChange={(value) => updateFilters({ 
                action_type: value === 'all' ? null : value 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Loại hoạt động" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả hoạt động</SelectItem>
                {Object.entries(ACTION_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range Picker */}
            <DatePickerWithRange
              date={selectedDateRange}
              setDate={handleDateRangeChange}
              placeholder="Chọn khoảng thời gian"
              className="w-full"
            />

            {/* Page Size */}
            <Select
              value={String(filters.limit || 50)}
              onValueChange={(value) => updateFilters({ limit: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 mục</SelectItem>
                <SelectItem value="50">50 mục</SelectItem>
                <SelectItem value="100">100 mục</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="size-5" />
              <span>Nhật ký hoạt động</span>
              <Badge variant="secondary">
                {filteredLogs.length > 0 ? filteredLogs[0].total_count : 0} mục
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex items-center justify-center py-8 text-red-600">
              <AlertCircle className="size-5 mr-2" />
              <span>Lỗi tải dữ liệu: {error.message}</span>
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-4 p-4 border rounded-lg animate-pulse">
                  <div className="size-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Activity className="size-8 mx-auto mb-2 opacity-50" />
              <p>Không có hoạt động nào được tìm thấy</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-1">
                {filteredLogs.map((log) => (
                  <ActivityLogEntry key={log.id} log={log} />
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          {filteredLogs.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Hiển thị {(filters.offset || 0) + 1} - {Math.min((filters.offset || 0) + filteredLogs.length, filteredLogs[0]?.total_count || 0)} trong tổng số {filteredLogs[0]?.total_count || 0} mục
              </p>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePagination('prev')}
                  disabled={(filters.offset || 0) === 0}
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePagination('next')}
                  disabled={(filters.offset || 0) + filteredLogs.length >= (filteredLogs[0]?.total_count || 0)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
