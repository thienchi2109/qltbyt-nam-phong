"use client"

import * as React from "react"
import type { EquipmentSelectItem } from "../types"
import type { RepairRequestDraftPayload } from "@/lib/ai/draft/repair-request-draft-schema"
import type { UiFilters } from "@/lib/rr-prefs"
import {
  fetchRepairRequestEquipmentById,
  fetchRepairRequestEquipmentList,
} from "../repair-requests-equipment-rpc"

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
  applyAssistantDraft: (draft: RepairRequestDraftPayload) => void
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
    setUiFilters,
    openCreateSheet,
    applyAssistantDraft,
    queryClient,
  } = opts

  const [allEquipment, setAllEquipment] = React.useState<EquipmentSelectItem[]>([])
  const [hasLoadedEquipment, setHasLoadedEquipment] = React.useState(false)
  const [isEquipmentFetchPending, setIsEquipmentFetchPending] = React.useState(false)
  // Track the last processed status value to prevent render loops while still
  // allowing future deep-link navigations after the URL has been cleaned.
  const lastAppliedStatusRef = React.useRef<string | null>(null)
  // Track the last fetched equipmentId to prevent duplicate equipment_get calls
  // when router.replace() from status cleanup triggers a searchParams change.
  const lastFetchedEquipmentIdRef = React.useRef<number | null>(null)

  // Initial load: fetch a small equipment list via RPC
  React.useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const eq = await fetchRepairRequestEquipmentList(null, 50)
        setAllEquipment(eq || [])
      } catch (error: unknown) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể tải danh sách thiết bị. ' + (error instanceof Error ? error.message : ''),
        })
      } finally {
        setHasLoadedEquipment(true)
      }
    }
    fetchInitialData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  // Handle ?status=X deep-link — separate effect to avoid competing with
  // equipmentId fetch or action=create URL cleanup.
  React.useEffect(() => {
    const statusParam = searchParams.get('status')
    if (!statusParam) {
      lastAppliedStatusRef.current = null
      return
    }
    if (lastAppliedStatusRef.current === statusParam) return

    lastAppliedStatusRef.current = statusParam
    const updated = { ...uiFilters, status: [statusParam] }
    setUiFiltersState(updated)
    setUiFilters(updated)
    // Clean status param from URL to prevent re-processing
    const params = new URLSearchParams(searchParams.toString())
    params.delete('status')
    const nextPath = params.size ? `${pathname}?${params.toString()}` : pathname
    router.replace(nextPath, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Support preselect by equipmentId query param using equipment_get RPC.
  // Guarded by lastFetchedEquipmentIdRef to prevent duplicate fetches when
  // other effects trigger router.replace() (which changes searchParams).
  React.useEffect(() => {
    const equipmentId = searchParams.get('equipmentId')
    if (!equipmentId) return
    const idNum = Number(equipmentId)

    // Skip only when a fetch for this same ID is already in flight;
    // do NOT skip if the item was evicted from allEquipment by the
    // initial equipment_list overwrite (which replaces the array).
    if (isEquipmentFetchPending && lastFetchedEquipmentIdRef.current === idNum) return
    const existing = allEquipment.find(eq => eq.id === idNum)
    if (existing) return

    lastFetchedEquipmentIdRef.current = idNum
    const run = async () => {
      setIsEquipmentFetchPending(true)
      try {
        const row = await fetchRepairRequestEquipmentById(idNum)
        if (row) {
          setAllEquipment(prev => [row, ...prev.filter(x => x.id !== row.id)])
        }
      } catch {
        // ignore; toast not necessary for deep link preselect
      } finally {
        setIsEquipmentFetchPending(false)
      }
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allEquipment])

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
      applyAssistantDraft(cachedAssistantDraft as RepairRequestDraftPayload)
      openCreateSheet()
      queryClient.removeQueries({ queryKey: ["assistant-draft"] })

      const params = new URLSearchParams(searchParams.toString())
      params.delete('action')
      params.delete('equipmentId')
      params.delete('status')
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
    params.delete('status')
    const nextPath = params.size ? `${pathname}?${params.toString()}` : pathname
    router.replace(nextPath, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, pathname, openCreateSheet, allEquipment, hasLoadedEquipment, isEquipmentFetchPending, queryClient, applyAssistantDraft])

  return { allEquipment, hasLoadedEquipment, isEquipmentFetchPending }
}
