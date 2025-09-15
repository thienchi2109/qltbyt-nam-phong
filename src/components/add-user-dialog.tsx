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
import { callRpc } from "@/lib/rpc-client"
import { USER_ROLES, type UserRole } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AddUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddUserDialog({ open, onOpenChange, onSuccess }: AddUserDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(false)
  const [tenants, setTenants] = React.useState<{ id: number; code: string; name: string }[]>([])
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
        const list = await callRpc<any[]>({ fn: 'tenant_list', args: {} })
        setTenants((list || []).map(t => ({ id: t.id, code: t.code, name: t.name })))
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Lỗi tải danh sách đơn vị', description: e?.message || '' })
      }
    }
    run()
  }, [open, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.username || !formData.password || !formData.full_name || !formData.role || !formData.current_don_vi) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc (bao gồm Đơn vị hiện tại)."
      })
      return
    }

    setIsLoading(true)

    try {
      // Create user via RPC with current don_vi + memberships
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

      toast({ title: 'Thành công', description: 'Đã tạo tài khoản người dùng mới.' })

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error creating user:', error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi tạo tài khoản."
      })
    } finally {
      setIsLoading(false)
    }
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
                disabled={isLoading}
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
                disabled={isLoading}
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
                disabled={isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Vai trò *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) => setFormData(prev => ({ ...prev, role: value }))}
                disabled={isLoading}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(USER_ROLES)
                    .filter(([key]) => key !== 'admin')
                    .map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Đơn vị hiện tại *</Label>
              <Select
                value={formData.current_don_vi ? String(formData.current_don_vi) : ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, current_don_vi: Number(value) }))}
                disabled={isLoading}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn đơn vị" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} ({t.code})
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
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo tài khoản
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 