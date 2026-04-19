import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { callRpc } from '@/lib/rpc-client'
import { isGlobalRole } from '@/lib/rbac'

type AuditActionDetailValue =
  | string
  | number
  | boolean
  | null
  | AuditActionDetailValue[]
  | { [key: string]: AuditActionDetailValue }

export type AuditActionDetails = Record<string, AuditActionDetailValue>
export type AuditActionDetailsInput = AuditActionDetails | string
type AuditLogEntityType =
  | 'assistant_sql'
  | 'device'
  | 'repair_request'
  | 'transfer_request'
  | 'maintenance_plan'
  | 'user'

function getDetailString(details: AuditActionDetails, key: string): string | null {
  const value = details[key]
  return typeof value === 'string' ? value : null
}

// Types for audit logs
export interface AuditLogEntry {
  id: number
  admin_user_id: number
  admin_username: string
  admin_full_name: string
  action_type: string
  target_user_id: number | null
  target_username: string | null
  target_full_name: string | null
  action_details: AuditActionDetailsInput | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  // New entity fields
  entity_type?: AuditLogEntityType | null
  entity_id?: number | null
  entity_label?: string | null
  total_count: number
}

export interface AuditLogStats {
  action_type: string
  action_count: number
  unique_users: number
  latest_activity: string
}

export interface AuditLogSummary {
  total_activities: number
  unique_users: number
  top_action_type: string
  top_action_count: number
  latest_activity: string | null
}

export interface AuditLogFilters {
  limit?: number
  offset?: number
  user_id?: number | null
  // entity filters (v2)
  entity_type?: AuditLogEntityType | null
  entity_id?: number | null
  text_search?: string | null
  action_type?: string | null
  date_from?: string | null
  date_to?: string | null
  don_vi?: string | null
}

// Hook to fetch audit logs list
export function useAuditLogs(
  filters: AuditLogFilters = {},
  options?: UseQueryOptions<AuditLogEntry[], Error>
) {
  const { data: session } = useSession()
  
  // Only global users can access audit logs
  const isGlobalUser = isGlobalRole(session?.user?.role)

  return useQuery<AuditLogEntry[], Error>({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      return callRpc<AuditLogEntry[]>({
        fn: 'audit_logs_list_v2',
        args: {
          p_limit: filters.limit || 50,
          p_offset: filters.offset || 0,
          p_user_id: filters.user_id,
          p_entity_type: filters.entity_type || null,
          p_entity_id: filters.entity_id || null,
          p_action_type: filters.action_type,
          p_text_search: filters.text_search || null,
          p_date_from: filters.date_from,
          p_date_to: filters.date_to,
        },
      })
    },
    enabled: !!session && isGlobalUser,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })
}

// Hook to fetch audit logs statistics
export function useAuditLogsStats(
  filters: {
    date_from?: string | null
    date_to?: string | null
    don_vi?: string | null
  } = {},
  options?: UseQueryOptions<AuditLogStats[], Error>
) {
  const { data: session } = useSession()
  
  const isGlobalUser = isGlobalRole(session?.user?.role)

  return useQuery<AuditLogStats[], Error>({
    queryKey: ['audit-logs-stats', filters],
    queryFn: async () => {
      return callRpc<AuditLogStats[]>({
        fn: 'audit_logs_stats',
        args: {
          p_date_from: filters.date_from,
          p_date_to: filters.date_to,
          p_don_vi: filters.don_vi,
        },
      })
    },
    enabled: !!session && isGlobalUser,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  })
}

// Hook to fetch recent activity summary
export function useAuditLogsRecentSummary(
  options?: UseQueryOptions<AuditLogSummary[], Error>
) {
  const { data: session } = useSession()
  
  const isGlobalUser = isGlobalRole(session?.user?.role)

  return useQuery<AuditLogSummary[], Error>({
    queryKey: ['audit-logs-recent-summary'],
    queryFn: async () => {
      return callRpc<AuditLogSummary[]>({
        fn: 'audit_logs_recent_summary',
      })
    },
    enabled: !!session && isGlobalUser,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
    ...options,
  })
}

// Vietnamese action type labels
export const ACTION_TYPE_LABELS: Record<string, string> = {
  // Authentication & User Management
  'password_change': 'Đổi mật khẩu',
  'password_reset_admin': 'Admin đặt lại mật khẩu',
  'USER_UPDATE': 'Cập nhật thông tin người dùng',
  'user_create': 'Tạo người dùng mới',
  'user_delete': 'Xóa người dùng',
  'user_role_change': 'Thay đổi quyền người dùng',
  'login_success': 'Đăng nhập thành công',
  'login_failed': 'Đăng nhập thất bại',
  'logout': 'Đăng xuất',
  
  // Equipment Management
  'equipment_create': 'Tạo thiết bị mới',
  'equipment_update': 'Cập nhật thiết bị',
  'equipment_delete': 'Xóa thiết bị',
  'equipment_restore': 'Khôi phục thiết bị',
  'equipment_bulk_delete': 'Xóa hàng loạt thiết bị',
  'equipment_import': 'Import danh sách thiết bị',
  'equipment_status_change': 'Thay đổi trạng thái thiết bị',
  
  // Maintenance Management
  'maintenance_plan_create': 'Tạo kế hoạch bảo trì',
  'maintenance_plan_update': 'Cập nhật kế hoạch bảo trì',
  'maintenance_plan_delete': 'Xóa kế hoạch bảo trì',
  'maintenance_plan_approve': 'Phê duyệt kế hoạch bảo trì',
  'maintenance_plan_reject': 'Từ chối kế hoạch bảo trì',
  'maintenance_task_create': 'Tạo nhiệm vụ bảo trì',
  'maintenance_task_update': 'Cập nhật nhiệm vụ bảo trì',
  'maintenance_task_complete': 'Hoàn thành nhiệm vụ bảo trì',
  'maintenance_task_delete': 'Xóa nhiệm vụ bảo trì',
  
  // Transfer Management
  'transfer_create': 'Tạo yêu cầu chuyển giao',
  'transfer_update': 'Cập nhật yêu cầu chuyển giao',
  'transfer_approve': 'Phê duyệt chuyển giao',
  'transfer_reject': 'Từ chối chuyển giao',
  'transfer_complete': 'Hoàn thành chuyển giao',
  'transfer_delete': 'Xóa yêu cầu chuyển giao',
  
  // Repair Management
  'repair_request_create': 'Tạo yêu cầu sửa chữa',
  'repair_request_update': 'Cập nhật yêu cầu sửa chữa',
  'repair_request_approve': 'Phê duyệt sửa chữa',
  'repair_request_complete': 'Hoàn thành sửa chữa',
  'repair_request_delete': 'Xóa yêu cầu sửa chữa',
  
  // System Management
  'system_backup': 'Sao lưu hệ thống',
  'system_restore': 'Khôi phục hệ thống',
  'settings_update': 'Cập nhật cài đặt',
  'tenant_create': 'Tạo đơn vị mới',
  'tenant_update': 'Cập nhật thông tin đơn vị',
  'tenant_delete': 'Xóa đơn vị',
  'assistant_query_database': 'Truy vấn SQL trợ lý',
}

// Get Vietnamese label for action type
export function getActionTypeLabel(actionType: string): string {
  return ACTION_TYPE_LABELS[actionType] || actionType
}

// Format action details for display
export function formatActionDetails(actionType: string, details: AuditActionDetailsInput | null): string {
  if (!details) return ''
  if (typeof details === 'string') return details

  switch (actionType) {
    case 'equipment_create':
    case 'equipment_update':
      return getDetailString(details, 'equipment_name')
        ? `Thiết bị: ${getDetailString(details, 'equipment_name')}`
        : ''
    case 'USER_UPDATE':
      return getDetailString(details, 'username')
        ? `Người dùng: ${getDetailString(details, 'username')}`
        : ''
    case 'maintenance_plan_create':
    case 'maintenance_plan_update':
      return getDetailString(details, 'plan_name')
        ? `Kế hoạch: ${getDetailString(details, 'plan_name')}`
        : ''
    case 'transfer_create':
    case 'transfer_update':
      return getDetailString(details, 'equipment_name')
        ? `TB: ${getDetailString(details, 'equipment_name')}`
        : ''
    case 'assistant_query_database': {
      const status = getDetailString(details, 'status')
      const sqlShape = getDetailString(details, 'sql_shape')
      if (status && sqlShape) {
        return `query_database ${status}: ${sqlShape}`
      }
      return sqlShape ? `query_database: ${sqlShape}` : ''
    }
    default: {
      // Try to extract meaningful info from details
      const description = getDetailString(details, 'description')
      if (description) return description

      const message = getDetailString(details, 'message')
      if (message) return message

      return ''
    }
  }
}
