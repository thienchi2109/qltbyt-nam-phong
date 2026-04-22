import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Calculator,
  HardHat,
  Home,
  Package,
  QrCode,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { canAccessDeviceQuotaModule, isGlobalRole } from "@/lib/rbac"
import type { AppNotificationBadgeKey } from "@/lib/app-notification-counts"

export interface AppNavItem {
  href: string
  icon: LucideIcon
  label: string
  mobileLabel?: string
  mobileSection: "main" | "more"
  badgeKey?: AppNotificationBadgeKey
  requiresGlobal?: boolean
  requiresDeviceQuotaAccess?: boolean
}

const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/dashboard", icon: Home, label: "Tổng quan", mobileSection: "main" },
  { href: "/equipment", icon: Package, label: "Thiết bị", mobileSection: "main" },
  {
    href: "/repair-requests",
    icon: Wrench,
    label: "Yêu cầu sửa chữa",
    mobileLabel: "Sửa chữa",
    mobileSection: "main",
    badgeKey: "repair",
  },
  {
    href: "/transfers",
    icon: ArrowLeftRight,
    label: "Luân chuyển",
    mobileSection: "more",
    badgeKey: "transfer",
  },
  {
    href: "/maintenance",
    icon: HardHat,
    label: "Bảo trì",
    mobileSection: "more",
    badgeKey: "maintenance",
  },
  {
    href: "/device-quota",
    icon: Calculator,
    label: "Định mức",
    mobileSection: "more",
    requiresDeviceQuotaAccess: true,
  },
  { href: "/reports", icon: BarChart3, label: "Báo cáo", mobileSection: "more" },
  { href: "/qr-scanner", icon: QrCode, label: "Quét QR", mobileSection: "more" },
  { href: "/users", icon: Users, label: "Người dùng", mobileSection: "more", requiresGlobal: true },
  {
    href: "/activity-logs",
    icon: Activity,
    label: "Nhật ký hoạt động",
    mobileSection: "more",
    requiresGlobal: true,
  },
]

export function getAppNavigationItems(role?: string): AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => {
    if (item.requiresGlobal && !isGlobalRole(role)) {
      return false
    }

    if (item.requiresDeviceQuotaAccess && !canAccessDeviceQuotaModule(role)) {
      return false
    }

    return true
  })
}

export function getMobileFooterMainNavItems(role?: string): AppNavItem[] {
  return getAppNavigationItems(role).filter((item) => item.mobileSection === "main")
}

export function getMobileFooterMoreNavItems(role?: string): AppNavItem[] {
  return getAppNavigationItems(role).filter((item) => item.mobileSection === "more")
}

export function isAppNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}
