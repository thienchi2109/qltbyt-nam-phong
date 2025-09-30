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

export function AddTenantDialog({ open, onOpenChange, onSuccess }: AddTenantDialogProps) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [isLoading, setIsLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    code: "",
    name: "",
    active: true,
    membership_quota: "" as string,
    logo_url: "",
    google_drive_folder_url: "",
  })

  React.useEffect(() => {
    if (!open) {
      setForm({ code: "", name: "", active: true, membership_quota: "", logo_url: "", google_drive_folder_url: "" })
    }
  }, [open])

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
        qc.setQueryData(key as any, { rows: newRows })
      })
      toast({ title: "Thành công", description: "Đã tạo đơn vị mới" })
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Lỗi", description: e?.message || "Không thể tạo đơn vị" })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Lỗi", description: "Tên đơn vị không được trống" })
      return
    }
    setIsLoading(true)
    createMutation.mutate(undefined, { onSettled: () => setIsLoading(false) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Thêm đơn vị</DialogTitle>
          <DialogDescription>Nhập thông tin đơn vị để tạo mới.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Mã đơn vị</Label>
              <Input id="code" value={form.code} onChange={(e) => setForm(s => ({ ...s, code: e.target.value }))} placeholder="VD: CDCCT" disabled={isLoading} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Tên đơn vị *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))} placeholder="Nhập tên đơn vị" required disabled={isLoading} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input id="logo" type="url" value={form.logo_url} onChange={(e) => setForm(s => ({ ...s, logo_url: e.target.value }))} placeholder="https://..." disabled={isLoading} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quota">Hạn mức tài khoản thành viên</Label>
              <Input id="quota" inputMode="numeric" pattern="[0-9]*" value={form.membership_quota} onChange={(e) => setForm(s => ({ ...s, membership_quota: e.target.value }))} placeholder="Để trống nếu không giới hạn" disabled={isLoading} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="google_drive_url">URL thư mục Google Drive chia sẻ</Label>
              <Input id="google_drive_url" type="url" value={form.google_drive_folder_url} onChange={(e) => setForm(s => ({ ...s, google_drive_folder_url: e.target.value }))} placeholder="https://drive.google.com/drive/folders/..." disabled={isLoading} />
              <p className="text-xs text-muted-foreground">Thư mục Google Drive chia sẻ cho file đính kèm thiết bị của đơn vị này.</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="active" checked={form.active} onCheckedChange={(v) => setForm(s => ({ ...s, active: !!v }))} disabled={isLoading} />
              <Label htmlFor="active">Đang hoạt động</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Hủy</Button>
            <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Tạo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
