"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
}

const BASE_ITEMS: NavItem[] = [
  { href: "/device-quota/dashboard", label: "Tổng quan" },
  { href: "/device-quota/decisions", label: "Quyết định" },
  { href: "/device-quota/mapping", label: "Phân loại" },
]

const CATEGORIES_ITEM: NavItem = {
  href: "/device-quota/categories",
  label: "Danh mục",
}

export function DeviceQuotaSubNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user as { role?: string } | undefined

  const canManageCategories =
    user?.role === "global" || user?.role === "admin" || user?.role === "to_qltb"

  const items = React.useMemo(
    () => (canManageCategories ? [...BASE_ITEMS, CATEGORIES_ITEM] : BASE_ITEMS),
    [canManageCategories]
  )

  const isActive = React.useCallback(
    (href: string) => {
      if (!pathname) return false
      if (href === "/device-quota/dashboard") {
        return pathname === "/device-quota" || pathname === href || pathname.startsWith(href + "/")
      }
      return pathname === href || pathname.startsWith(href + "/")
    },
    [pathname]
  )

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
