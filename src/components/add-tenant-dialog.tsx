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
import type { TenantRow } from "@/components/edit-tenant-dialog"

interface AddTenantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const EMPTY_TENANT_FORM = {
  code: "",
  name: "",
  active: true,
  membership_quota: "" as string,
  logo_url: "",
  google_drive_folder_url: "",
}

/** Renders the tenant creation dialog and clears draft state when it closes. */
export function AddTenantDialog({ open, onOpenChange, onSuccess }: AddTenantDialogProps) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [form, setForm] = React.useState(EMPTY_TENANT_FORM)

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setForm(EMPTY_TENANT_FORM)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const createMutation = useMutation({
    mutationFn: async (): Promise<TenantRow> => {
      const quotaVal = form.membership_quota.trim() === "" ? null : Number.parseInt(form.membership_quota, 10)
      if (quotaVal !== null && Number.isNaN(quotaVal)) {
        throw new Error("Hạn mức thành viên phải là số nguyên hoặc để trống")
      }
      const res = await callRpc<TenantRow[] | TenantRow>({
        fn: 'don_vi_create',
        args: {
          p_code: form.code.trim() || null,
          p_name: form.name.trim(),
          p_active: !!form.active,
          p_membership_quota: quotaVal,
          p_logo_url: form.logo_url.trim() || null,
          p_google_drive_folder_url: form.google_drive_folder_url.trim() || null,
        }
      })
      const row = Array.isArray(res) ? res[0] as TenantRow : res as TenantRow
      return row
    },
	    onSuccess: (row) => {
	      const all = qc.getQueriesData<{ rows: TenantRow[] }>({ queryKey: ["don_vi"] })
	      all.forEach(([key, data]) => {
	        if (!data) return
	        const exists = data.rows.some(r => r.id === row.id)
	        const newRows = exists ? data.rows.map(r => r.id === row.id ? row : r) : [row, ...data.rows]
	        qc.setQueryData(key, { rows: newRows })
	      })
	      toast({ title: "Thành công", description: "Đã tạo đơn vị mới" })
	      onSuccess?.()
	      handleOpenChange(false)
	    },
	    onError: (error: unknown) => {
	      const description = error instanceof Error ? error.message : "Không thể tạo đơn vị"
	      toast({ variant: "destructive", title: "Lỗi", description })
	    }
	  })
  const isPending = createMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Lỗi", description: "Tên đơn vị không được trống" })
	      return
	    }
	    createMutation.mutate()
	  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Thêm đơn vị</DialogTitle>
          <DialogDescription>Nhập thông tin đơn vị để tạo mới.</DialogDescription>
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quota">Hạn mức tài khoản thành viên</Label>
              <Input id="quota" inputMode="numeric" pattern="[0-9]*" value={form.membership_quota} onChange={(e) => setForm(s => ({ ...s, membership_quota: e.target.value }))} placeholder="Để trống nếu không giới hạn" disabled={isPending} />
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
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Tạo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
