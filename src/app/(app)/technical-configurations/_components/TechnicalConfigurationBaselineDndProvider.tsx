"use client"

import {
  DragDropProvider,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/react"
import * as React from "react"

import type { TechnicalConfigurationBaselineDndCommand } from "@/app/(app)/technical-configurations/technical-configuration-baseline-dnd"
import { projectTechnicalConfigurationBaselineDndDragEndCommand } from "@/app/(app)/technical-configurations/technical-configuration-baseline-dnd"

type TechnicalConfigurationBaselineDndProviderProps = Readonly<{
  children: React.ReactNode
  onHierarchyCommand?: (command: TechnicalConfigurationBaselineDndCommand) => void
}>

function getDndLabel(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("label" in value)) return null
  return typeof value.label === "string" && value.label.length > 0 ? value.label : null
}

function getSortableProjectedIndex(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null || !("index" in value)) return undefined
  return typeof value.index === "number" && Number.isInteger(value.index) && value.index >= 0
    ? value.index
    : undefined
}

/** Owns drag projection, overlay, and screen-reader announcements for the hierarchy editor. */
export function TechnicalConfigurationBaselineDndProvider({
  children,
  onHierarchyCommand,
}: TechnicalConfigurationBaselineDndProviderProps): React.JSX.Element {
  const [activeDragLabel, setActiveDragLabel] = React.useState<string | null>(null)
  const [announcement, setAnnouncement] = React.useState("")

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    const label = getDndLabel(event.operation.source?.data) ?? "mục cấu hình"
    setActiveDragLabel(label)
    setAnnouncement(`Đang kéo ${label}.`)
  }, [])

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const label = getDndLabel(event.operation.source?.data) ?? "mục cấu hình"
      const command = projectTechnicalConfigurationBaselineDndDragEndCommand({
        canceled: event.canceled,
        projectedIndex: getSortableProjectedIndex(event.operation.target),
        sourceData: event.operation.source?.data,
        targetData: event.operation.target?.data,
      })

      setActiveDragLabel(null)
      if (!command || !onHierarchyCommand) {
        setAnnouncement(event.canceled ? `Đã hủy kéo ${label}.` : `Không thay đổi vị trí ${label}.`)
        return
      }

      onHierarchyCommand(command)
      setAnnouncement(`Đã di chuyển ${label}.`)
    },
    [onHierarchyCommand]
  )

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {children}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {activeDragLabel ? (
        <DragOverlay className="pointer-events-none" dropAnimation={null}>
          <div className="max-w-sm border border-primary/30 bg-background px-3 py-2 text-sm font-medium shadow-lg">
            {activeDragLabel}
          </div>
        </DragOverlay>
      ) : null}
    </DragDropProvider>
  )
}
