import type * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { HierarchicalEditorSectionDescriptor } from "./HierarchicalEditorTypes"

type HierarchicalEditorStructureSidebarSectionProps = Readonly<{
  section: HierarchicalEditorSectionDescriptor
  active: boolean
  expanded: boolean
  onSectionSelect?: (sectionKey: string) => void
}>

/** Renders one keyboard-operable structure destination in panel or rail form. */
export function HierarchicalEditorStructureSidebarSection({
  section,
  active,
  expanded,
  onSectionSelect,
}: HierarchicalEditorStructureSidebarSectionProps): React.JSX.Element {
  return (
    <li
      className={cn(
        "items-center border-l-2 border-transparent text-sm",
        expanded
          ? "grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-2 px-2 py-2"
          : "flex h-10 justify-center"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-auto min-w-0 justify-start p-0 text-left hover:bg-transparent",
          expanded ? "col-span-3 grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-2" : "w-full",
          active && "bg-accent font-medium"
        )}
        aria-label={section.label}
        aria-current={active ? "true" : undefined}
        onClick={() => {
          onSectionSelect?.(section.key)
          section.targetRef?.current?.scrollIntoView?.({ block: "nearest" })
        }}
      >
        <span className="font-semibold text-foreground">{section.ordinal ?? section.key}</span>
        {expanded ? (
          <>
            <span className="min-w-0 truncate text-foreground">{section.label}</span>
            {section.summary ? (
              <span className="tabular-nums text-muted-foreground">{section.summary}</span>
            ) : null}
          </>
        ) : null}
      </Button>
    </li>
  )
}
