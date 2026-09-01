"use client"

import * as React from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { HierarchicalEditorStructureSidebarProps } from "./HierarchicalEditorTypes"

/** Presents an ordered, optionally collapsible outline for a hierarchical editor. */
export function HierarchicalEditorStructureSidebar({
  sections,
  activeKey = null,
  expanded = true,
  overlay = false,
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
      className={cn(
        "z-30 h-full min-h-0 overflow-y-auto border-r bg-background",
        overlay && "absolute inset-y-0 left-0 w-[220px] shadow-lg"
      )}
    >
      {onToggle ? (
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
      ) : null}

      {sections.length === 0 ? (
        <p
          className={cn(
            "py-6 text-sm text-muted-foreground",
            expanded ? "px-4" : "px-1 text-center"
          )}
        >
          {expanded ? "Chưa có cấu trúc." : "—"}
        </p>
      ) : (
        <ol aria-label="Editor structure" className={cn("space-y-1 py-2", expanded && "px-2")}>
          {sections.map((section) => (
            <li
              key={section.key}
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
                  activeKey === section.key && "bg-accent font-medium"
                )}
                aria-label={section.label}
                aria-current={activeKey === section.key ? "true" : undefined}
                onClick={() => {
                  onSectionSelect?.(section.key)
                  section.targetRef?.current?.scrollIntoView?.({ block: "nearest" })
                }}
              >
                <span className="font-semibold text-foreground">
                  {section.ordinal ?? section.key}
                </span>
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
          ))}
        </ol>
      )}
    </aside>
  )
}
