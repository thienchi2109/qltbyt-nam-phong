"use client"

import * as React from "react"
import { AlertCircle } from "lucide-react"

import type {
  TechnicalConfigurationBaselineEditorGroup,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

import {
  ALL_GROUPS_VALUE,
  getTechnicalConfigurationGroupTabId,
  GROUP_WORKSPACE_PANEL_ID,
} from "./TechnicalConfigurationGroupNavigation"

type TechnicalConfigurationGroupNavigatorProps = Readonly<{
  groups: TechnicalConfigurationBaselineEditorGroup[]
  activeValue: string
  validation: TechnicalConfigurationBaselineEditorValidation
  focusGroupRequest: { groupKey: string; token: number } | null
  onValueChange: (value: string) => void
}>

function getGroupErrorCount(
  group: TechnicalConfigurationBaselineEditorGroup,
  validation: TechnicalConfigurationBaselineEditorValidation
) {
  const groupErrorCount = validation.groupErrors[group.key] ? 1 : 0
  const criterionErrorCount = group.criteria.filter(
    (criterion) => validation.criterionErrors[criterion.key]
  ).length
  return groupErrorCount + criterionErrorCount
}

/** Renders accessible horizontal tabs for groups and the read-only overview. */
export function TechnicalConfigurationGroupNavigator({
  groups,
  activeValue,
  validation,
  focusGroupRequest,
  onValueChange,
}: TechnicalConfigurationGroupNavigatorProps) {
  const tabRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const focusGroupKey = focusGroupRequest?.groupKey
  const focusGroupToken = focusGroupRequest?.token
  const items = React.useMemo(
    () => [
      ...groups.map((group, groupIndex) => ({
        value: group.key,
        label: group.name.trim() || `Nhóm ${groupIndex + 1}`,
        criterionCount: group.criteria.length,
        errorCount: getGroupErrorCount(group, validation),
      })),
      {
        value: ALL_GROUPS_VALUE,
        label: "Xem tất cả nhóm",
        criterionCount: null,
        errorCount: 0,
      },
    ],
    [groups, validation]
  )

  React.useEffect(() => {
    if (!focusGroupKey) return
    tabRefs.current.get(focusGroupKey)?.focus()
  }, [focusGroupKey, focusGroupToken])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let targetIndex = index
    if (event.key === "ArrowRight") targetIndex = (index + 1) % items.length
    else if (event.key === "ArrowLeft") targetIndex = (index - 1 + items.length) % items.length
    else if (event.key === "Home") targetIndex = 0
    else if (event.key === "End") targetIndex = items.length - 1
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onValueChange(items[index].value)
      return
    } else return

    event.preventDefault()
    const target = items[targetIndex]
    tabRefs.current.get(target.value)?.focus()
    onValueChange(target.value)
  }

  return (
    <div className="overflow-x-auto border-b">
      <div
        role="tablist"
        aria-label="Nhóm cấu hình"
        className="inline-flex h-12 w-max min-w-full items-stretch justify-start"
      >
        {items.map((item, index) => (
          <button
            key={item.value}
            ref={(node) => {
              if (node) tabRefs.current.set(item.value, node)
              else tabRefs.current.delete(item.value)
            }}
            id={getTechnicalConfigurationGroupTabId(item.value)}
            type="button"
            role="tab"
            aria-selected={activeValue === item.value}
            aria-controls={GROUP_WORKSPACE_PANEL_ID}
            tabIndex={activeValue === item.value || (!activeValue && index === 0) ? 0 : -1}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-selected:border-primary aria-selected:text-foreground"
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{item.label}</span>
            {item.criterionCount !== null ? (
              <span className="text-xs font-normal text-muted-foreground">
                {item.criterionCount} tiêu chí
              </span>
            ) : null}
            {item.errorCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                <AlertCircle className="size-3.5" aria-hidden="true" />
                {item.errorCount} lỗi
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}
