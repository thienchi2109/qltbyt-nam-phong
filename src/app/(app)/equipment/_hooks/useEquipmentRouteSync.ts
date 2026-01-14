"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { Equipment } from "../types"

export interface UseEquipmentRouteSyncParams {
  data: Equipment[]
}

export interface RouteAction {
  type: "openAdd" | "openDetail"
  equipment?: Equipment
  highlightId?: number
}

export interface UseEquipmentRouteSyncReturn {
  router: ReturnType<typeof useRouter>
  /** Pending route action to be handled by the consumer */
  pendingAction: RouteAction | null
  /** Call this after handling the action to clear it */
  clearPendingAction: () => void
}

export function useEquipmentRouteSync(
  params: UseEquipmentRouteSyncParams
): UseEquipmentRouteSyncReturn {
  const { data } = params

  const router = useRouter()
  const searchParams = useSearchParams()

  // Track pending action for consumer to handle
  const [pendingAction, setPendingAction] = React.useState<RouteAction | null>(null)

  // Track if we've processed the current URL params to prevent re-runs
  const processedParamsRef = React.useRef<string | null>(null)

  // Handle URL parameters for dialog opening and equipment highlighting
  React.useEffect(() => {
    const actionParam = searchParams.get("action")
    const highlightParam = searchParams.get("highlight")

    // Create a key to track if we've processed these params
    const paramsKey = `${actionParam || ""}-${highlightParam || ""}`

    // Skip if we've already processed these exact params
    if (processedParamsRef.current === paramsKey) return
    if (!actionParam && !highlightParam) return

    // Handle "add" action
    if (actionParam === "add") {
      processedParamsRef.current = paramsKey
      setPendingAction({ type: "openAdd" })
      router.replace("/equipment", { scroll: false })
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
        router.replace("/equipment", { scroll: false })

        // Scroll to element with cleanup
        const timer = setTimeout(() => {
          const element = document.querySelector(
            `[data-equipment-id="${highlightParam}"]`
          )
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        }, 300)

        return () => clearTimeout(timer)
      }
    }
  }, [searchParams, router, data])

  const clearPendingAction = React.useCallback(() => {
    setPendingAction(null)
  }, [])

  return React.useMemo(
    () => ({
      router,
      pendingAction,
      clearPendingAction,
    }),
    [router, pendingAction, clearPendingAction]
  )
}
