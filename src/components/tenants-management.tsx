"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { AddTenantDialog } from "@/components/add-tenant-dialog"
import { EditTenantDialog, type TenantRow } from "@/components/edit-tenant-dialog"
import { useToast } from "@/hooks/use-toast"
import { useSearchDebounce } from "@/hooks/use-debounce"

export function TenantsManagement() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const user = (session?.user || {}) as any
  const isGlobal = (user?.role || '').toLowerCase() === 'global' || (user?.role || '').toLowerCase() === 'admin'
  const { toast } = useToast()
  const qc = useQueryClient()

  const [q, setQ] = React.useState("")
  const debouncedQ = useSearchDebounce(q)
  const [page, setPage] = React.useState(1)
  const [pageSize] = React.useState(20)
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<TenantRow | null>(null)

  React.useEffect(() => {
    if (status === "unauthenticated") router.push("/")
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    )
  }

  if (!isGlobal) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Không có quyền truy cập</CardTitle>
            <CardDescription>Chỉ global/admin có thể quản lý đơn vị.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const { data, isLoading, refetch, isFetching } = useQuery<{ rows: TenantRow[] }>({
    queryKey: ["don_vi", { q: debouncedQ, page, pageSize }],
    queryFn: async () => {
      const rows = await callRpc<TenantRow[]>({
        fn: 'don_vi_list',
        args: { p_q: debouncedQ || null, p_sort: 'name', p_page: page, p_page_size: pageSize },
      })
      return { rows }
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
  })

  const rows = data?.rows || []

  const toggleMutation = useMutation({
    mutationFn: async (row: TenantRow) => {
      const updated = await callRpc<TenantRow[]>({ fn: 'don_vi_set_active', args: { p_id: row.id, p_active: !row.active } })
      // don_vi_set_active returns a row (or array with single row depending on PostgREST); normalize
      const normalized = Array.isArray(updated) ? (updated[0] as TenantRow) : (updated as unknown as TenantRow)
      return normalized
    },
    onMutate: async (row: TenantRow) => {
      await qc.cancelQueries({ queryKey: ["don_vi"] })
      const prev = qc.getQueriesData<{ rows: TenantRow[] }>({ queryKey: ["don_vi"] })
      // Optimistically flip active in all cached pages
      prev.forEach(([key, data]) => {
        if (!data) return
        const newRows = data.rows.map(r => r.id === row.id ? { ...r, active: !row.active } : r)
        qc.setQueryData(key as any, { rows: newRows })
      })
      return { prev }
    },
    onError: (e: any, _vars, context) => {
      // rollback
      if (context?.prev) {
        context.prev.forEach(([key, data]: any) => {
          qc.setQueryData(key, data)
        })
      }
      toast({ variant: 'destructive', title: 'Lỗi', description: e?.message || 'Không thể cập nhật trạng thái' })
    },
    onSuccess: (row: TenantRow) => {
      // Merge server row back
      const all = qc.getQueriesData<{ rows: TenantRow[] }>({ queryKey: ["don_vi"] })
      all.forEach(([key, data]) => {
        if (!data) return
        const newRows = data.rows.map(r => r.id === row.id ? { ...r, ...row } : r)
        qc.setQueryData(key as any, { rows: newRows })
      })
      toast({ title: 'Đã cập nhật trạng thái' })
    },
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="heading-responsive-h2">Cấu hình đơn vị</CardTitle>
          <CardDescription>Quản lý thông tin các đơn vị (chỉ global/admin).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="flex gap-2 w-full sm:max-w-md">
              <Input
                placeholder="Tìm theo tên hoặc mã..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button onClick={() => refetch()} disabled={isFetching}>Tải lại</Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsAddOpen(true)}>Thêm đơn vị</Button>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Mã</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Logo</TableHead>
                  <TableHead>Thành viên</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <div className="space-y-2 p-4">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-2/3" />
                        <Skeleton className="h-6 w-1/2" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                      Không có dữ liệu.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.id}</TableCell>
                      <TableCell>{t.code || <span className="italic text-muted-foreground">(chưa có)</span>}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        {t.active ? (
                          <Badge variant="secondary">Đang hoạt động</Badge>
                        ) : (
                          <Badge variant="outline">Tạm dừng</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.logo_url} alt="logo" className="h-8 w-8 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
                        ) : (
                          <span className="italic text-muted-foreground">(trống)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.used_count}{typeof t.membership_quota === 'number' ? ` / ${t.membership_quota}` : ' / ∞'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditing(t) }}>Sửa</Button>
                        <Button size="sm" variant={t.active ? "secondary" : "default"} onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(t) }} disabled={toggleMutation.isPending}>
                          {t.active ? 'Tạm dừng' : 'Kích hoạt'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || isFetching}>
              Trang trước
            </Button>
            <div className="text-sm text-muted-foreground">Trang {page}</div>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={rows.length < pageSize || isFetching}>
              Trang sau
            </Button>
          </div>
        </CardContent>
      </Card>

      <AddTenantDialog open={isAddOpen} onOpenChange={setIsAddOpen} onSuccess={() => { /* cache updated inside dialog */ }} />
      <EditTenantDialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }} onSuccess={() => { /* cache updated inside dialog */ }} tenant={editing} />
    </div>
  )
}
