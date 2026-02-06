"use client"

import * as React from "react"
import { Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { isEquipmentManagerRole } from "@/lib/rbac"

interface DepartmentFilterStatusProps {
  /** Number of items currently displayed after filtering */
  itemCount: number
  /** Type of items being filtered (e.g., "thiết bị", "yêu cầu sửa chữa") */
  itemType: string
  /** Color theme for the notification */
  variant?: "blue" | "amber" | "green" | "purple"
  /** Additional CSS classes */
  className?: string
}

const variantStyles = {
  blue: {
    container: "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200",
    icon: "bg-blue-100 text-blue-600",
    title: "text-blue-900",
    description: "text-blue-700",
    badge: "bg-blue-200 text-blue-800",
    statusBadge: "bg-blue-100 text-blue-800 border-blue-300"
  },
  amber: {
    container: "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200",
    icon: "bg-amber-100 text-amber-600",
    title: "text-amber-900",
    description: "text-amber-700",
    badge: "bg-amber-200 text-amber-800",
    statusBadge: "bg-amber-100 text-amber-800 border-amber-300"
  },
  green: {
    container: "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200",
    icon: "bg-green-100 text-green-600",
    title: "text-green-900",
    description: "text-green-700",
    badge: "bg-green-200 text-green-800",
    statusBadge: "bg-green-100 text-green-800 border-green-300"
  },
  purple: {
    container: "bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200",
    icon: "bg-purple-100 text-purple-600",
    title: "text-purple-900",
    description: "text-purple-700",
    badge: "bg-purple-200 text-purple-800",
    statusBadge: "bg-purple-100 text-purple-800 border-purple-300"
  }
}

export function DepartmentFilterStatus({
  itemCount,
  itemType,
  variant = "blue",
  className
}: DepartmentFilterStatusProps) {
  const { data: session } = useSession()
  const user = session?.user as any
  
  // Only show for non-admin users with department
  const shouldShow = user && 
    !isEquipmentManagerRole(user.role) && 
    user.khoa_phong

  if (!shouldShow) {
    return null
  }

  const styles = variantStyles[variant]

  return (
    <div className={cn(
      "p-4 border rounded-lg shadow-sm",
      styles.container,
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            styles.icon
          )}>
            <Filter className="h-4 w-4" />
          </div>
          <div>
            <div className={cn("flex items-center gap-2", styles.title)}>
              <span className="text-sm font-semibold">
                Bộ lọc theo khoa phòng đang hoạt động
              </span>
            </div>
            <div className={cn("mt-1", styles.description)}>
              <span className="text-sm">
                Hiển thị <strong>{itemCount}</strong> {itemType} thuộc khoa: 
                <strong className={cn(
                  "ml-1 px-2 py-0.5 rounded",
                  styles.badge
                )}>
                  {user.khoa_phong}
                </strong>
              </span>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          <Badge variant="secondary" className={styles.statusBadge}>
            Tự động
          </Badge>
        </div>
      </div>
    </div>
  )
}

// Convenience components for specific use cases
export function EquipmentFilterStatus({ itemCount, className }: { itemCount: number; className?: string }) {
  return (
    <DepartmentFilterStatus
      itemCount={itemCount}
      itemType="thiết bị"
      variant="blue"
      className={className}
    />
  )
}

export function RepairRequestFilterStatus({ itemCount, className }: { itemCount: number; className?: string }) {
  return (
    <DepartmentFilterStatus
      itemCount={itemCount}
      itemType="yêu cầu sửa chữa"
      variant="amber"
      className={className}
    />
  )
}

export function MaintenanceFilterStatus({ itemCount, className }: { itemCount: number; className?: string }) {
  return (
    <DepartmentFilterStatus
      itemCount={itemCount}
      itemType="kế hoạch bảo trì"
      variant="green"
      className={className}
    />
  )
}

export function TransferFilterStatus({ itemCount, className }: { itemCount: number; className?: string }) {
  return (
    <DepartmentFilterStatus
      itemCount={itemCount}
      itemType="yêu cầu luân chuyển"
      variant="purple"
      className={className}
    />
  )
}
