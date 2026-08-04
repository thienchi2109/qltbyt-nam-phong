"use client"

import * as React from "react"

/** Serializes async evaluator navigation and exposes one blocking state. */
export function useTechnicalConfigurationEvaluationTransition() {
  const [isTransitionPending, setIsTransitionPending] = React.useState(false)
  const transitionPendingRef = React.useRef(false)
  const startTransition = React.useCallback((transition: () => Promise<void>) => {
    if (transitionPendingRef.current) return Promise.resolve()

    transitionPendingRef.current = true
    setIsTransitionPending(true)
    return transition()
      .catch((error: unknown) => {
        console.error("Technical configuration evaluation transition failed.", error)
      })
      .finally(() => {
        transitionPendingRef.current = false
        setIsTransitionPending(false)
      })
  }, [])

  return { isTransitionPending, transitionPendingRef, startTransition }
}
