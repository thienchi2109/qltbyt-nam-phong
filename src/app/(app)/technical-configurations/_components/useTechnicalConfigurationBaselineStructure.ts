"use client"

import * as React from "react"

const STRUCTURE_PANEL_BREAKPOINT = 1200
const STRUCTURE_PREFERENCE_KEY = "technical-configuration-baseline-structure"

type StructurePreference = "auto" | "collapsed" | "expanded"
export type TechnicalConfigurationBaselineStructureLayout = "rail" | "panel" | "overlay"

function readStructurePreference(): StructurePreference {
  if (typeof window === "undefined") return "auto"

  try {
    const value = window.sessionStorage.getItem(STRUCTURE_PREFERENCE_KEY)
    return value === "collapsed" || value === "expanded" ? value : "auto"
  } catch {
    return "auto"
  }
}

function storeStructurePreference(preference: Exclude<StructurePreference, "auto">): void {
  try {
    window.sessionStorage.setItem(STRUCTURE_PREFERENCE_KEY, preference)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

/** Resolves the responsive Structure rail while preserving a manual session preference. */
export function useTechnicalConfigurationBaselineStructure(
  containerRef: React.RefObject<HTMLDivElement | null>
): Readonly<{
  expanded: boolean
  layout: TechnicalConfigurationBaselineStructureLayout
  toggle: () => void
}> {
  const [preference, setPreference] = React.useState<StructurePreference>("auto")
  const [isWide, setIsWide] = React.useState(false)

  React.useEffect(() => {
    setPreference(readStructurePreference())
  }, [])

  React.useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateWidth = (width?: number) => {
      const measuredWidth = width || container.getBoundingClientRect().width || window.innerWidth
      setIsWide(measuredWidth >= STRUCTURE_PANEL_BREAKPOINT)
    }

    updateWidth()

    if (typeof ResizeObserver === "undefined") {
      const handleWindowResize = () => updateWidth()
      window.addEventListener("resize", handleWindowResize)
      return () => window.removeEventListener("resize", handleWindowResize)
    }

    const observer = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef])

  const expanded = preference === "expanded" || (preference === "auto" && isWide)
  const layout: TechnicalConfigurationBaselineStructureLayout = expanded
    ? isWide
      ? "panel"
      : "overlay"
    : "rail"

  const toggle = React.useCallback(() => {
    setPreference((current) => {
      const currentExpanded = current === "expanded" || (current === "auto" && isWide)
      const next = currentExpanded ? "collapsed" : "expanded"
      storeStructurePreference(next)
      return next
    })
  }, [isWide])

  return { expanded, layout, toggle }
}
