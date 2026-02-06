"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

import { cn } from "@/lib/utils"
import { isEquipmentManagerRole } from "@/lib/rbac"

interface NavItem {
  href: string
  label: string
}

const BASE_ITEMS: NavItem[] = [
  { href: "/device-quota/dashboard", label: "Tổng quan" },
  { href: "/device-quota/decisions", label: "Quyết định" },
  { href: "/device-quota/mapping", label: "Phân loại" },
]

const ALL_ITEMS: NavItem[] = [
  ...BASE_ITEMS,
  { href: "/device-quota/categories", label: "Danh mục" },
]

function NavSkeleton() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex gap-2 py-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-9 w-24 animate-pulse rounded-full bg-slate-200"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DeviceQuotaSubNav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  // Handle loading state to avoid flash of incomplete navigation
  if (status === "loading") {
    return <NavSkeleton />
  }

  const user = session?.user
  // Note: 'admin' is normalized to 'global' by API proxy, but session may still show 'admin'
  const canManageCategories = isEquipmentManagerRole(user?.role)

  const items = canManageCategories ? ALL_ITEMS : BASE_ITEMS

  const isActive = (href: string) => {
    if (!pathname) return false
    if (href === "/device-quota/dashboard") {
      return pathname === "/device-quota" || pathname === href || pathname.startsWith(href + "/")
    }
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="container mx-auto px-4">
        <nav
          className="flex gap-2 overflow-x-auto py-3"
          aria-label="Điều hướng định mức"
        >
          {items.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-900 text-white shadow"
                    : "text-slate-600 hover:bg-slate-100"
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
