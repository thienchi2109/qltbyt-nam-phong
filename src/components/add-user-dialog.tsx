"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { callRpc } from "@/lib/rpc-client"
import { USER_ROLES, type UserRole } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { fetchTenantList, type AddEquipmentTenantOption } from "./add-equipment-dialog.queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"

interface AddUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddUserDialog({ open, onOpenChange, onSuccess }: AddUserDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [tenants, setTenants] = React.useState<AddEquipmentTenantOption[]>([])
  const [memberships, setMemberships] = React.useState<number[]>([])
  
  const [formData, setFormData] = React.useState({
    username: "",
    password: "",
    full_name: "",
    role: "" as UserRole | "",
    current_don_vi: undefined as number | undefined
  })

  const resetForm = React.useCallback(() => {
    setFormData({ username: "", password: "", full_name: "", role: "", current_don_vi: undefined })
    setMemberships([])
  }, [])

  React.useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open, resetForm])

  React.useEffect(() => {
    const run = async () => {
      if (!open) return
      try {
        setTenants(await fetchTenantList())
      } catch (error: unknown) {
        toast({
          variant: 'destructive',
          title: 'Lỗi tải danh sách đơn vị',
          description: getUnknownErrorMessage(error),
        })
      }
    }
    run()
  }, [open, toast])

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const id = await callRpc<number>({
        fn: 'user_create',
        args: {
          p_username: formData.username.trim(),
          p_password: formData.password,
          p_full_name: formData.full_name.trim(),
          p_role: formData.role,
          p_current_don_vi: formData.current_don_vi,
          p_memberships: memberships.length ? memberships : null,
        },
      })

      if (!id) {
        throw new Error('Không nhận được ID người dùng sau khi tạo')
      }

      return id
    },
    onSuccess: async () => {
      try {
        await queryClient.invalidateQueries({ queryKey: ["users-management"] })
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: "Không thể làm mới danh sách người dùng",
          description: getUnknownErrorMessage(error, "Vui lòng tải lại trang để xem dữ liệu mới nhất."),
        })
      }
      toast({ title: 'Thành công', description: 'Đã tạo tài khoản người dùng mới.' })
      onSuccess()
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      console.error('Error creating user:', error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: getUnknownErrorMessage(error, "Có lỗi xảy ra khi tạo tài khoản.")
      })
    },
  })
  const isPending = createUserMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.username || !formData.password || !formData.full_name || !formData.role || !formData.current_don_vi) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc (bao gồm Đơn vị hiện tại)."
      })
      return
    }

    createUserMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thêm người dùng mới</DialogTitle>
          <DialogDescription>
            Tạo tài khoản mới cho nhân viên. Tất cả thông tin có dấu * là bắt buộc.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Tên đăng nhập *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Nhập tên đăng nhập"
                disabled={isPending}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mật khẩu *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Nhập mật khẩu"
                disabled={isPending}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="full_name">Họ và tên *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Nhập họ và tên đầy đủ"
                disabled={isPending}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Vai trò *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) => setFormData(prev => ({ ...prev, role: value }))}
                disabled={isPending}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(USER_ROLES)
                    .flatMap(([key, label]) => key === 'admin' ? [] : [(
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    )])}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Đơn vị hiện tại *</Label>
              <Select
                value={formData.current_don_vi ? String(formData.current_don_vi) : ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, current_don_vi: Number(value) }))}
                disabled={isPending}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn đơn vị" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                      {t.code ? ` (${t.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Thành viên đơn vị (tùy chọn)</Label>
              <ScrollArea className="h-28 w-full rounded-md border p-2">
                <div className="flex flex-wrap gap-2">
                  {tenants.length > 0 ? (
                    tenants.map(t => {
                      const selected = memberships.includes(t.id) || t.id === formData.current_don_vi
                      return (
                        <Badge
                          key={t.id}
                          variant={selected ? 'default' : 'secondary'}
                          className="cursor-pointer select-none"
                          onClick={() => {
                            setMemberships(prev => {
                              if (prev.includes(t.id)) return prev.filter(x => x !== t.id)
                              return [...prev, t.id]
                            })
                          }}
                        >
                          {t.name}
                        </Badge>
                      )
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">Không có danh sách đơn vị.</p>
                  )}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">Mặc định hệ thống sẽ thêm đơn vị hiện tại vào danh sách thành viên.</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Tạo tài khoản
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
