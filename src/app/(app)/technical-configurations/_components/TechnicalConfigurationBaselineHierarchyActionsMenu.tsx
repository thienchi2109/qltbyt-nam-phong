"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, MoreHorizontal, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type AdditionalAction = Readonly<{
  label: string
  onSelect: () => void
  itemRef?: React.Ref<HTMLDivElement>
}>

type TechnicalConfigurationBaselineHierarchyActionsMenuProps = Readonly<{
  triggerLabel: string
  disabled: boolean
  moveUpDisabled: boolean
  moveDownDisabled: boolean
  deleteLabel: string
  deleteBlocked?: boolean
  deleteDescribedBy?: string
  additionalAction?: AdditionalAction
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onMove: (offset: -1 | 1) => void
  onDelete: () => void
}>

/** Keeps low-frequency hierarchy actions in one compact, keyboard-accessible menu. */
export function TechnicalConfigurationBaselineHierarchyActionsMenu({
  triggerLabel,
  disabled,
  moveUpDisabled,
  moveDownDisabled,
  deleteLabel,
  deleteBlocked = false,
  deleteDescribedBy,
  additionalAction,
  open,
  onOpenChange,
  onMove,
  onDelete,
}: TechnicalConfigurationBaselineHierarchyActionsMenuProps): React.JSX.Element {
  const additionalActionSelectedRef = React.useRef(false)

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          disabled={disabled}
          aria-label={triggerLabel}
          title="Thao tác khác"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (!additionalActionSelectedRef.current) return
          additionalActionSelectedRef.current = false
          event.preventDefault()
        }}
      >
        {additionalAction ? (
          <>
            <DropdownMenuItem
              ref={additionalAction.itemRef}
              onSelect={() => {
                additionalActionSelectedRef.current = true
                additionalAction.onSelect()
              }}
            >
              {additionalAction.label}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem disabled={moveUpDisabled} onSelect={() => onMove(-1)}>
          <ArrowUp className="size-4" aria-hidden="true" />
          Di chuyển lên
        </DropdownMenuItem>
        <DropdownMenuItem disabled={moveDownDisabled} onSelect={() => onMove(1)}>
          <ArrowDown className="size-4" aria-hidden="true" />
          Di chuyển xuống
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          aria-disabled={deleteBlocked || undefined}
          aria-describedby={deleteBlocked ? deleteDescribedBy : undefined}
          onSelect={(event) => {
            if (deleteBlocked) {
              event.preventDefault()
              return
            }
            onDelete()
          }}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
