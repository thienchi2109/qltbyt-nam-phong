"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useSearchDebounce } from "@/hooks/use-debounce"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import {
  getTransferDialogErrorMessage,
  mapEquipmentSearchResults,
} from "@/components/transfer-dialog.shared"

type EquipmentListEnhancedResponse = {
  data?: unknown[] | null
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  )
}

async function fetchTransferDepartments(): Promise<string[]> {
  const list = await callRpc<{ name: string }[]>({
    fn: "departments_list",
    args: {},
  })

  return (list || []).map((item) => item.name).filter(Boolean)
}

export const transferDialogQueryKeys = {
  departments: ["departments_list"] as const,
  equipmentSearch: (searchTerm: string) =>
    ["equipment_list_enhanced", "transfer-dialog", { q: searchTerm }] as const,
}

export function useTransferDepartments({ open }: { open: boolean }) {
  const { toast } = useToast()
  const query = useQuery({
    queryKey: transferDialogQueryKeys.departments,
    queryFn: fetchTransferDepartments,
    enabled: open,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  React.useEffect(() => {
    if (!query.error || isAbortError(query.error)) {
      return
    }

    toast({
      variant: "destructive",
      title: "Lỗi tải danh sách khoa phòng",
      description: getTransferDialogErrorMessage(
        query.error,
        "Không thể tải danh sách khoa phòng.",
      ),
    })
  }, [toast, query.error, query.errorUpdatedAt])

  return {
    departments: query.data ?? [],
    isLoadingDepartments: query.isLoading,
  }
}

export function useTransferEquipmentSearch({
  open,
  canSearch,
  searchTerm,
}: {
  open: boolean
  canSearch: boolean
  searchTerm: string
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const debouncedSearch = useSearchDebounce(searchTerm)
  const trimmedSearch = (debouncedSearch ?? "").trim()
  const isEnabled = open && canSearch && trimmedSearch.length >= 2
  const queryKey = transferDialogQueryKeys.equipmentSearch(trimmedSearch)

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const cachedResults = queryClient.getQueryData<ReturnType<typeof mapEquipmentSearchResults>>(queryKey)
      const cachedState = queryClient.getQueryState(queryKey)
      if (
        cachedResults &&
        cachedState?.dataUpdatedAt &&
        Date.now() - cachedState.dataUpdatedAt < 30_000
      ) {
        return cachedResults
      }

      const result = await callRpc<EquipmentListEnhancedResponse>({
        fn: "equipment_list_enhanced",
        args: {
          p_q: trimmedSearch,
          p_sort: "ten_thiet_bi.asc",
          p_page: 1,
          p_page_size: 20,
        },
        signal,
      })

      const rows = Array.isArray(result?.data) ? result.data : []
      return mapEquipmentSearchResults(rows)
    },
    enabled: isEnabled,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  React.useEffect(() => {
    if (!query.error || isAbortError(query.error)) {
      return
    }

    toast({
      variant: "destructive",
      title: "Lỗi tìm kiếm thiết bị",
      description: getTransferDialogErrorMessage(
        query.error,
        "Không thể tải danh sách thiết bị.",
      ),
    })
  }, [toast, query.error, query.errorUpdatedAt])

  return {
    equipmentResults: isEnabled ? (query.data ?? []) : [],
    isEquipmentLoading: isEnabled ? query.isFetching : false,
    trimmedSearch,
  }
}
