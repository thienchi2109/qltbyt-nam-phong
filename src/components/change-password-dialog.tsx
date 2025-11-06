"use client"

import * as React from "react"
import { Loader2, Eye, EyeOff } from "lucide-react"

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
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useSession } from "next-auth/react"

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { toast } = useToast()
  const { data: session } = useSession()
  const user = session?.user as any // Cast NextAuth user to our User type
  const currentUserId = React.useMemo(() => {
    const rawId = user?.id
    if (typeof rawId === "number" && Number.isFinite(rawId)) {
      return rawId
    }
    if (typeof rawId === "string" && /^\d+$/.test(rawId)) {
      return parseInt(rawId, 10)
    }
    return null
  }, [user?.id])
  const [isLoading, setIsLoading] = React.useState(false)
  const [showPasswords, setShowPasswords] = React.useState({
    current: false,
    new: false,
    confirm: false
  })
  
  const [formData, setFormData] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })

  const resetForm = React.useCallback(() => {
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    })
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    })
  }, [])

  React.useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open, resetForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể xác định người dùng hiện tại."
      })
      return
    }

    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin."
      })
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Mật khẩu mới và xác nhận mật khẩu không khớp."
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
      if (currentUserId == null) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: "Không xác định được người dùng hiện tại."
        })
        setIsLoading(false)
        return
      }

      // Try to use the secure change_password function first
      const { data, error } = await supabase.rpc('change_password', {
        p_user_id: currentUserId,
        p_old_password: formData.currentPassword,
        p_new_password: formData.newPassword
      })

      // If function doesn't exist, fall back to direct update (temporary)
      if (error && (
        error.message?.includes('Could not find the function') ||
        error.message?.includes('function change_password') ||
        error.code === '42883' // Function does not exist error code
      )) {
        console.log('change_password function not found, using temporary fallback method')
        console.log('Error details:', error)

        // Verify current password manually
        const { data: currentUser, error: fetchError } = await supabase
          .from('nhan_vien')
          .select('password, hashed_password')
          .eq('id', currentUserId)
          .single()

        if (fetchError) {
          throw fetchError
        }

        // Check password (try hashed first, then plain text)
        let passwordValid = false
        if (currentUser.hashed_password && currentUser.hashed_password !== '') {
          // Try to verify with hashed password (this won't work client-side, so we'll use plain text comparison)
          passwordValid = currentUser.password === formData.currentPassword
        } else {
          passwordValid = currentUser.password === formData.currentPassword
        }

        if (!passwordValid) {
          toast({
            variant: "destructive",
            title: "Lỗi",
            description: "Mật khẩu hiện tại không đúng."
          })
          setIsLoading(false)
          return
        }

        // Update password directly
        const { error: updateError } = await supabase
          .from('nhan_vien')
          .update({ password: formData.newPassword })
          .eq('id', currentUserId)

        if (updateError) {
          throw updateError
        }

        toast({
          title: "Thành công",
          description: "Đã thay đổi mật khẩu thành công. (Chế độ tạm thời - vui lòng chạy script SQL để kích hoạt mã hóa mật khẩu)"
        })
      } else if (error) {
        console.error('Error from change_password function:', error)
        throw error
      } else {
        // Check if password change was successful (new JSON response format)
        if (!data || !data.success) {
          toast({
            variant: "destructive",
            title: "Lỗi",
            description: data?.message || "Mật khẩu hiện tại không đúng."
          })
          setIsLoading(false)
          return
        }

        toast({
          title: "Thành công",
          description: data.message || "Đã thay đổi mật khẩu thành công với mã hóa bảo mật."
        })
      }

      onOpenChange(false)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi thay đổi mật khẩu."
      })
    } finally {
      setIsLoading(false)
    }
  }

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thay đổi mật khẩu</DialogTitle>
          <DialogDescription>
            Nhập mật khẩu hiện tại và mật khẩu mới để thay đổi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Mật khẩu hiện tại *</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showPasswords.current ? "text" : "password"}
                  value={formData.currentPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Nhập mật khẩu hiện tại"
                  disabled={isLoading}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => togglePasswordVisibility('current')}
                  disabled={isLoading}
                >
                  {showPasswords.current ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">Mật khẩu mới *</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPasswords.new ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Nhập mật khẩu mới"
                  disabled={isLoading}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => togglePasswordVisibility('new')}
                  disabled={isLoading}
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Xác nhận mật khẩu mới *</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Nhập lại mật khẩu mới"
                  disabled={isLoading}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => togglePasswordVisibility('confirm')}
                  disabled={isLoading}
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
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
              Thay đổi mật khẩu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 