"use client"

import * as React from "react"

const DEFAULT_STRUCTURE_PANEL_BREAKPOINT = 1200

type HierarchicalEditorStructurePreference = "auto" | "collapsed" | "expanded"
export type HierarchicalEditorStructureLayout = "rail" | "panel" | "overlay"

type UseHierarchicalEditorStructureOptions = Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>
  preferenceKey: string
  panelBreakpoint?: number
}>

function readStructurePreference(preferenceKey: string): HierarchicalEditorStructurePreference {
  if (typeof window === "undefined") return "auto"

  try {
    const value = window.sessionStorage.getItem(preferenceKey)
    return value === "collapsed" || value === "expanded" ? value : "auto"
  } catch {
    return "auto"
  }
}

function storeStructurePreference(
  preferenceKey: string,
  preference: Exclude<HierarchicalEditorStructurePreference, "auto">
): void {
  try {
    window.sessionStorage.setItem(preferenceKey, preference)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

/** Resolves a responsive structure rail while preserving a manual session preference. */
export function useHierarchicalEditorStructure({
  containerRef,
  preferenceKey,
  panelBreakpoint = DEFAULT_STRUCTURE_PANEL_BREAKPOINT,
}: UseHierarchicalEditorStructureOptions): Readonly<{
  expanded: boolean
  layout: HierarchicalEditorStructureLayout
  toggle: () => void
}> {
  const [preference, setPreference] = React.useState<HierarchicalEditorStructurePreference>("auto")
  const [isWide, setIsWide] = React.useState(false)

  React.useEffect(() => {
    setPreference(readStructurePreference(preferenceKey))
  }, [preferenceKey])

  React.useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateWidth = (width?: number) => {
      const measuredWidth = width || container.getBoundingClientRect().width || window.innerWidth
      setIsWide(measuredWidth >= panelBreakpoint)
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
  }, [containerRef, panelBreakpoint])

  const expanded = preference === "expanded" || (preference === "auto" && isWide)
  const layout: HierarchicalEditorStructureLayout = expanded
    ? isWide
      ? "panel"
      : "overlay"
    : "rail"

  const toggle = React.useCallback(() => {
    setPreference((current) => {
      const currentExpanded = current === "expanded" || (current === "auto" && isWide)
      const next = currentExpanded ? "collapsed" : "expanded"
      storeStructurePreference(preferenceKey, next)
      return next
    })
  }, [isWide, preferenceKey])

  return { expanded, layout, toggle }
}
