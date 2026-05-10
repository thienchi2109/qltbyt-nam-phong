"use client"

import * as React from "react"
import type { PaginationState, SortingState } from "@tanstack/react-table"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useSearchDebounce } from "@/hooks/use-debounce"
import { useToast } from "@/hooks/use-toast"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { callRpc } from "@/lib/rpc-client"
import type { SessionUser, UserSummary } from "@/types/database"

type ResetPasswordByAdminResult = {
  success?: boolean
  message?: string
}

type UseUsersManagementOptions = {
  user: SessionUser
  enabled: boolean
}

const usersManagementKeys = {
  all: ["users-management"] as const,
}

export function useUsersManagement({ user, enabled }: UseUsersManagementOptions) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [globalFilter, setGlobalFilter] = React.useState("")
  const debouncedSearch = useSearchDebounce(globalFilter)

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<UserSummary | null>(null)
  const [userToDelete, setUserToDelete] = React.useState<UserSummary | null>(null)
  const [userToReset, setUserToReset] = React.useState<UserSummary | null>(null)

  const usersQuery = useQuery({
    queryKey: usersManagementKeys.all,
    queryFn: () =>
      callRpc<UserSummary[]>({
        fn: "user_list_for_admin",
      }),
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  React.useEffect(() => {
    if (usersQuery.isError) {
      toast({
        variant: "destructive",
        title: "Lỗi tải danh sách người dùng",
        description: getUnknownErrorMessage(usersQuery.error),
      })
    }
  }, [toast, usersQuery.error, usersQuery.isError])

  const refreshUsers = React.useCallback(async () => {
    if (!enabled) return
    await usersQuery.refetch()
  }, [enabled, usersQuery])

  const deleteMutation = useMutation({
    mutationFn: async (targetUserId: UserSummary["id"]) => {
      const deleted = await callRpc<boolean>({
        fn: "user_delete_by_admin",
        args: {
          p_target_user_id: targetUserId,
        },
      })

      if (deleted === false) {
        throw new Error("Không thể xóa người dùng này.")
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersManagementKeys.all })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (targetUserId: UserSummary["id"]) => {
      const data = await callRpc<ResetPasswordByAdminResult>({
        fn: "reset_password_by_admin",
        args: {
          p_admin_user_id: user.id,
          p_target_user_id: targetUserId,
        },
      })

      if (data.success === false) {
        throw new Error(data.message || "Không thể đặt lại mật khẩu cho người dùng này.")
      }

      return data
    },
  })

  const handleDeleteUser = React.useCallback(async () => {
    if (!userToDelete) return

    if (String(userToDelete.id) === String(user.id)) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Bạn không thể xóa tài khoản của chính mình.",
      })
      setUserToDelete(null)
      return
    }

    try {
      await deleteMutation.mutateAsync(userToDelete.id)
      toast({ title: "Đã xóa", description: "Người dùng đã được xóa thành công." })
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Lỗi xóa người dùng",
        description: getUnknownErrorMessage(error),
      })
    } finally {
      setUserToDelete(null)
    }
  }, [deleteMutation, userToDelete, toast, user.id])

  const handleResetPassword = React.useCallback(async () => {
    if (!userToReset) return

    try {
      const data = await resetPasswordMutation.mutateAsync(userToReset.id)

      const message =
        data.message ||
        `Mật khẩu của ${userToReset.full_name} đã được đặt lại thành "userqltb".`

      toast({
        title: "Thành công",
        description: message,
      })
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Lỗi đặt lại mật khẩu",
        description: getUnknownErrorMessage(
          error,
          "Không thể đặt lại mật khẩu cho người dùng này.",
        ),
      })
    } finally {
      setUserToReset(null)
    }
  }, [resetPasswordMutation, userToReset, toast])

  return {
    users: usersQuery.data ?? [],
    isLoading: enabled ? usersQuery.isLoading || usersQuery.isFetching : false,
    sorting,
    setSorting,
    pagination,
    setPagination,
    globalFilter,
    setGlobalFilter,
    debouncedSearch,
    isAddDialogOpen,
    setIsAddDialogOpen,
    editingUser,
    setEditingUser,
    userToDelete,
    setUserToDelete,
    isDeletingUser: deleteMutation.isPending,
    handleDeleteUser,
    userToReset,
    setUserToReset,
    isResettingPassword: resetPasswordMutation.isPending,
    handleResetPassword,
    refreshUsers,
  }
}
