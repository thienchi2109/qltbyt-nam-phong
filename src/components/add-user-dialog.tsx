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
import { supabase } from "@/lib/supabase"
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
  const [departments, setDepartments] = React.useState<{ label: string; value: string }[]>([])
  
  const [formData, setFormData] = React.useState({
    username: "",
    password: "",
    full_name: "",
    role: "" as UserRole | "",
    khoa_phong: ""
  })

  const resetForm = React.useCallback(() => {
    setFormData({
      username: "",
      password: "",
      full_name: "",
      role: "",
      khoa_phong: ""
    })
  }, [])

  React.useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open, resetForm])

  React.useEffect(() => {
    if (open) {
      fetchDepartments();
    }
  }, [open]);

  const fetchDepartments = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('thiet_bi')
        .select('khoa_phong_quan_ly')
        .not('khoa_phong_quan_ly', 'is', null);

      if (error) throw error;
      
      const uniqueDepartments = Array.from(new Set(data.map(item => item.khoa_phong_quan_ly).filter(Boolean)));
      setDepartments(
        uniqueDepartments.sort().map(dep => ({ value: dep, label: dep }))
      );
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi tải danh sách khoa phòng",
        description: error.message,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.username || !formData.password || !formData.full_name || !formData.role) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc."
      })
      return
    }

    if (!supabase) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể kết nối đến cơ sở dữ liệu."
      })
      return
    }

    setIsLoading(true)

    try {
      // Try to use the secure create_user function first
      const { data, error } = await supabase.rpc('create_user', {
        p_username: formData.username.trim(),
        p_password: formData.password,
        p_full_name: formData.full_name.trim(),
        p_role: formData.role,
        p_khoa_phong: formData.khoa_phong.trim() || null
      })

      // If function doesn't exist, fall back to direct insert (temporary)
      if (error && (
        error.message?.includes('Could not find the function') ||
        error.message?.includes('function create_user') ||
        error.code === '42883' // Function does not exist error code
      )) {
        console.log('create_user function not found, using temporary fallback method')
        console.log('Error details:', error)

        // Validate username format manually since we don't have the function
        const username = formData.username.trim()
        if (!username || username.includes(' ')) {
          toast({
            variant: "destructive",
            title: "Lỗi",
            description: "Tên đăng nhập không được chứa khoảng trắng và không được để trống."
          })
          return
        }

        const { error: insertError } = await supabase
          .from('nhan_vien')
          .insert({
            username: username,
            password: formData.password,
            full_name: formData.full_name.trim(),
            role: formData.role,
            khoa_phong: formData.khoa_phong.trim() || null
          })

        if (insertError) {
          if (insertError.code === '23505') {
            toast({
              variant: "destructive",
              title: "Lỗi",
              description: "Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác."
            })
          } else {
            throw insertError
          }
          return
        }

        toast({
          title: "Thành công",
          description: "Đã tạo tài khoản người dùng mới. (Chế độ tạm thời - vui lòng chạy script SQL để kích hoạt mã hóa mật khẩu)"
        })
      } else if (error) {
        console.error('Error from create_user function:', error)
        if (error.message?.includes('Invalid username format')) {
          toast({
            variant: "destructive",
            title: "Lỗi",
            description: "Định dạng tên đăng nhập không hợp lệ. Tên đăng nhập không được chứa khoảng trắng."
          })
        } else if (error.message?.includes('duplicate key value') || error.code === '23505') {
          toast({
            variant: "destructive",
            title: "Lỗi",
            description: "Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác."
          })
        } else {
          throw error
        }
        return
      } else {
        // Success with create_user function
        toast({
          title: "Thành công",
          description: "Đã tạo tài khoản người dùng mới với mật khẩu được mã hóa."
        })
      }

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
                  {Object.entries(USER_ROLES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="khoa_phong">Khoa/Phòng</Label>
              <Input
                id="khoa_phong"
                value={formData.khoa_phong}
                onChange={(e) => setFormData(prev => ({ ...prev, khoa_phong: e.target.value }))}
                placeholder="Nhập hoặc chọn khoa/phòng bên dưới"
                disabled={isLoading}
              />
              <ScrollArea className="h-24 w-full rounded-md border p-2">
                <div className="flex flex-wrap gap-2">
                  {departments.length > 0 ? (
                    departments.map((dep) => (
                      <Badge
                        key={dep.value}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                        onClick={() => setFormData(prev => ({ ...prev, khoa_phong: dep.value }))}
                      >
                        {dep.label}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Không có gợi ý khoa/phòng.</p>
                  )}
                </div>
              </ScrollArea>
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