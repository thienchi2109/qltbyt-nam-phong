"use client"

import * as React from "react"

/**
 * Defers a follow-up overlay action until the source menu/dropdown has
 * finished its close/focus lifecycle.
 */
export function useOverlayActionTransition() {
  const timeoutIdsRef = React.useRef<ReturnType<typeof setTimeout>[]>([])

  React.useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => clearTimeout(timeoutId))
      timeoutIdsRef.current = []
    }
  }, [])

  return React.useCallback((action: () => void) => {
    const timeoutId = setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timeoutId)
      action()
    }, 0)

    timeoutIdsRef.current.push(timeoutId)
  }, [])
}

/**
 * Compatibility export for dropdown callers that still use the original name.
 */
export const useDeferredDropdownAction = useOverlayActionTransition
