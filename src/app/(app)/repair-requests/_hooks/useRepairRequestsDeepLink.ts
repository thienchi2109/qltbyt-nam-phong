"use client"

import * as React from "react"
import type { EquipmentSelectItem } from "../types"
import type { RepairRequestDraftPayload } from "@/lib/ai/draft/repair-request-draft-schema"
import type { UiFilters } from "@/lib/rr-prefs"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { REPAIR_REQUEST_CREATE_ACTION } from "@/lib/repair-request-create-intent"
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

function parseEquipmentIdParam(value: string | null) {
  if (!value) return null

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

// ── Requested equipment resolution state ─────────────────────────

type RequestedEquipmentPhase = 'idle' | 'pending' | 'resolved' | 'missing'

interface RequestedEquipmentResolution {
  equipmentId: number | null
  phase: RequestedEquipmentPhase
  equipment: EquipmentSelectItem | null
  failureMessage: string | null
}

const IDLE_RESOLUTION: RequestedEquipmentResolution = {
  equipmentId: null,
  phase: 'idle',
  equipment: null,
  failureMessage: null,
}

const CREATE_INTENT_FAILURE_DESCRIPTION =
  'Không thể mở phiếu sửa chữa cho thiết bị này.'

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
  const [resolution, setResolution] = React.useState<RequestedEquipmentResolution>(IDLE_RESOLUTION)
  // Track the last processed status value to prevent render loops while still
  // allowing future deep-link navigations after the URL has been cleaned.
  const lastAppliedStatusRef = React.useRef<string | null>(null)
  // Track the last fetched equipmentId to prevent duplicate equipment_get calls
  // when router.replace() from status cleanup triggers a searchParams change.
  const lastFetchedEquipmentIdRef = React.useRef<number | null>(null)
  // Track the currently authoritative create-intent equipmentId so stale async
  // completions cannot consume a superseded deep link.
  const activeCreateEquipmentIdRef = React.useRef<number | null>(null)
  const inFlightEquipmentFetchCountRef = React.useRef(0)

  const incrementEquipmentFetchPending = () => {
    inFlightEquipmentFetchCountRef.current += 1
    setIsEquipmentFetchPending(true)
  }

  const decrementEquipmentFetchPending = () => {
    inFlightEquipmentFetchCountRef.current = Math.max(
      0,
      inFlightEquipmentFetchCountRef.current - 1
    )
    setIsEquipmentFetchPending(inFlightEquipmentFetchCountRef.current > 0)
  }

  // Initial load: fetch a small equipment list via RPC
  React.useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const eq = await fetchRepairRequestEquipmentList(null, 50)
        setAllEquipment(eq || [])
      } catch (error: unknown) {
        const errorMessage = getUnknownErrorMessage(error)
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: errorMessage
            ? `Không thể tải danh sách thiết bị. ${errorMessage}`
            : 'Không thể tải danh sách thiết bị.',
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
  // When action=create is also present, drives the resolution state machine.
  React.useEffect(() => {
    const idNum = parseEquipmentIdParam(searchParams.get('equipmentId'))
    if (idNum === null) return

    const hasCreateAction = searchParams.get('action') === REPAIR_REQUEST_CREATE_ACTION

    // Skip when fetch is in flight OR when resolution is already progressing
    // (setResolution triggers re-render before async run() sets isEquipmentFetchPending)
    if (isEquipmentFetchPending && lastFetchedEquipmentIdRef.current === idNum) return
    if (
      hasCreateAction &&
      resolution.equipmentId === idNum &&
      (resolution.phase === 'pending' ||
        resolution.phase === 'resolved' ||
        resolution.phase === 'missing')
    ) return
    if (hasCreateAction) {
      activeCreateEquipmentIdRef.current = idNum
    }
    const existing = allEquipment.find(eq => eq.id === idNum)
    if (existing) {
      // Equipment already in list — mark as resolved for create-intent gating
      if (hasCreateAction) {
        setResolution({
          equipmentId: idNum,
          phase: 'resolved',
          equipment: existing,
          failureMessage: null,
        })
      }
      return
    }

    lastFetchedEquipmentIdRef.current = idNum

    // Set resolution to pending before fetch when create-intent is active
    if (
      hasCreateAction &&
      (resolution.equipmentId !== idNum || resolution.phase === 'missing')
    ) {
      setResolution({
        equipmentId: idNum,
        phase: 'pending',
        equipment: null,
        failureMessage: null,
      })
    }

    const run = async () => {
      incrementEquipmentFetchPending()
      try {
        const row = await fetchRepairRequestEquipmentById(idNum)
        if (row) {
          setAllEquipment(prev => [row, ...prev.filter(x => x.id !== row.id)])
          if (hasCreateAction) {
            if (activeCreateEquipmentIdRef.current !== idNum) return
            setResolution({
              equipmentId: idNum,
              phase: 'resolved',
              equipment: row,
              failureMessage: null,
            })
          }
        } else if (hasCreateAction) {
          if (activeCreateEquipmentIdRef.current !== idNum) return
          setResolution({
            equipmentId: idNum,
            phase: 'missing',
            equipment: null,
            failureMessage: null,
          })
        }
      } catch (error: unknown) {
        if (hasCreateAction) {
          if (activeCreateEquipmentIdRef.current !== idNum) return
          setResolution({
            equipmentId: idNum,
            phase: 'missing',
            equipment: null,
            failureMessage: getUnknownErrorMessage(error),
          })
        }
      } finally {
        decrementEquipmentFetchPending()
      }
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allEquipment])

  // Handle action=create param with equipment pre-selection.
  // For action=create&equipmentId, gates on terminal resolution state
  // instead of coarse hasLoadedEquipment + isEquipmentFetchPending.
  React.useEffect(() => {
    if (searchParams.get('action') !== REPAIR_REQUEST_CREATE_ACTION) {
      if (resolution.phase === 'missing') {
        setResolution(IDLE_RESOLUTION)
      }
      return
    }

    const cleanCreateIntentUrl = () => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('action')
      params.delete('equipmentId')
      params.delete('status')
      const nextPath = params.size ? `${pathname}?${params.toString()}` : pathname
      router.replace(nextPath, { scroll: false })
    }

    const denyCreateIntent = (message: string | null) => {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: message
          ? `${CREATE_INTENT_FAILURE_DESCRIPTION} ${message}`
          : CREATE_INTENT_FAILURE_DESCRIPTION,
      })
      cleanCreateIntentUrl()
      activeCreateEquipmentIdRef.current = null
    }

    const equipmentIdParam = searchParams.get('equipmentId')
    const hasEquipmentIdParam = equipmentIdParam !== null
    const equipmentId = parseEquipmentIdParam(equipmentIdParam)

    if (hasEquipmentIdParam && equipmentId === null) {
      denyCreateIntent(null)
      return
    }

    // Assistant-draft fast path — takes precedence over equipment resolution
    const cachedAssistantDraft = queryClient.getQueryData(["assistant-draft"])
    if (
      !hasEquipmentIdParam &&
      cachedAssistantDraft &&
      typeof cachedAssistantDraft === "object" &&
      "equipment" in cachedAssistantDraft &&
      "formData" in cachedAssistantDraft
    ) {
      applyAssistantDraft(cachedAssistantDraft as RepairRequestDraftPayload)
      openCreateSheet()
      queryClient.removeQueries({ queryKey: ["assistant-draft"] })

      cleanCreateIntentUrl()
      return
    }

    if (equipmentId) {
      // Ignore stale resolutions from superseded equipmentId requests.
      if (resolution.equipmentId !== equipmentId) return

      // Gate on terminal resolution state for the current equipmentId only.
      if (resolution.phase === 'idle' || resolution.phase === 'pending') return

      if (
        resolution.phase === 'resolved' &&
        resolution.equipment &&
        resolution.equipmentId === equipmentId
      ) {
        openCreateSheet(resolution.equipment)
      } else {
        denyCreateIntent(resolution.failureMessage)
        return
      }
    } else {
      // No equipmentId — open immediately
      openCreateSheet()
    }

    cleanCreateIntentUrl()
    activeCreateEquipmentIdRef.current = null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, pathname, openCreateSheet, resolution, queryClient, applyAssistantDraft, toast])

  return { allEquipment, hasLoadedEquipment, isEquipmentFetchPending }
}
