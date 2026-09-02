import type * as React from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { HierarchicalEditorStructureSidebarProps } from "./HierarchicalEditorTypes"
import { HierarchicalEditorStructureSidebarSection } from "./HierarchicalEditorStructureSidebarSection"

type HierarchicalEditorStructureSidebarHeaderProps = Readonly<{
  ariaLabel: string
  expanded: boolean
  onToggle?: () => void
}>

/** Renders the optional structure label and panel toggle without changing navigation state. */
export function HierarchicalEditorStructureSidebarHeader({
  ariaLabel,
  expanded,
  onToggle,
}: HierarchicalEditorStructureSidebarHeaderProps): React.JSX.Element | null {
  if (!onToggle) return null

  return (
    <div
      className={cn(
        "flex h-12 items-center border-b",
        expanded ? "justify-between gap-2 px-2" : "justify-center"
      )}
    >
      {expanded ? (
        <h3 className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
          {ariaLabel}
        </h3>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label={expanded ? "Đóng bảng cấu trúc" : "Mở bảng cấu trúc"}
        title={expanded ? "Đóng bảng cấu trúc" : "Mở bảng cấu trúc"}
        onClick={onToggle}
      >
        {expanded ? (
          <PanelLeftClose className="size-4" aria-hidden="true" />
        ) : (
          <PanelLeftOpen className="size-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  )
}

type HierarchicalEditorStructureSidebarContentProps = Pick<
  HierarchicalEditorStructureSidebarProps,
  "sections" | "onSectionSelect"
> &
  Readonly<{
    activeKey: string | null
    expanded: boolean
  }>

/** Renders either the empty structure state or the ordered section navigation. */
export function HierarchicalEditorStructureSidebarContent({
  sections,
  activeKey,
  expanded,
  onSectionSelect,
}: HierarchicalEditorStructureSidebarContentProps): React.JSX.Element {
  if (sections.length === 0) {
    return (
      <p
        className={cn("py-6 text-sm text-muted-foreground", expanded ? "px-4" : "px-1 text-center")}
      >
        {expanded ? "Chưa có cấu trúc." : "—"}
      </p>
    )
  }

  return (
    <ol aria-label="Editor structure" className={cn("space-y-1 py-2", expanded && "px-2")}>
      {sections.map((section) => (
        <HierarchicalEditorStructureSidebarSection
          key={section.key}
          section={section}
          active={activeKey === section.key}
          expanded={expanded}
          onSectionSelect={onSectionSelect}
        />
      ))}
    </ol>
  )
}
