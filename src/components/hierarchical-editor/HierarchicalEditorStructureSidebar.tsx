"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  HierarchicalEditorStructureSidebarContent,
  HierarchicalEditorStructureSidebarHeader,
} from "./HierarchicalEditorStructureSidebarContent"
import type { HierarchicalEditorStructureSidebarProps } from "./HierarchicalEditorTypes"

/** Presents an ordered, optionally collapsible outline for a hierarchical editor. */
export function HierarchicalEditorStructureSidebar({
  sections,
  activeKey = null,
  expanded = true,
  overlay = false,
  expandedWidth = 220,
  onToggle,
  onSectionSelect,
  ariaLabel = "Cấu trúc",
  testId = "hierarchical-editor-structure-sidebar",
}: HierarchicalEditorStructureSidebarProps): React.JSX.Element {
  return (
    <aside
      aria-label={ariaLabel}
      data-testid={testId}
      data-expanded={expanded}
      data-overlay={overlay || undefined}
      style={expanded ? { width: expandedWidth } : undefined}
      className={cn(
        "z-30 h-full min-h-0 overflow-y-auto border-r bg-background",
        overlay && "absolute inset-y-0 left-0 shadow-lg"
      )}
    >
      <HierarchicalEditorStructureSidebarHeader
        ariaLabel={ariaLabel}
        expanded={expanded}
        onToggle={onToggle}
      />
      <HierarchicalEditorStructureSidebarContent
        sections={sections}
        activeKey={activeKey}
        expanded={expanded}
        onSectionSelect={onSectionSelect}
      />
    </aside>
  )
}
