"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { EQUIPMENT_ATTENTION_ACTION } from "@/lib/equipment-attention-preset"
import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import type { Equipment } from "../types"

export interface UseEquipmentRouteSyncParams {
  data: Equipment[]
}

export interface RouteAction {
  type: "openAdd" | "openDetail" | "applyAttentionStatusPreset"
  equipment?: Equipment
  highlightId?: number
}

export interface UseEquipmentRouteSyncReturn {
  router: ReturnType<typeof useRouter>
  /** Pending route action to be handled by the consumer */
  pendingAction: RouteAction | null
  /** Call this after handling the action to clear it */
  clearPendingAction: () => void
  /** True while fetching equipment via RPC fallback (not in current data slice) */
  isFetchingHighlight: boolean
}

/**
 * Build a URL path that removes only transient keys (action, highlight)
 * while preserving other query parameters like filters and pagination.
 */
function buildCleanUrl(pathname: string, searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString())
  params.delete("action")
  params.delete("highlight")
  return params.size > 0 ? `${pathname}?${params.toString()}` : pathname
}

export function useEquipmentRouteSync(
  params: UseEquipmentRouteSyncParams
): UseEquipmentRouteSyncReturn {
  const { data } = params

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Track pending action for consumer to handle
  const [pendingAction, setPendingAction] = React.useState<RouteAction | null>(null)

  // Track RPC fallback loading state
  const [isFetchingHighlight, setIsFetchingHighlight] = React.useState(false)

  // Track if we've processed the current URL params to prevent re-runs
  const processedParamsRef = React.useRef<string | null>(null)

  // Track scroll timer to prevent it from being cleared on URL change
  const scrollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup scroll timer on unmount only
  React.useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
      }
    }
  }, [])

  // Handle URL parameters for dialog opening and equipment highlighting
  React.useEffect(() => {
    const actionParam = searchParams.get("action")
    const highlightParam = searchParams.get("highlight")

    // Create a key to track if we've processed these params
    const paramsKey = `${actionParam || ""}-${highlightParam || ""}`

    // Skip if we've already processed these exact params
    if (processedParamsRef.current === paramsKey) return

    // Reset ref when params are cleared so repeat navigation works
    if (!actionParam && !highlightParam) {
      processedParamsRef.current = null
      return
    }

    // Handle "add" action
    if (actionParam === "add") {
      processedParamsRef.current = paramsKey
      setPendingAction({ type: "openAdd" })
      router.replace(buildCleanUrl(pathname, searchParams), { scroll: false })
      return
    }

    // Handle status preset action from dashboard attention redirect
    if (actionParam === EQUIPMENT_ATTENTION_ACTION) {
      processedParamsRef.current = paramsKey
      setPendingAction({ type: "applyAttentionStatusPreset" })
      router.replace(buildCleanUrl(pathname, searchParams), { scroll: false })
      return
    }

    // Handle "highlight" action - wait for data to be loaded
    if (highlightParam && data.length > 0) {
      const highlightId = Number(highlightParam)
      const equipmentToHighlight = data.find((eq) => eq.id === highlightId)

      if (equipmentToHighlight) {
        processedParamsRef.current = paramsKey
        setPendingAction({
          type: "openDetail",
          equipment: equipmentToHighlight,
          highlightId,
        })

        // Clear any previous scroll timer before scheduling new one
        if (scrollTimerRef.current) {
          clearTimeout(scrollTimerRef.current)
        }

        // Schedule scroll before URL replace to prevent timer being cleared
        scrollTimerRef.current = setTimeout(() => {
          const selector = `[data-equipment-id="${CSS.escape(highlightParam)}"]`
          const element = document.querySelector(selector)
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          scrollTimerRef.current = null
        }, 300)

        router.replace(buildCleanUrl(pathname, searchParams), { scroll: false })
      } else {
        // Issue #209: Equipment not in current paginated slice — fetch via RPC
        processedParamsRef.current = paramsKey
        const abortKey = paramsKey
        setIsFetchingHighlight(true)

        callRpc<Equipment | null>({
          fn: "equipment_get",
          args: { p_id: highlightId },
        })
          .then((fetched) => {
            // Abort guard: skip if params changed while we were fetching
            if (processedParamsRef.current !== abortKey) return

            if (fetched) {
              setPendingAction({
                type: "openDetail",
                equipment: fetched,
                highlightId,
              })
            } else {
              toast({
                variant: "destructive",
                title: "Không tìm thấy thiết bị",
                description: `Thiết bị với ID ${highlightId} không tồn tại hoặc bạn không có quyền truy cập.`,
              })
            }
          })
          .catch(() => {
            if (processedParamsRef.current !== abortKey) return

            toast({
              variant: "destructive",
              title: "Lỗi tải thiết bị",
              description: "Không thể tải thông tin thiết bị. Vui lòng thử lại.",
            })
          })
          .finally(() => {
            if (processedParamsRef.current !== abortKey) return
            setIsFetchingHighlight(false)
          })

        router.replace(buildCleanUrl(pathname, searchParams), { scroll: false })
      }
    }
  }, [searchParams, router, pathname, data, toast])

  const clearPendingAction = React.useCallback(() => {
    setPendingAction(null)
  }, [])

  return React.useMemo(
    () => ({
      router,
      pendingAction,
      clearPendingAction,
      isFetchingHighlight,
    }),
    [router, pendingAction, clearPendingAction, isFetchingHighlight]
  )
}
