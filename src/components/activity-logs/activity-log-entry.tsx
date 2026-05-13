"use client"

import { Clock, MapPin } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { HydrationSafeRelativeTime } from "@/components/time/HydrationSafeRelativeTime"
import { formatVietnamDateTime } from "@/lib/date-utils"
import {
  type AuditLogEntry as AuditLogEntryData,
  formatActionDetails,
  getActionTypeLabel,
} from "@/hooks/use-audit-logs"

interface ActivityLogEntryProps {
  log: AuditLogEntryData
}

function getActionTypeColor(actionType: string) {
  if (actionType.includes("create")) return "bg-green-100 text-green-800"
  if (actionType.includes("update")) return "bg-blue-100 text-blue-800"
  if (actionType.includes("delete")) return "bg-red-100 text-red-800"
  if (actionType.includes("approve")) return "bg-purple-100 text-purple-800"
  if (actionType.includes("password")) return "bg-orange-100 text-orange-800"
  return "bg-gray-100 text-gray-800"
}

function getInitials(log: AuditLogEntryData) {
  return log.admin_full_name
    ? log.admin_full_name.split(" ").map((name) => name[0]).join("").substring(0, 2)
    : log.admin_username.substring(0, 2).toUpperCase()
}

export function ActivityLogEntry({ log }: ActivityLogEntryProps) {
  const actionLabel = getActionTypeLabel(log.action_type)
  const actionDetails = formatActionDetails(log.action_type, log.action_details)

  return (
    <div className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
      <Avatar className="h-10 w-10">
        <AvatarFallback>{getInitials(log)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
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

            {log.target_user_id && log.target_user_id !== log.admin_user_id && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="text-gray-500">Đối tượng:</span>{" "}
                {log.target_full_name || log.target_username}
              </p>
            )}

            {log.entity_label && (
              <p className="text-sm text-gray-600 mb-1">
                <span className="text-gray-500">Đối tượng:</span> {log.entity_label}
              </p>
            )}

            {actionDetails && (
              <p className="text-sm text-gray-600 mb-2">{actionDetails}</p>
            )}

            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{formatVietnamDateTime(log.created_at)}</span>
              </div>
              {log.ip_address && (
                <div className="flex items-center space-x-1">
                  <MapPin className="h-3 w-3" />
                  <span>{log.ip_address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500 text-right ml-4">
            <HydrationSafeRelativeTime value={log.created_at} />
          </div>
        </div>
      </div>
    </div>
  )
}
