"use client"

import * as React from "react"
import { callRpc } from "@/lib/rpc-client"
import type { EquipmentSelectItem } from "../types"
import type { UiFilters } from "@/lib/rr-prefs"
import { setUiFilters } from "@/lib/rr-prefs"

// ── Types ────────────────────────────────────────────────────────

export interface UseRepairRequestsDeepLinkOptions {
  searchParams: URLSearchParams
  router: { replace: (path: string, opts?: { scroll?: boolean }) => void }
  pathname: string
  toast: (opts: { variant?: 'default' | 'destructive' | null; title: string; description: string }) => void
  uiFilters: UiFilters
  setUiFiltersState: (v: UiFilters) => void
  setUiFilters: (v: UiFilters) => void
  openCreateSheet: (equipment?: EquipmentSelectItem) => void
  applyAssistantDraft: (draft: any) => void
  queryClient: {
    getQueryData: (key: unknown[]) => unknown
    removeQueries: (opts: { queryKey: unknown[] }) => void
  }
}

export interface UseRepairRequestsDeepLinkReturn {
  allEquipment: EquipmentSelectItem[]
  hasLoadedEquipment: boolean
  isEquipmentFetchPending: boolean
}

// ── Hook ─────────────────────────────────────────────────────────

export function useRepairRequestsDeepLink(
  opts: UseRepairRequestsDeepLinkOptions
): UseRepairRequestsDeepLinkReturn {
  const {
    searchParams,
    router,
    pathname,
    toast,
    uiFilters,
    setUiFiltersState,
    openCreateSheet,
    applyAssistantDraft,
    queryClient,
  } = opts

  const [allEquipment, setAllEquipment] = React.useState<EquipmentSelectItem[]>([])
  const [hasLoadedEquipment, setHasLoadedEquipment] = React.useState(false)
  const [isEquipmentFetchPending, setIsEquipmentFetchPending] = React.useState(false)

  // Initial load: fetch a small equipment list via RPC
  React.useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const eq = await callRpc<any[]>({
          fn: 'equipment_list',
          args: { p_q: null, p_sort: 'ten_thiet_bi.asc', p_page: 1, p_page_size: 50 },
        })
        setAllEquipment((eq || []).map((row: any) => ({
          id: row.id,
          ma_thiet_bi: row.ma_thiet_bi,
          ten_thiet_bi: row.ten_thiet_bi,
          khoa_phong_quan_ly: row.khoa_phong_quan_ly,
        })))
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể tải danh sách thiết bị. ' + (error?.message || ''),
        })
      } finally {
        setHasLoadedEquipment(true)
      }
    }
    fetchInitialData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  // Support preselect by equipmentId query param using equipment_get RPC
  React.useEffect(() => {
    const equipmentId = searchParams.get('equipmentId')
    const statusParam = searchParams.get('status')
    if (statusParam) {
      const decoded = decodeURIComponent(statusParam)
      const updated = { ...uiFilters, status: [decoded] }
      setUiFiltersState(updated)
      setUiFilters(updated)
    }
    const run = async () => {
      if (!equipmentId) return
      const idNum = Number(equipmentId)
      const existing = allEquipment.find(eq => eq.id === idNum)
      if (existing) return

      setIsEquipmentFetchPending(true)
      try {
        const row: any = await callRpc({ fn: 'equipment_get', args: { p_id: idNum } })
        if (row) {
          const item: EquipmentSelectItem = {
            id: row.id,
            ma_thiet_bi: row.ma_thiet_bi,
            ten_thiet_bi: row.ten_thiet_bi,
            khoa_phong_quan_ly: row.khoa_phong_quan_ly,
          }
          setAllEquipment(prev => [item, ...prev.filter(x => x.id !== item.id)])
        }
      } catch {
        // ignore; toast not necessary for deep link preselect
      } finally {
        setIsEquipmentFetchPending(false)
      }
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allEquipment, uiFilters])

  // Handle action=create param with equipment pre-selection
  React.useEffect(() => {
    if (searchParams.get('action') !== 'create') return

    const cachedAssistantDraft = queryClient.getQueryData(["assistant-draft"])
    if (
      cachedAssistantDraft &&
      typeof cachedAssistantDraft === "object" &&
      "equipment" in cachedAssistantDraft &&
      "formData" in cachedAssistantDraft
    ) {
      applyAssistantDraft(cachedAssistantDraft as any)
      openCreateSheet()
      queryClient.removeQueries({ queryKey: ["assistant-draft"] })

      const params = new URLSearchParams(searchParams.toString())
      params.delete('action')
      params.delete('equipmentId')
      const nextPath = params.size ? `${pathname}?${params.toString()}` : pathname
      router.replace(nextPath, { scroll: false })
      return
    }

    const equipmentId = searchParams.get('equipmentId')

    if (equipmentId) {
      if (!hasLoadedEquipment || isEquipmentFetchPending) return
      const idNum = Number(equipmentId)
      const equipment = allEquipment.find(eq => eq.id === idNum)
      if (equipment) {
        openCreateSheet(equipment)
      } else {
        openCreateSheet()
      }
    } else {
      openCreateSheet()
    }

    const params = new URLSearchParams(searchParams.toString())
    params.delete('action')
    params.delete('equipmentId')
    const nextPath = params.size ? `${pathname}?${params.toString()}` : pathname
    router.replace(nextPath, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, pathname, openCreateSheet, allEquipment, hasLoadedEquipment, isEquipmentFetchPending, queryClient, applyAssistantDraft])

  return { allEquipment, hasLoadedEquipment, isEquipmentFetchPending }
}
