"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"

import { callRpc } from "@/lib/rpc-client"
import { cn } from "@/lib/utils"
import { isGlobalRole } from "@/lib/rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AddTenantDialog } from "@/components/add-tenant-dialog"
import { EditTenantDialog, type TenantRow } from "@/components/edit-tenant-dialog"
import { useToast } from "@/hooks/use-toast"
import { useSearchDebounce } from "@/hooks/use-debounce"

const ROLE_LABELS = {
  to_qltb: "Tổ QLTB",
  qltb_khoa: "QLTB Khoa/Phòng",
  technician: "Kỹ thuật viên",
  user: "Nhân viên",
} as const

type TenantUserRole = keyof typeof ROLE_LABELS

const LOWER_LEVEL_ORDER: TenantUserRole[] = ["qltb_khoa", "technician", "user"]

const STATUS_CLASSES = {
  active: "border border-emerald-300 bg-emerald-100 text-emerald-700",
  inactive: "border border-amber-300 bg-amber-100 text-amber-700",
} as const

interface TenantHierarchyUser {
  id: number
  username: string
  full_name: string
  role: string
  khoa_phong?: string | null
  current_don_vi?: number | null
  created_at?: string | null
}

interface RawTenantHierarchyRow {
  tenant_id: number
  tenant_code: string | null
  tenant_name: string
  tenant_active: boolean
  membership_quota: number | null
  logo_url: string | null
  used_count: number
  users: TenantHierarchyUser[] | null
}

type TenantHierarchyRow = TenantRow & {
  users: TenantHierarchyUser[]
}

type PreparedTenant = {
  tenant: TenantHierarchyRow
  groups: Record<TenantUserRole, TenantHierarchyUser[]>
  hasLowerLevels: boolean
}

export function TenantsManagement() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const user = (session?.user || {}) as any
  const isGlobal = isGlobalRole(user?.role)
  const { toast } = useToast()
  const qc = useQueryClient()

  const [q, setQ] = React.useState("")
  const debouncedQ = useSearchDebounce(q)
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<TenantRow | null>(null)
  const [expandedTenants, setExpandedTenants] = React.useState<Record<number, boolean>>({})

  const collator = React.useMemo(() => new Intl.Collator("vi", { sensitivity: "base", usage: "sort" }), [])

  React.useEffect(() => {
    if (status === "unauthenticated") router.push("/")
  }, [status, router])

  const query = useQuery<{ rows: TenantHierarchyRow[] }>({
    queryKey: ["don_vi", { q: debouncedQ }],
    queryFn: async () => {
      const rows = await callRpc<RawTenantHierarchyRow[]>({
        fn: "don_vi_user_hierarchy",
        args: { p_q: debouncedQ || null },
      })

      const mapped = (rows || []).map<TenantHierarchyRow>((row) => ({
        id: row.tenant_id,
        code: row.tenant_code,
        name: row.tenant_name,
        active: row.tenant_active,
        membership_quota: row.membership_quota,
        logo_url: row.logo_url,
        used_count: row.used_count,
        users: Array.isArray(row.users) ? row.users : [],
      }))

      return { rows: mapped }
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
  })

  const rows = query.data?.rows || []

  const preparedTenants = React.useMemo<PreparedTenant[]>(() => {
    return rows.map((tenant) => {
      const groups: Record<TenantUserRole, TenantHierarchyUser[]> = {
        to_qltb: [],
        qltb_khoa: [],
        technician: [],
        user: [],
      }

      const users = Array.isArray(tenant.users) ? tenant.users : []
      users.forEach((tenantUser) => {
        const normalizedRole = (tenantUser.role || "").toLowerCase() as TenantUserRole
        if (normalizedRole in groups) {
          groups[normalizedRole as TenantUserRole].push(tenantUser)
        }
      })

      const sortByName = (list: TenantHierarchyUser[]) =>
        list.sort((a, b) => collator.compare(a.full_name || a.username, b.full_name || b.username))

      sortByName(groups.to_qltb)
      sortByName(groups.qltb_khoa)
      sortByName(groups.technician)
      sortByName(groups.user)

      const hasLowerLevels = LOWER_LEVEL_ORDER.some((role) => groups[role].length > 0)

      return {
        tenant,
        groups,
        hasLowerLevels,
      }
    })
  }, [rows, collator])

  const { mutate: toggleActive, isPending: isToggling } = useMutation({
    mutationFn: async (row: TenantRow) => {
      const updated = await callRpc<TenantRow[] | TenantRow>({
        fn: "don_vi_set_active",
        args: { p_id: row.id, p_active: !row.active },
      })
      return Array.isArray(updated) ? (updated[0] as TenantRow) : (updated as TenantRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["don_vi"] })
      toast({ title: "Đã cập nhật trạng thái" })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Không thể cập nhật trạng thái"
      toast({ variant: "destructive", title: "Lỗi", description: message })
    },
  })

  const handleExpandToggle = React.useCallback((tenantId: number) => {
    setExpandedTenants((prev) => ({
      ...prev,
      [tenantId]: !prev[tenantId],
    }))
  }, [])

  if (status === "loading") {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-32" />
          <Skeleton className="mx-auto h-4 w-48" />
        </div>
      </div>
    )
  }

  if (!isGlobal) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Không có quyền truy cập</CardTitle>
            <CardDescription>Chỉ global/admin mới có thể quản lý đơn vị.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const renderSkeleton = (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-lg border p-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="heading-responsive-h2">Cấu hình đơn vị</CardTitle>
          <CardDescription>Quản lý đơn vị với phân cấp tài khoản.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/50 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row sm:items-center">
              <Input
                placeholder="Tìm đơn vị, mã hoặc tài khoản..."
                value={q}
                onChange={(event) => setQ(event.target.value)}
                className="h-10"
              />
              <Button onClick={() => query.refetch()} disabled={query.isFetching} className="h-10 shrink-0 px-6">
                Tải lại
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsAddOpen(true)} className="h-10 px-6">
                Thêm đơn vị
              </Button>
            </div>
          </div>

          {query.isLoading ? (
            renderSkeleton
          ) : preparedTenants.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40">
              <p className="text-sm text-muted-foreground">Không có dữ liệu phù hợp.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {preparedTenants.map(({ tenant, groups, hasLowerLevels }) => {
                const isExpanded = !!expandedTenants[tenant.id]

                return (
                  <div key={tenant.id} className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
                    <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-5">
                        {tenant.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={tenant.logo_url}
                            alt="tenant logo"
                            className="h-12 w-12 rounded-lg border border-border/60 object-contain"
                            onError={(event) => {
                              event.currentTarget.style.display = "none"
                            }}
                          />
                        ) : null}
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-bold sm:text-xl">{tenant.name}</h3>
                            <Badge
                              className={cn(
                                "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
                                tenant.active ? STATUS_CLASSES.active : STATUS_CLASSES.inactive
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
                          className="px-4 font-semibold text-sky-700 border-sky-200 bg-sky-50 hover:bg-sky-100 hover:text-sky-800"
                          onClick={(event) => {
                            event.stopPropagation()
                            setEditing(tenant)
                          }}
                        >
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          className={cn(
                            "px-4 font-semibold border transition-colors",
                            tenant.active
                              ? "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          )}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleActive(tenant)
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
                                  onClick={() => handleExpandToggle(tenant.id)}
                                  aria-expanded={isExpanded}
                                  className={cn(
                                    "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                                    "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                      isExpanded && "-rotate-180"
                                    )}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleExpandToggle(tenant.id)}
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
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddTenantDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["don_vi"] })
        }}
      />
      <EditTenantDialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["don_vi"] })
        }}
        tenant={editing}
      />
    </div>
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
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("")
  return initials || "?"
}

function formatMembership(used: number, quota: number | null | undefined) {
  if (typeof quota === "number") {
    return `${used} / ${quota}`
  }
  return `${used} / ∞`
}
