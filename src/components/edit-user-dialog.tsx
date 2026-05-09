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
import { USER_ROLES, type UserRole, type UserSummary } from "@/types/database"

interface EditUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  user: UserSummary | null
}

export function EditUserDialog({ open, onOpenChange, onSuccess, user }: EditUserDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(false)
  
  const [formData, setFormData] = React.useState({
    username: "",
    full_name: "",
    role: "" as UserRole | "",
    khoa_phong: ""
  })

  React.useEffect(() => {
    if (user && open) {
      setFormData({
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        khoa_phong: user.khoa_phong || ""
      })
    } else if (!open) {
      setFormData({
        username: "",
        full_name: "",
        role: "",
        khoa_phong: ""
      })
    }
  }, [user, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !formData.username || !formData.full_name || !formData.role) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc."
      })
      return
    }

    setIsLoading(true)

    try {
      await callRpc<boolean>({
        fn: "user_update_profile",
        args: {
          p_target_user_id: user.id,
          p_username: formData.username.trim(),
          p_full_name: formData.full_name.trim(),
          p_role: formData.role,
          p_khoa_phong: formData.khoa_phong.trim() || null,
        },
      })

      toast({
        title: "Thành công",
        description: "Đã cập nhật thông tin người dùng."
      })

      onSuccess()
      onOpenChange(false)
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: getUnknownErrorMessage(error, "Có lỗi xảy ra khi cập nhật thông tin.")
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa người dùng</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin tài khoản. Tất cả thông tin có dấu * là bắt buộc.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-username">Tên đăng nhập *</Label>
              <Input
                id="edit-username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Nhập tên đăng nhập"
                disabled={isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-full_name">Họ và tên *</Label>
              <Input
                id="edit-full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Nhập họ và tên đầy đủ"
                disabled={isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Vai trò *</Label>
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
              <Label htmlFor="edit-khoa_phong">Khoa/Phòng</Label>
              <Input
                id="edit-khoa_phong"
                value={formData.khoa_phong}
                onChange={(e) => setFormData(prev => ({ ...prev, khoa_phong: e.target.value }))}
                placeholder="Nhập khoa/phòng làm việc"
                disabled={isLoading}
              />
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
              Cập nhật
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 
