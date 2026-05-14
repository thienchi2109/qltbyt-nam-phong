"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"

import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { filterCategoriesWithAncestorsAndDescendants } from "../_utils/filterCategoriesWithAncestorsAndDescendants"
import type {
  CategoryDeleteState,
  CategoryDialogState,
  CategoryListItem,
} from "../_types/categories"
import {
  useCreateMutation,
  useDeleteMutation,
  useUpdateMutation,
} from "./DeviceQuotaCategoryMutations"

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

  // Data — `categories` is search-filtered, `allCategories` is the full set
  categories: CategoryListItem[]
  allCategories: CategoryListItem[]
  isLoading: boolean

  // Search
  searchTerm: string
  setSearchTerm: (term: string) => void

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

  // Search state (instant client-side filtering, no debounce needed for < 500 items)
  const [searchTerm, setSearchTerm] = React.useState("")

  // Single query — fetch ALL categories once (< 500 items, no pagination needed)
  const {
    data: allCategoriesData,
    isLoading,
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

  const allCategories: CategoryListItem[] = React.useMemo(
    () => allCategoriesData || [],
    [allCategoriesData]
  )

  // Client-side search with ancestor + descendant preservation.
  // Categories page extends matching to include mo_ta.
  const categories: CategoryListItem[] = React.useMemo(
    () =>
      filterCategoriesWithAncestorsAndDescendants(allCategories, searchTerm, {
        matchFn: (cat, needle) =>
          cat.ma_nhom?.toLowerCase().includes(needle) ||
          cat.ten_nhom?.toLowerCase().includes(needle) ||
          (cat.mo_ta ?? "").toLowerCase().includes(needle),
      }),
    [allCategories, searchTerm]
  )

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
    closeDialog,
    donViId
  )

  const updateMutation = useUpdateMutation(
    toast,
    closeDialog,
    setMutatingCategoryId,
    donViId
  )

  const deleteMutation = useDeleteMutation(
    toast,
    closeDeleteDialog,
    setMutatingCategoryId,
    donViId
  )

  const getDescendantIds = React.useCallback(
    (parentId: number) => {
      const descendants = new Set<number>()
      const stack = [parentId]

      while (stack.length > 0) {
        const current = stack.pop()!
        for (const cat of allCategories) {
          if (cat.parent_id === current && !descendants.has(cat.id)) {
            descendants.add(cat.id)
            stack.push(cat.id)
          }
        }
      }

      return descendants
    },
    [allCategories]
  )

  const value = React.useMemo<CategoryContextValue>(
    () => ({
      user,
      donViId,
      categories,
      allCategories,
      isLoading,
      searchTerm,
      setSearchTerm,
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
      categories,
      allCategories,
      isLoading,
      searchTerm,
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
