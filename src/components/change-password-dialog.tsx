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
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { signOutWithReason } from "@/lib/auth-signout"
import { callRpc } from "@/lib/rpc-client"
import { useSession } from "next-auth/react"

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ChangePasswordRpcResult = {
  success?: boolean
  message?: string
}

const PASSWORD_CHANGE_UNAVAILABLE_MESSAGE =
  "Dịch vụ đổi mật khẩu tạm thời không khả dụng. Vui lòng thử lại sau."

function isPasswordChangeUnavailableError(error: unknown): boolean {
  const message = getUnknownErrorMessage(error, "").toLowerCase()
  return (
    message.includes("could not find the function") ||
    message.includes("function change_password") ||
    message.includes("rpc change_password failed") ||
    message.includes("function not allowed")
  )
}

function getPasswordChangeErrorMessage(error: unknown): string {
  if (isPasswordChangeUnavailableError(error)) {
    return PASSWORD_CHANGE_UNAVAILABLE_MESSAGE
  }

  return getUnknownErrorMessage(error, "Có lỗi xảy ra khi thay đổi mật khẩu.")
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { toast } = useToast()
  const { data: session, update } = useSession()
  const user = session?.user
  const currentUserId = React.useMemo(() => {
    const rawId: unknown = user?.id
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

  const handlePostChangeSignOut = React.useCallback(async () => {
    try {
      await signOutWithReason({
        updateSession: update,
        reason: "forced_password_change",
        delayMs: 1_500,
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Đăng xuất chưa hoàn tất",
        description: "Mật khẩu đã được thay đổi. Vui lòng đăng xuất thủ công hoặc tải lại trang.",
      })
    }
  }, [toast, update])

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

    setIsLoading(true)
    let passwordChanged = false

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

      const data = await callRpc<ChangePasswordRpcResult>({
        fn: "change_password",
        args: {
          p_user_id: currentUserId,
          p_old_password: formData.currentPassword,
          p_new_password: formData.newPassword,
        },
      })

      if (!data?.success) {
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

      onOpenChange(false)
      passwordChanged = true
    } catch (error: unknown) {
      if (isPasswordChangeUnavailableError(error)) {
        try {
          console.error("Password change RPC unavailable:", error)
        } catch {}
      }
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: getPasswordChangeErrorMessage(error),
      })
    } finally {
      setIsLoading(false)
    }

    if (passwordChanged) {
      await handlePostChangeSignOut()
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
