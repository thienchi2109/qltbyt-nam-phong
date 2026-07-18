"use client"

import * as React from "react"

/** Prevents accidental browser unload while a technical-configuration draft is dirty. */
export function useTechnicalConfigurationBeforeUnloadGuard(isDirty: boolean): void {
  React.useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])
}
