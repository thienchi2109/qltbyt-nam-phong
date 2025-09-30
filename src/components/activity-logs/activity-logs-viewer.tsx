'use client'

import React, { useState, useMemo } from 'react'
import { format, formatDistanceToNow, startOfDay, endOfDay } from 'date-fns'
import { vi } from 'date-fns/locale'
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
  MapPin
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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

import { 
  useAuditLogs, 
  useAuditLogsStats,
  useAuditLogsRecentSummary,
  AuditLogEntry,
  AuditLogFilters,
  getActionTypeLabel,
  formatActionDetails,
  ACTION_TYPE_LABELS
} from '@/hooks/use-audit-logs'

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
              <Activity className="h-4 w-4 text-blue-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Hoạt động 24h</p>
                <p className="text-2xl font-bold">
                  {isSummaryLoading ? '...' : (summary?.total_activities || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-green-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Người dùng hoạt động</p>
                <p className="text-2xl font-bold">
                  {isSummaryLoading ? '...' : (summary?.unique_users || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Hoạt động phổ biến</p>
                <p className="text-sm font-semibold truncate">
                  {isSummaryLoading ? '...' : getActionTypeLabel(summary?.top_action_type || 'N/A')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">Hoạt động gần nhất</p>
                <p className="text-sm font-semibold">
                  {isSummaryLoading || !summary?.latest_activity 
                    ? '...' 
                    : formatDistanceToNow(new Date(summary.latest_activity), { 
                        addSuffix: true, 
                        locale: vi 
                      })
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
              <Filter className="h-5 w-5" />
              <span>Bộ lọc và tìm kiếm</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Tìm kiếm người dùng, hoạt động..."
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
                entity_type: (value === 'all' ? null : (value as any)) 
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
              <Eye className="h-5 w-5" />
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
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>Lỗi tải dữ liệu: {error.message}</span>
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-4 p-4 border rounded-lg animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
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
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Không có hoạt động nào được tìm thấy</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-1">
                {filteredLogs.map((log, index) => (
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

// Activity Log Entry Component
interface ActivityLogEntryProps {
  log: AuditLogEntry
}

function ActivityLogEntry({ log }: ActivityLogEntryProps) {
  const actionLabel = getActionTypeLabel(log.action_type)
  const actionDetails = formatActionDetails(log.action_type, log.action_details)
  
  // Get action type color
  const getActionTypeColor = (actionType: string) => {
    if (actionType.includes('create')) return 'bg-green-100 text-green-800'
    if (actionType.includes('update')) return 'bg-blue-100 text-blue-800'
    if (actionType.includes('delete')) return 'bg-red-100 text-red-800'
    if (actionType.includes('approve')) return 'bg-purple-100 text-purple-800'
    if (actionType.includes('password')) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
      {/* User Avatar */}
      <Avatar className="h-10 w-10">
        <AvatarFallback>
          {log.admin_full_name
            ? log.admin_full_name.split(' ').map(n => n[0]).join('').substring(0, 2)
            : log.admin_username.substring(0, 2).toUpperCase()
          }
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* User and Action */}
            <div className="flex items-center space-x-2 mb-1">
              <p className="font-medium text-gray-900 truncate">
                {log.admin_full_name || log.admin_username}
              </p>
              <Badge 
                variant="secondary" 
                className={`text-xs ${getActionTypeColor(log.action_type)}`}
              >
                {actionLabel}
              </Badge>
            </div>

            {/* Target User (if applicable) */}
            {log.target_user_id && log.target_user_id !== log.admin_user_id && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="text-gray-500">Đối tượng:</span>{' '}
                {log.target_full_name || log.target_username}
              </p>
            )}

            {/* Entity Label */}
            {log.entity_label && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="text-gray-500">Đối tượng:</span>{' '}
                {log.entity_label}
              </p>
            )}

            {/* Action Details */}
            {actionDetails && (
              <p className="text-sm text-gray-600 mb-2">
                {actionDetails}
              </p>
            )}

            {/* Meta Information */}
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}</span>
              </div>
              {log.ip_address && (
                <div className="flex items-center space-x-1">
                  <MapPin className="h-3 w-3" />
                  <span>{log.ip_address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timestamp (relative) */}
          <div className="text-xs text-gray-500 text-right ml-4">
            {formatDistanceToNow(new Date(log.created_at), { 
              addSuffix: true, 
              locale: vi 
            })}
          </div>
        </div>
      </div>
    </div>
  )
}