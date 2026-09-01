"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import type { HierarchicalEditorWorkspaceProps } from "./HierarchicalEditorTypes"

/** Provides the shared desktop workspace dimensions and inner editor scroll boundary. */
export function HierarchicalEditorWorkspace({
  ariaLabel,
  bodyAriaLabel,
  toolbar,
  sidebar,
  children,
  workspaceTestId = "hierarchical-editor-workspace",
  bodyTestId = "hierarchical-editor-body",
  bodyRef,
  bodyDataAttributes,
  bodyStyle,
  bodyClassName,
  contentClassName,
}: HierarchicalEditorWorkspaceProps): React.JSX.Element {
  return (
    <section
      aria-label={ariaLabel}
      data-testid={workspaceTestId}
      className="flex h-[70dvh] min-h-0 min-h-[28rem] max-h-[52rem] min-w-0 flex-1 flex-col"
    >
      {toolbar}
      <div
        ref={bodyRef}
        data-testid={bodyTestId}
        {...bodyDataAttributes}
        className={cn("relative grid min-h-0 flex-1 overflow-hidden", bodyClassName)}
        style={bodyStyle}
      >
        {sidebar ? <div className="relative z-30 min-h-0">{sidebar}</div> : null}
        <div
          role="region"
          aria-label={bodyAriaLabel}
          tabIndex={0}
          className={cn(
            "relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-background",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </section>
  )
}
