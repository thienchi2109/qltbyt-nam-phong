"use client"

import { ArrowDown, ArrowUp, MoreHorizontal, Trash2 } from "lucide-react"
import * as React from "react"

import type { TechnicalConfigurationBaselineEditorCriterionOwner } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { TechnicalConfigurationBaselineCriterionOwnerOption } from "./TechnicalConfigurationBaselineHierarchyAuthoring"

type TechnicalConfigurationBaselineCriterionActionsProps = Readonly<{
  criterionLabel: string
  criterionIndex: number
  criterionCount: number
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
  hierarchyEnabled: boolean
  disabled: boolean
  ownerOptions?: readonly TechnicalConfigurationBaselineCriterionOwnerOption[]
  onMove?: (offset: -1 | 1) => void
  onMoveToOwner?: (owner: TechnicalConfigurationBaselineEditorCriterionOwner) => void
  onDelete?: () => void
}>

function sameOwner(
  left: TechnicalConfigurationBaselineEditorCriterionOwner,
  right: TechnicalConfigurationBaselineEditorCriterionOwner
): boolean {
  return left.groupKey === right.groupKey && left.subgroupKey === right.subgroupKey
}

/** Renders ordering, deletion, and owner-transfer actions for one editable criterion. */
export function TechnicalConfigurationBaselineCriterionActions({
  criterionLabel,
  criterionIndex,
  criterionCount,
  owner,
  hierarchyEnabled,
  disabled,
  ownerOptions,
  onMove,
  onMoveToOwner,
  onDelete,
}: TechnicalConfigurationBaselineCriterionActionsProps): React.JSX.Element {
  const destinations = ownerOptions?.filter((option) => !sameOwner(option.owner, owner)) ?? []
  const [showDestinations, setShowDestinations] = React.useState(false)

  return (
    <div className="flex items-center justify-center px-1 py-1">
      <DropdownMenu
        modal={false}
        onOpenChange={(open) => {
          if (!open) setShowDestinations(false)
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={disabled}
            aria-label={`Thao tác cho ${criterionLabel}`}
            title="Thao tác khác"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showDestinations ? (
            destinations.map((option) => (
              <DropdownMenuItem key={option.value} onSelect={() => onMoveToOwner?.(option.owner)}>
                {option.label}
              </DropdownMenuItem>
            ))
          ) : (
            <>
              <DropdownMenuItem disabled={criterionIndex === 0} onSelect={() => onMove?.(-1)}>
                <ArrowUp className="size-4" aria-hidden="true" />
                Di chuyển lên
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={criterionIndex === criterionCount - 1}
                onSelect={() => onMove?.(1)}
              >
                <ArrowDown className="size-4" aria-hidden="true" />
                Di chuyển xuống
              </DropdownMenuItem>
              {hierarchyEnabled ? (
                <DropdownMenuItem
                  disabled={destinations.length === 0}
                  onSelect={(event) => {
                    event.preventDefault()
                    setShowDestinations(true)
                  }}
                >
                  Chuyển đến...
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete?.()}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Xóa tiêu chí
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
