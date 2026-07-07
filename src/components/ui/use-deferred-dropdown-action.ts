"use client"

import * as React from "react"

/**
 * Defers opening a follow-up overlay until the source dropdown has finished
 * its close/focus lifecycle.
 */
export function useDeferredDropdownAction() {
  const timeoutIdsRef = React.useRef<number[]>([])

  React.useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      timeoutIdsRef.current = []
    }
  }, [])

  return React.useCallback((action: () => void) => {
    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timeoutId)
      action()
    }, 0)

    timeoutIdsRef.current.push(timeoutId)
  }, [])
}
