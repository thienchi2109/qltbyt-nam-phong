"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"

import { callRpc } from "@/lib/rpc-client"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { isGlobalRole } from "@/lib/rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AddTenantDialog } from "@/components/add-tenant-dialog"
import { EditTenantDialog, type TenantRow } from "@/components/edit-tenant-dialog"
import {
  LOWER_LEVEL_ORDER,
  type TenantGroups,
  type TenantHierarchyRow,
  type TenantHierarchyUser,
  type TenantUserRole,
} from "@/components/tenants-management-shared"
import { TenantsManagementTenantCard } from "@/components/tenants-management-tenant-card"
import { useToast } from "@/hooks/use-toast"
import { useSearchDebounce } from "@/hooks/use-debounce"

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

type PreparedTenant = {
  tenant: TenantHierarchyRow
  groups: TenantGroups
  hasLowerLevels: boolean
}

export function TenantsManagement() {
  const { data: session, status } = useSession()
  const isGlobal = isGlobalRole(session?.user?.role)
  const { toast } = useToast()
  const qc = useQueryClient()

  const [q, setQ] = React.useState("")
  const debouncedQ = useSearchDebounce(q)
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<TenantRow | null>(null)
  const [expandedTenants, setExpandedTenants] = React.useState<Record<number, boolean>>({})

  const collator = React.useMemo(() => new Intl.Collator("vi", { sensitivity: "base", usage: "sort" }), [])

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
      const groups: TenantGroups = {
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
      const message = getUnknownErrorMessage(error, "Không thể cập nhật trạng thái")
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
                  <TenantsManagementTenantCard
                    key={tenant.id}
                    tenant={tenant}
                    groups={groups}
                    hasLowerLevels={hasLowerLevels}
                    isExpanded={isExpanded}
                    isToggling={isToggling}
                    onEdit={setEditing}
                    onToggleActive={toggleActive}
                    onToggleExpand={handleExpandToggle}
                  />
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
