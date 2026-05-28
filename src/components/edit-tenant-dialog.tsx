"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export interface TenantRow {
  id: number
  code: string | null
  name: string
  active: boolean
  membership_quota: number | null
  logo_url: string | null
  google_drive_folder_url?: string | null
  used_count: number
}

interface EditTenantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  tenant: TenantRow | null
}

const EMPTY_TENANT_FORM = {
  code: "",
  name: "",
  active: true,
  membership_quota: "" as string,
  logo_url: "",
  google_drive_folder_url: "",
}

function getTenantForm(tenant: TenantRow | null) {
  if (!tenant) return EMPTY_TENANT_FORM
  return {
    code: tenant.code || "",
    name: tenant.name,
    active: !!tenant.active,
    membership_quota: tenant.membership_quota === null ? "" : String(tenant.membership_quota),
    logo_url: tenant.logo_url || "",
    google_drive_folder_url: tenant.google_drive_folder_url || "",
  }
}

/** Renders the tenant edit dialog without overwriting in-progress drafts on refresh. */
export function EditTenantDialog({ open, onOpenChange, onSuccess, tenant }: EditTenantDialogProps) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const activeTenantId = open ? tenant?.id ?? null : null
  const loadedTenantIdRef = React.useRef<number | null>(activeTenantId)
  const [form, setForm] = React.useState(() => getTenantForm(open ? tenant : null))

  if (loadedTenantIdRef.current !== activeTenantId) {
    loadedTenantIdRef.current = activeTenantId
    setForm(getTenantForm(open ? tenant : null))
  }

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        loadedTenantIdRef.current = null
        setForm(EMPTY_TENANT_FORM)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const updateMutation = useMutation({
    mutationFn: async (): Promise<TenantRow> => {
      if (!tenant) throw new Error('invalid tenant')
      const quotaStr = form.membership_quota.trim()
      const quotaVal = quotaStr === "" ? null : Number.parseInt(quotaStr, 10)
      if (quotaStr !== "" && Number.isNaN(Number(quotaStr))) {
        throw new Error("Hạn mức thành viên phải là số nguyên hoặc để trống")
      }
      const setQuotaFlag = true
      const setLogoFlag = true
      const setGoogleDriveFlag = true
      const res = await callRpc<TenantRow[] | TenantRow>({
        fn: 'don_vi_update',
        args: {
          p_id: tenant.id,
          p_code: form.code.trim() || null,
          p_name: form.name.trim(),
          p_active: !!form.active,
          p_membership_quota: quotaVal,
          p_logo_url: form.logo_url.trim() || null,
          p_google_drive_folder_url: form.google_drive_folder_url.trim() || null,
          p_set_membership_quota: setQuotaFlag,
          p_set_logo_url: setLogoFlag,
          p_set_google_drive_folder_url: setGoogleDriveFlag,
        }
      })
      const row = Array.isArray(res) ? res[0] as TenantRow : res as TenantRow
      return row
    },
	    onSuccess: (row) => {
	      const all = qc.getQueriesData<{ rows: TenantRow[] }>({ queryKey: ["don_vi"] })
	      all.forEach(([key, data]) => {
	        if (!data) return
	        const newRows = data.rows.map(r => r.id === row.id ? { ...r, ...row } : r)
	        qc.setQueryData(key, { rows: newRows })
	      })
	      toast({ title: "Thành công", description: "Đã cập nhật đơn vị" })
	      onSuccess?.()
	      handleOpenChange(false)
	    },
	    onError: (error: unknown) => {
	      const description = error instanceof Error ? error.message : "Không thể cập nhật đơn vị"
	      toast({ variant: "destructive", title: "Lỗi", description })
	    }
	  })
  const isPending = updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant) return
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Lỗi", description: "Tên đơn vị không được trống" })
	      return
	    }
	    updateMutation.mutate()
	  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Sửa đơn vị</DialogTitle>
          <DialogDescription>Chỉnh sửa thông tin đơn vị.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Mã đơn vị</Label>
              <Input id="code" value={form.code} onChange={(e) => setForm(s => ({ ...s, code: e.target.value }))} placeholder="VD: CDCCT" disabled={isPending} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Tên đơn vị *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))} placeholder="Nhập tên đơn vị" required disabled={isPending} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input id="logo" type="url" value={form.logo_url} onChange={(e) => setForm(s => ({ ...s, logo_url: e.target.value }))} placeholder="https://…" disabled={isPending} />
              <p className="text-xs text-muted-foreground">Để trống để xóa logo.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quota">Hạn mức tài khoản thành viên</Label>
              <Input id="quota" inputMode="numeric" pattern="[0-9]*" value={form.membership_quota} onChange={(e) => setForm(s => ({ ...s, membership_quota: e.target.value }))} placeholder="Để trống nếu không giới hạn" disabled={isPending} />
              <p className="text-xs text-muted-foreground">Để trống để bỏ giới hạn.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="google_drive_url">URL thư mục Google Drive chia sẻ</Label>
              <Input id="google_drive_url" type="url" value={form.google_drive_folder_url} onChange={(e) => setForm(s => ({ ...s, google_drive_folder_url: e.target.value }))} placeholder="https://drive.google.com/drive/folders/…" disabled={isPending} />
              <p className="text-xs text-muted-foreground">Thư mục Google Drive chia sẻ cho file đính kèm thiết bị của đơn vị này.</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="active" checked={form.active} onCheckedChange={(v) => setForm(s => ({ ...s, active: !!v }))} disabled={isPending} />
              <Label htmlFor="active">Đang hoạt động</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>Hủy</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Lưu</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
