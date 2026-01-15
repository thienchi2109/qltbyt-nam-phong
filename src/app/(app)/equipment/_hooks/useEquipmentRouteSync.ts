"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
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

  // Track pending action for consumer to handle
  const [pendingAction, setPendingAction] = React.useState<RouteAction | null>(null)

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
        // Use ref to store timer so it persists across effect re-runs
        scrollTimerRef.current = setTimeout(() => {
          const selector = `[data-equipment-id="${CSS.escape(highlightParam)}"]`
          const element = document.querySelector(selector)
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          scrollTimerRef.current = null
        }, 300)

        // Replace URL after setting up the scroll timer (preserves other params)
        router.replace(buildCleanUrl(pathname, searchParams), { scroll: false })
      }
    }
  }, [searchParams, router, pathname, data])

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
