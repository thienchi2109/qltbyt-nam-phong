"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  LOWER_LEVEL_ORDER,
  ROLE_LABELS,
  type TenantGroups,
  type TenantHierarchyRow,
  type TenantHierarchyUser,
} from "@/components/tenants-management-shared"
import { cn } from "@/lib/utils"
import type { TenantRow } from "@/components/edit-tenant-dialog"

const STATUS_CLASSES = {
  active: "border border-emerald-300 bg-emerald-100 text-emerald-700",
  inactive: "border border-amber-300 bg-amber-100 text-amber-700",
} as const

type TenantsManagementTenantCardProps = Readonly<{
  tenant: TenantHierarchyRow
  groups: TenantGroups
  hasLowerLevels: boolean
  isExpanded: boolean
  isToggling: boolean
  onEdit: (tenant: TenantRow) => void
  onToggleActive: (tenant: TenantRow) => void
  onToggleExpand: (tenantId: number) => void
}>

export function TenantsManagementTenantCard({
  tenant,
  groups,
  hasLowerLevels,
  isExpanded,
  isToggling,
  onEdit,
  onToggleActive,
  onToggleExpand,
}: TenantsManagementTenantCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
      <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-5">
          <TenantLogo logoUrl={tenant.logo_url} tenantName={tenant.name} />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-bold sm:text-xl">{tenant.name}</h3>
              <Badge
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
                  tenant.active ? STATUS_CLASSES.active : STATUS_CLASSES.inactive,
                )}
              >
                {tenant.active ? "Đang hoạt động" : "Tạm dừng"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Mã: {tenant.code || "(chưa có)"}</span>
              <span>Thành viên: {formatMembership(tenant.used_count, tenant.membership_quota)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-sky-200 bg-sky-50 px-4 font-semibold text-sky-700 hover:bg-sky-100 hover:text-sky-800"
            onClick={(event) => {
              event.stopPropagation()
              onEdit(tenant)
            }}
          >
            Sửa
          </Button>
          <Button
            size="sm"
            className={cn(
              "border px-4 font-semibold transition-colors",
              tenant.active
                ? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200"
                : "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
            )}
            onClick={(event) => {
              event.stopPropagation()
              onToggleActive(tenant)
            }}
            disabled={isToggling}
          >
            {tenant.active ? "Tạm dừng" : "Kích hoạt"}
          </Button>
        </div>
      </div>

      <div className="border-t border-border/70 bg-muted/20 px-6 py-5">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tổ QLTB</p>
          {groups.to_qltb.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
              <div className="divide-y divide-border/60">
                {groups.to_qltb.map((tenantUser) => (
                  <button
                    key={tenantUser.id}
                    type="button"
                    onClick={() => onToggleExpand(tenant.id)}
                    aria-expanded={isExpanded}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                      "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs font-medium">
                          {getInitials(tenantUser.full_name || tenantUser.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-0.5">
                        <div className="text-sm font-medium leading-none">
                          {tenantUser.full_name || tenantUser.username}
                        </div>
                        <div className="text-xs text-muted-foreground">{tenantUser.username}</div>
                      </div>
                      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                        {ROLE_LABELS.to_qltb}
                      </Badge>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "-rotate-180",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onToggleExpand(tenant.id)}
              aria-expanded={isExpanded}
              className="flex w-full items-center justify-between rounded-lg border border-dashed border-border/60 px-4 py-3 text-left text-sm text-muted-foreground transition hover:border-border"
            >
              <span>Chưa có tài khoản Tổ QLTB</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "-rotate-180")} />
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="mt-5 space-y-5 border-l border-border/50 pl-5">
            {hasLowerLevels ? (
              LOWER_LEVEL_ORDER.map((role) => {
                const usersForRole = groups[role]
                if (usersForRole.length === 0) return null

                return (
                  <div key={role} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {ROLE_LABELS[role]}
                    </p>
                    <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
                      <div className="divide-y divide-border/60">
                        {usersForRole.map((tenantUser) => (
                          <HierarchyUserRow key={tenantUser.id} user={tenantUser} label={ROLE_LABELS[role]} />
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có tài khoản cấp dưới.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TenantLogo({
  logoUrl,
  tenantName,
}: Readonly<{ logoUrl: string | null; tenantName: string }>) {
  const [hasError, setHasError] = React.useState(false)

  if (!logoUrl || hasError) {
    return null
  }

  return (
    <Image
      src={logoUrl}
      alt={`Logo ${tenantName}`}
      width={48}
      height={48}
      unoptimized
      className="h-12 w-12 rounded-lg border border-border/60 object-contain"
      onError={() => setHasError(true)}
    />
  )
}

function HierarchyUserRow({ user, label }: { user: TenantHierarchyUser; label?: string }) {
  return (
    <div className="flex items-center justify-between bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-[11px] font-medium">
            {getInitials(user.full_name || user.username)}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-0.5">
          <div className="text-sm font-medium leading-none">{user.full_name || user.username}</div>
          <div className="text-xs text-muted-foreground">
            {user.username}
            {user.khoa_phong ? ` • ${user.khoa_phong}` : ""}
          </div>
        </div>
      </div>
      {label ? <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">{label}</Badge> : null}
    </div>
  )
}

function getInitials(value: string | undefined) {
  if (!value) return "?"
  const parts = value.trim().split(/\s+/)
  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")

  return initials || "?"
}

function formatMembership(used: number, quota: number | null | undefined) {
  if (typeof quota === "number") {
    return `${used} / ${quota}`
  }

  return `${used} / ∞`
}
