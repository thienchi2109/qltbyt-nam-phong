"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"

import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { translateRpcError } from "@/lib/error-translations"
import type {
  CategoryDeleteState,
  CategoryDialogState,
  CategoryFormInput,
  CategoryListItem,
} from "../_types/categories"

interface AuthUser {
  id: string
  username: string
  full_name?: string | null
  role: string
  don_vi?: string | null
  dia_ban_id?: number | null
}

interface CategoryContextValue {
  // User/Auth
  user: AuthUser | null
  donViId: number | null

  // Data
  categories: CategoryListItem[]
  isLoading: boolean

  // Dialog state (discriminated union)
  dialogState: CategoryDialogState
  mutatingCategoryId: number | null

  // Delete state
  categoryToDelete: CategoryDeleteState["categoryToDelete"]

  // Dialog actions
  openCreateDialog: () => void
  openEditDialog: (category: CategoryListItem) => void
  closeDialog: () => void
  openDeleteDialog: (category: CategoryListItem) => void
  closeDeleteDialog: () => void

  // Mutations
  createMutation: ReturnType<typeof useCreateMutation>
  updateMutation: ReturnType<typeof useUpdateMutation>
  deleteMutation: ReturnType<typeof useDeleteMutation>

  // Import dialog (Phase 2)
  isImportDialogOpen: boolean
  openImportDialog: () => void
  closeImportDialog: () => void

  // Helpers
  getDescendantIds: (parentId: number) => Set<number>
}

// ============================================
// Mutation Hooks
// ============================================

function useCreateMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void,
  closeDialog: () => void,
  donViId: number | null
) {
  return useMutation({
    mutationFn: async (data: CategoryFormInput) => {
      if (!donViId) {
        throw new Error("Thiếu thông tin đơn vị (don_vi)")
      }
      return callRpc({
        fn: "dinh_muc_nhom_upsert",
        args: {
          p_id: null,
          p_don_vi: donViId,
          p_parent_id: data.parent_id,
          p_ma_nhom: data.ma_nhom,
          p_ten_nhom: data.ten_nhom,
          p_phan_loai: data.phan_loai,
          p_don_vi_tinh: data.don_vi_tinh,
          p_thu_tu_hien_thi: data.thu_tu_hien_thi,
          p_mo_ta: data.mo_ta,
        },
      })
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã tạo danh mục thiết bị.",
      })
      closeDialog()
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Tạo danh mục thất bại",
        description: translateRpcError(error.message),
      })
    },
  })
}

function useUpdateMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void,
  closeDialog: () => void,
  setMutatingCategoryId: (id: number | null) => void,
  donViId: number | null
) {
  return useMutation({
    mutationFn: async (data: CategoryFormInput & { id: number }) => {
      if (!donViId) {
        throw new Error("Thiếu thông tin đơn vị (don_vi)")
      }
      return callRpc({
        fn: "dinh_muc_nhom_upsert",
        args: {
          p_id: data.id,
          p_don_vi: donViId,
          p_parent_id: data.parent_id,
          p_ma_nhom: data.ma_nhom,
          p_ten_nhom: data.ten_nhom,
          p_phan_loai: data.phan_loai,
          p_don_vi_tinh: data.don_vi_tinh,
          p_thu_tu_hien_thi: data.thu_tu_hien_thi,
          p_mo_ta: data.mo_ta,
        },
      })
    },
    onMutate: (data) => {
      setMutatingCategoryId(data.id)
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã cập nhật danh mục.",
      })
      closeDialog()
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: translateRpcError(error.message),
      })
    },
    onSettled: () => {
      setMutatingCategoryId(null)
    },
  })
}

function useDeleteMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void,
  closeDeleteDialog: () => void,
  setMutatingCategoryId: (id: number | null) => void,
  donViId: number | null
) {
  return useMutation({
    mutationFn: async (id: number) => {
      if (!donViId) {
        throw new Error("Thiếu thông tin đơn vị (don_vi)")
      }
      return callRpc({
        fn: "dinh_muc_nhom_delete",
        args: {
          p_id: id,
          p_don_vi: donViId,
        },
      })
    },
    onMutate: (id) => {
      setMutatingCategoryId(id)
    },
    onSuccess: () => {
      toast({
        title: "Đã xóa",
        description: "Danh mục đã được xóa.",
      })
      closeDeleteDialog()
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Xóa danh mục thất bại",
        description: translateRpcError(error.message),
      })
    },
    onSettled: () => {
      setMutatingCategoryId(null)
    },
  })
}

// ============================================
// Context
// ============================================

const DeviceQuotaCategoryContext = React.createContext<CategoryContextValue | null>(null)

// ============================================
// Provider
// ============================================

interface DeviceQuotaCategoryProviderProps {
  children: React.ReactNode
}

export function DeviceQuotaCategoryProvider({ children }: DeviceQuotaCategoryProviderProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null

  const donViId = user?.don_vi ? parseInt(user.don_vi, 10) : null

  const [dialogState, setDialogState] = React.useState<CategoryDialogState>({ mode: "closed" })
  const [mutatingCategoryId, setMutatingCategoryId] = React.useState<number | null>(null)
  const [categoryToDelete, setCategoryToDelete] = React.useState<CategoryListItem | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false)

  const {
    data: categoriesData,
    isLoading: isLoadingCategories,
  } = useQuery({
    queryKey: ["dinh_muc_nhom_list", { donViId }],
    queryFn: async () => {
      const result = await callRpc<CategoryListItem[]>({
        fn: "dinh_muc_nhom_list",
        args: { p_don_vi: donViId },
      })
      return result || []
    },
    enabled: !!donViId,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  })

  const invalidateAndRefetch = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["dinh_muc_nhom_list"] })
    queryClient.invalidateQueries({ queryKey: ["dinh_muc_compliance_summary"] })
  }, [queryClient])

  const openCreateDialog = React.useCallback(() => {
    setDialogState({ mode: "create" })
  }, [])

  const openEditDialog = React.useCallback((category: CategoryListItem) => {
    setDialogState({ mode: "edit", category })
  }, [])

  const closeDialog = React.useCallback(() => {
    setDialogState({ mode: "closed" })
  }, [])

  const openDeleteDialog = React.useCallback((category: CategoryListItem) => {
    setCategoryToDelete(category)
  }, [])

  const closeDeleteDialog = React.useCallback(() => {
    setCategoryToDelete(null)
  }, [])

  const openImportDialog = React.useCallback(() => {
    setIsImportDialogOpen(true)
  }, [])

  const closeImportDialog = React.useCallback(() => {
    setIsImportDialogOpen(false)
  }, [])

  const createMutation = useCreateMutation(
    toast,
    invalidateAndRefetch,
    closeDialog,
    donViId
  )

  const updateMutation = useUpdateMutation(
    toast,
    invalidateAndRefetch,
    closeDialog,
    setMutatingCategoryId,
    donViId
  )

  const deleteMutation = useDeleteMutation(
    toast,
    invalidateAndRefetch,
    closeDeleteDialog,
    setMutatingCategoryId,
    donViId
  )

  const getDescendantIds = React.useCallback(
    (parentId: number) => {
      const categories = categoriesData || []
      const descendants = new Set<number>()
      const stack = [parentId]

      while (stack.length > 0) {
        const current = stack.pop()!
        for (const cat of categories) {
          if (cat.parent_id === current && !descendants.has(cat.id)) {
            descendants.add(cat.id)
            stack.push(cat.id)
          }
        }
      }

      return descendants
    },
    [categoriesData]
  )

  const value = React.useMemo<CategoryContextValue>(
    () => ({
      user,
      donViId,
      categories: categoriesData || [],
      isLoading: isLoadingCategories,
      dialogState,
      mutatingCategoryId,
      categoryToDelete,
      openCreateDialog,
      openEditDialog,
      closeDialog,
      openDeleteDialog,
      closeDeleteDialog,
      createMutation,
      updateMutation,
      deleteMutation,
      isImportDialogOpen,
      openImportDialog,
      closeImportDialog,
      getDescendantIds,
    }),
    [
      user,
      donViId,
      categoriesData,
      isLoadingCategories,
      dialogState,
      mutatingCategoryId,
      categoryToDelete,
      openCreateDialog,
      openEditDialog,
      closeDialog,
      openDeleteDialog,
      closeDeleteDialog,
      createMutation,
      updateMutation,
      deleteMutation,
      isImportDialogOpen,
      openImportDialog,
      closeImportDialog,
      getDescendantIds,
    ]
  )

  return (
    <DeviceQuotaCategoryContext.Provider value={value}>
      {children}
    </DeviceQuotaCategoryContext.Provider>
  )
}

export { DeviceQuotaCategoryContext }
export type { CategoryContextValue }
