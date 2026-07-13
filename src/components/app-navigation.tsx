import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Calculator,
  HardHat,
  Home,
  ListChecks,
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

const MOBILE_FOOTER_HREFS = [
  "/dashboard",
  "/equipment",
  "/qr-scanner",
  "/repair-requests",
  "/transfers",
] as const

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
  {
    href: "/technical-configurations",
    icon: ListChecks,
    label: "Cấu hình kỹ thuật",
    mobileSection: "more",
    requiresGlobal: true,
  },
  { href: "/users", icon: Users, label: "Người dùng", mobileSection: "more", requiresGlobal: true },
  {
    href: "/activity-logs",
    icon: Activity,
    label: "Nhật ký hoạt động",
    mobileSection: "more",
    requiresGlobal: true,
  },
]

/**
 * Returns role-filtered navigation items for the desktop sidebar and sheet menu.
 */
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

/**
 * Returns the fixed small-screen footer routes for field-work navigation.
 */
export function getMobileFooterMainNavItems(role?: string): AppNavItem[] {
  return MOBILE_FOOTER_HREFS.flatMap((href) => {
    const item = getAppNavigationItems(role).find((navItem) => navItem.href === href)
    if (!item) {
      return []
    }

    if (item.href === "/qr-scanner") {
      return [{ ...item, href: "/qr-scanner?autoStart=1" }]
    }

    return [item]
  })
}

/**
 * Returns overflow footer routes; intentionally empty because small screens use direct tabs only.
 */
export function getMobileFooterMoreNavItems(role?: string): AppNavItem[] {
  return []
}

/**
 * Checks active route state while ignoring query parameters on navigation links.
 */
export function isAppNavItemActive(pathname: string, href: string): boolean {
  const hrefPathname = href.split("?")[0]

  if (hrefPathname === "/dashboard") {
    return pathname === hrefPathname
  }

  return pathname === hrefPathname || pathname.startsWith(`${hrefPathname}/`)
}
