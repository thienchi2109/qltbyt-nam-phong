"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchTenantList } from "@/components/add-equipment-dialog.queries"
import { useToast } from "@/hooks/use-toast"
import { getUnknownErrorMessage } from "@/lib/error-utils"

/** Loads unit options shared by user creation and expert scope editing. */
export function useUserManagementTenants(enabled: boolean) {
  const { toast } = useToast()

  return useQuery({
    queryKey: ["user-management-tenants"],
    queryFn: async () => {
      try {
        return await fetchTenantList()
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: "Lỗi tải danh sách đơn vị",
          description: getUnknownErrorMessage(error),
        })
        return []
      }
    },
    enabled,
  })
}
