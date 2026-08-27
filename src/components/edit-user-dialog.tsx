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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { isTechnicalConfigurationExpertRole } from "@/lib/rbac"
import { callRpc } from "@/lib/rpc-client"
import { getUserManagementRoleOptions } from "@/components/user-management-role-options"
import { useUserManagementTenants } from "@/components/use-user-management-tenants"
import type { UserRole, UserSummary } from "@/types/database"
import { useMutation, useQueryClient } from "@tanstack/react-query"

interface EditUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  operatorRole: string
  user: UserSummary | null
}

const EMPTY_EDIT_USER_FORM = {
  username: "",
  full_name: "",
  role: "" as UserRole | "",
  khoa_phong: "",
  current_don_vi: undefined as number | undefined,
}

function getEditUserForm(user: UserSummary | null) {
  if (!user) return EMPTY_EDIT_USER_FORM
  return {
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    khoa_phong: user.khoa_phong || "",
    current_don_vi: user.current_don_vi ?? undefined,
  }
}

/** Renders the user edit dialog without overwriting in-progress drafts on refresh. */
export function EditUserDialog({
  open,
  onOpenChange,
  onSuccess,
  operatorRole,
  user,
}: EditUserDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const activeUserId = open ? (user?.id ?? null) : null
  const loadedUserIdRef = React.useRef<number | null>(activeUserId)
  const [formData, setFormData] = React.useState(() => getEditUserForm(open ? user : null))

  if (loadedUserIdRef.current !== activeUserId) {
    loadedUserIdRef.current = activeUserId
    setFormData(getEditUserForm(open ? user : null))
  }

  const roleOptions = getUserManagementRoleOptions(operatorRole)
  const isExpertRole = isTechnicalConfigurationExpertRole(formData.role)
  const { data: tenants = [] } = useUserManagementTenants(open && isExpertRole)

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        loadedUserIdRef.current = null
        setFormData(EMPTY_EDIT_USER_FORM)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Không có người dùng để cập nhật")
      }

      const isExistingExpert = isTechnicalConfigurationExpertRole(user.role)
      const isScopeChange =
        isExistingExpert &&
        isExpertRole &&
        formData.current_don_vi != null &&
        formData.current_don_vi !== user.current_don_vi

      if (isScopeChange) {
        await callRpc<void>({
          fn: "user_reassign_expert_scope",
          args: {
            p_user_id: user.id,
            p_don_vi: formData.current_don_vi,
          },
        })
        return
      }

      const updated = await callRpc<boolean>({
        fn: "user_update_profile",
        args: {
          p_target_user_id: user.id,
          p_username: formData.username.trim(),
          p_full_name: formData.full_name.trim(),
          p_role: formData.role,
          p_khoa_phong: formData.khoa_phong.trim() || null,
        },
      })

      if (updated === false) {
        throw new Error("Không thể cập nhật thông tin người dùng")
      }
    },
    onSuccess: async () => {
      try {
        await queryClient.invalidateQueries({ queryKey: ["users-management"] })
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: "Không thể làm mới danh sách người dùng",
          description: getUnknownErrorMessage(
            error,
            "Vui lòng tải lại trang để xem dữ liệu mới nhất."
          ),
        })
      }
      toast({
        title: "Thành công",
        description: "Đã cập nhật thông tin người dùng.",
      })
      onSuccess()
      handleOpenChange(false)
    },
    onError: (error: unknown) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: getUnknownErrorMessage(error, "Có lỗi xảy ra khi cập nhật thông tin."),
      })
    },
  })
  const isPending = updateUserMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !user ||
      !formData.username ||
      !formData.full_name ||
      !formData.role ||
      (isExpertRole && !formData.current_don_vi)
    ) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: isExpertRole
          ? "Vui lòng điền đầy đủ thông tin bắt buộc, bao gồm Đơn vị chuyên gia."
          : "Vui lòng điền đầy đủ thông tin bắt buộc.",
      })
      return
    }

    const isExistingExpert = isTechnicalConfigurationExpertRole(user.role)
    const isScopeChange =
      isExpertRole &&
      formData.current_don_vi != null &&
      formData.current_don_vi !== user.current_don_vi
    const isProfileChange =
      formData.username.trim() !== user.username ||
      formData.full_name.trim() !== user.full_name ||
      (formData.khoa_phong.trim() || null) !== (user.khoa_phong?.trim() || null)

    if (isExpertRole && !isExistingExpert && isScopeChange) {
      toast({
        variant: "destructive",
        title: "Không thể đổi vai trò và đơn vị cùng lúc",
        description:
          "Hãy đổi vai trò với đơn vị hiện tại trước, sau đó đổi phạm vi chuyên gia ở lần cập nhật riêng.",
      })
      return
    }

    if (isExistingExpert && isExpertRole && isScopeChange && isProfileChange) {
      toast({
        variant: "destructive",
        title: "Không thể cập nhật đồng thời",
        description:
          "Vui lòng cập nhật thông tin và đổi đơn vị theo từng bước riêng để tránh trạng thái cập nhật một phần.",
      })
      return
    }

    updateUserMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="Nhập tên đăng nhập"
                disabled={isPending}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-full_name">Họ và tên *</Label>
              <Input
                id="edit-full_name"
                value={formData.full_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Nhập họ và tên đầy đủ"
                disabled={isPending}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Vai trò *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) =>
                  setFormData((prev) => ({ ...prev, role: value }))
                }
                disabled={isPending}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isExpertRole && (
              <div className="grid gap-2">
                <Label>Đơn vị chuyên gia *</Label>
                <Select
                  value={formData.current_don_vi ? String(formData.current_don_vi) : ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, current_don_vi: Number(value) }))
                  }
                  disabled={isPending}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn đơn vị" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={String(tenant.id)}>
                        {tenant.name}
                        {tenant.code ? ` (${tenant.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="edit-khoa_phong">Khoa/Phòng</Label>
              <Input
                id="edit-khoa_phong"
                value={formData.khoa_phong}
                onChange={(e) => setFormData((prev) => ({ ...prev, khoa_phong: e.target.value }))}
                placeholder="Nhập khoa/phòng làm việc"
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Cập nhật
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
