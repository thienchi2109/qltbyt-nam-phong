"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { AddUserDialog } from "@/components/add-user-dialog"
import { EditUserDialog } from "@/components/edit-user-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { UserSummary } from "@/types/database"

type UsersDialogsProps = {
  isAddDialogOpen: boolean
  onAddDialogOpenChange: (open: boolean) => void
  onSuccess: () => void
  editingUser: UserSummary | null
  onEditingUserChange: (user: UserSummary | null) => void
  userToDelete: UserSummary | null
  onUserToDeleteChange: (user: UserSummary | null) => void
  isDeletingUser: boolean
  onDeleteUser: () => Promise<void>
  userToReset: UserSummary | null
  onUserToResetChange: (user: UserSummary | null) => void
  isResettingPassword: boolean
  onResetPassword: () => Promise<void>
}

export function UsersDialogs({
  isAddDialogOpen,
  onAddDialogOpenChange,
  onSuccess,
  editingUser,
  onEditingUserChange,
  userToDelete,
  onUserToDeleteChange,
  isDeletingUser,
  onDeleteUser,
  userToReset,
  onUserToResetChange,
  isResettingPassword,
  onResetPassword,
}: UsersDialogsProps) {
  return (
    <>
      <AddUserDialog
        open={isAddDialogOpen}
        onOpenChange={onAddDialogOpenChange}
        onSuccess={onSuccess}
      />
      <EditUserDialog
        open={!!editingUser}
        onOpenChange={(open) => !open && onEditingUserChange(null)}
        onSuccess={onSuccess}
        user={editingUser}
      />
      {userToDelete && (
        <AlertDialog
          open={!!userToDelete}
          onOpenChange={(open) => !open && onUserToDeleteChange(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa người dùng &quot;{userToDelete.full_name}&quot;? Hành
                động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingUser}>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={onDeleteUser} disabled={isDeletingUser}>
                {isDeletingUser && <Loader2 className="mr-2 size-4 animate-spin" />}
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <AlertDialog
        open={!!userToReset}
        onOpenChange={(open) => !open && onUserToResetChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đặt lại mật khẩu</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn đặt lại mật khẩu cho &quot;{userToReset?.full_name}&quot; về
              giá trị mặc định?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingPassword}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={onResetPassword} disabled={isResettingPassword}>
              {isResettingPassword && <Loader2 className="mr-2 size-4 animate-spin" />}
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
