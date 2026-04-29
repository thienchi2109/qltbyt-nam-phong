"use client"

import * as React from "react"
import type { RepairRequestWithEquipment } from "../types"
import { callRpc } from "@/lib/rpc-client"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { REPAIR_REQUEST_VIEW_ACTION } from "@/lib/repair-request-deep-link"
import { useRepairRequestsContext } from "./useRepairRequestsContext"

type RepairRequestRecord = Omit<RepairRequestWithEquipment, "thiet_bi"> & {
  thiet_bi?: unknown
}

type EquipmentDetailRecord = {
  id: number
  ma_thiet_bi: string | null
  ten_thiet_bi: string | null
  model?: string | null
  serial?: string | null
  khoa_phong_quan_ly?: string | null
  don_vi?: number | null
}

function toPositiveInt(value: string | null) {
  if (!value) return null

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function toNullableString(value: unknown) {
  return typeof value === "string" ? value : null
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function parseRepairRequestIdParam(value: string | null) {
  return toPositiveInt(value)
}

export function buildRepairRequestViewCleanupPath(
  pathname: string,
  searchParams: URLSearchParams,
) {
  const params = new URLSearchParams(searchParams.toString())
  params.delete("action")
  params.delete("requestId")

  return params.size ? `${pathname}?${params.toString()}` : pathname
}

export async function resolveRepairRequestView(
  requestId: number,
): Promise<RepairRequestWithEquipment | null> {
  const request = await callRpc<RepairRequestRecord | null>({
    fn: "repair_request_get",
    args: { p_id: requestId },
  })

  if (!request) return null

  const equipment = await callRpc<EquipmentDetailRecord | null>({
    fn: "equipment_get",
    args: { p_id: request.thiet_bi_id },
  })

  if (!equipment) return null

  return {
    ...request,
    thiet_bi: {
      ten_thiet_bi: equipment.ten_thiet_bi ?? "",
      ma_thiet_bi: equipment.ma_thiet_bi ?? "",
      model: toNullableString(equipment.model),
      serial: toNullableString(equipment.serial),
      khoa_phong_quan_ly: toNullableString(equipment.khoa_phong_quan_ly),
      facility_name: null,
      facility_id: toNullableNumber(equipment.don_vi),
    },
  }
}

const VIEW_INTENT_FAILURE_DESCRIPTION =
  "Không thể mở chi tiết yêu cầu sửa chữa."

interface UseRepairRequestViewDeepLinkOptions {
  searchParams: URLSearchParams
  pathname: string
  router: { replace: (path: string, opts?: { scroll?: boolean }) => void }
  toast: (opts: { variant?: "default" | "destructive" | null; title: string; description: string }) => void
}

export function useRepairRequestViewDeepLink({
  searchParams,
  pathname,
  router,
  toast,
}: UseRepairRequestViewDeepLinkOptions) {
  const { dialogState, openViewDialog } = useRepairRequestsContext()
  const lastHandledViewRequestIdRef = React.useRef<number | null>(null)
  const lastUrlDrivenViewRequestIdRef = React.useRef<number | null>(null)
  const hasObservedOpenUrlDrivenViewRef = React.useRef(false)

  React.useEffect(() => {
    if (searchParams.get("action") !== REPAIR_REQUEST_VIEW_ACTION) {
      lastHandledViewRequestIdRef.current = null
      lastUrlDrivenViewRequestIdRef.current = null
      hasObservedOpenUrlDrivenViewRef.current = false
      return
    }

    const requestId = parseRepairRequestIdParam(searchParams.get("requestId"))
    const cleanViewIntentUrl = () => {
      router.replace(
        buildRepairRequestViewCleanupPath(pathname, searchParams),
        { scroll: false },
      )
    }
    const denyViewIntent = (message: string | null) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: message
          ? `${VIEW_INTENT_FAILURE_DESCRIPTION} ${message}`
          : VIEW_INTENT_FAILURE_DESCRIPTION,
      })
      cleanViewIntentUrl()
    }

    if (requestId === null) {
      denyViewIntent(null)
      return
    }

    if (lastHandledViewRequestIdRef.current === requestId) return
    lastHandledViewRequestIdRef.current = requestId

    let isCancelled = false

    const run = async () => {
      try {
        const request = await resolveRepairRequestView(requestId)
        if (isCancelled) return

        if (!request) {
          denyViewIntent(null)
          return
        }

        lastUrlDrivenViewRequestIdRef.current = requestId
        openViewDialog(request)
      } catch (error: unknown) {
        if (isCancelled) return
        denyViewIntent(getUnknownErrorMessage(error))
      }
    }

    run()

    return () => {
      isCancelled = true
    }
  }, [openViewDialog, pathname, router, searchParams, toast])

  React.useEffect(() => {
    if (searchParams.get("action") !== REPAIR_REQUEST_VIEW_ACTION) return

    const requestId = parseRepairRequestIdParam(searchParams.get("requestId"))
    if (
      requestId === null ||
      lastUrlDrivenViewRequestIdRef.current !== requestId ||
      !hasObservedOpenUrlDrivenViewRef.current
    ) {
      if (dialogState.requestToView?.id === requestId) {
        hasObservedOpenUrlDrivenViewRef.current = true
      }
      return
    }

    if (dialogState.requestToView?.id === requestId) {
      hasObservedOpenUrlDrivenViewRef.current = true
      return
    }

    router.replace(
      buildRepairRequestViewCleanupPath(pathname, searchParams),
      { scroll: false },
    )
    lastHandledViewRequestIdRef.current = null
    lastUrlDrivenViewRequestIdRef.current = null
    hasObservedOpenUrlDrivenViewRef.current = false
  }, [dialogState.requestToView, pathname, router, searchParams])
}
