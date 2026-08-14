"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { useDeviceQuotaManualMappingEquipment } from "../../_hooks/useDeviceQuotaManualMappingEquipment"
import { filterCategoriesWithAncestorsAndDescendants } from "../../categories/_utils/filterCategoriesWithAncestorsAndDescendants"
import { useLinkEquipmentMutation } from "./DeviceQuotaMappingMutations"
import type { AuthUser, Category, DeviceQuotaMappingContextValue } from "./DeviceQuotaMappingTypes"
export type { Category, DeviceQuotaMappingContextValue } from "./DeviceQuotaMappingTypes"

// ============================================
function useFilteredCategories(allCategories: Category[], searchTerm: string): Category[] {
  return React.useMemo(
    () => filterCategoriesWithAncestorsAndDescendants(allCategories, searchTerm),
    [allCategories, searchTerm]
  )
}

/** Context contract retained by the existing Mapping route composition. */
const DeviceQuotaMappingContext = React.createContext<DeviceQuotaMappingContextValue | null>(null)

interface DeviceQuotaMappingProviderProps {
  children: React.ReactNode
}

/** Adapts shared manual-mapping state to the existing Mapping route behavior. */
export function DeviceQuotaMappingProvider({ children }: DeviceQuotaMappingProviderProps) {
  const { toast } = useToast()
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null
  const { selectedFacilityId, showSelector } = useTenantSelection()

  const userDonViId = user?.don_vi ? parseInt(user.don_vi, 10) : null
  const isFacilitySelected = !showSelector || typeof selectedFacilityId === "number"
  const donViId = showSelector
    ? typeof selectedFacilityId === "number"
      ? selectedFacilityId
      : null
    : userDonViId

  const manualMapping = useDeviceQuotaManualMappingEquipment({ donViId })
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number | null>(null)
  const [categorySearchTerm, setCategorySearchTerm] = React.useState("")

  // Fetch categories
  const {
    data: allCategoriesData,
    isLoading: isLoadingCategories,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ["dinh_muc_nhom_list", { donViId }],
    queryFn: async () => {
      const result = await callRpc<Category[]>({
        fn: "dinh_muc_nhom_list",
        args: { p_don_vi: donViId },
      })
      return result || []
    },
    enabled: !!donViId,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  })

  const allCategories: Category[] = React.useMemo(
    () => allCategoriesData || [],
    [allCategoriesData]
  )

  // Client-side category search with ancestor + descendant preservation
  const categories = useFilteredCategories(allCategories, categorySearchTerm)

  const clearSelection = React.useCallback(() => {
    manualMapping.clearEquipmentSelection()
    setSelectedCategoryId(null)
  }, [manualMapping.clearEquipmentSelection])

  const linkMutation = useLinkEquipmentMutation(toast, clearSelection, donViId)

  const refetch = React.useCallback(() => {
    manualMapping.refetch()
    void refetchCategories()
  }, [manualMapping.refetch, refetchCategories])

  const value = React.useMemo<DeviceQuotaMappingContextValue>(
    () => ({
      user,
      donViId,
      isFacilitySelected,
      ...manualMapping,
      allCategories,
      categories,
      selectedCategoryId,
      setSelectedCategory: setSelectedCategoryId,
      categorySearchTerm,
      setCategorySearchTerm,
      linkEquipment: linkMutation,
      isLoading: manualMapping.isLoading || isLoadingCategories,
      isLinking: linkMutation.isPending,
      refetch,
    }),
    [
      user,
      donViId,
      isFacilitySelected,
      manualMapping,
      allCategories,
      categories,
      selectedCategoryId,
      categorySearchTerm,
      linkMutation,
      isLoadingCategories,
      refetch,
    ]
  )

  return (
    <DeviceQuotaMappingContext.Provider value={value}>
      {children}
    </DeviceQuotaMappingContext.Provider>
  )
}

export { DeviceQuotaMappingContext }
