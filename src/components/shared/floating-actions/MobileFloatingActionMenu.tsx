"use client"

import * as React from "react"
import { MoreHorizontal } from "lucide-react"
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownTrigger,
} from "@heroui/react"

import {
  floatingActionButtonClassName,
  type FloatingActionButtonProps,
} from "@/components/shared/FloatingActionButton"
import { useOverlayActionTransition } from "@/components/ui/use-deferred-dropdown-action"
import type { MobileFloatingActionDescriptor } from "./MobileFloatingActionsContext"

interface MobileFloatingActionMenuProps {
  actions: readonly MobileFloatingActionDescriptor[]
  ariaLabel?: string
  triggerLabel?: string
  className?: string
}

/** Renders a HeroUI-backed mobile floating menu for one or more quick actions. */
export function MobileFloatingActionMenu({
  actions,
  ariaLabel = "Tác vụ nhanh",
  triggerLabel = "Mở tác vụ nhanh",
  className,
}: MobileFloatingActionMenuProps) {
  const runOverlayAction = useOverlayActionTransition()
  const handleAction = React.useCallback(
    (key: React.Key) => {
      const targetAction = actions.find((action) => action.id === key)

      if (!targetAction) {
        return
      }

      runOverlayAction(targetAction.onSelect)
    },
    [actions, runOverlayAction]
  )

  if (actions.length === 0) {
    return null
  }

  return (
    <Dropdown>
      <DropdownTrigger
        aria-label={triggerLabel}
        className={floatingActionButtonClassName({
          className,
          placement: "page",
          tone: "primary",
        } satisfies Pick<FloatingActionButtonProps, "className" | "placement" | "tone">)}
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownTrigger>
      <DropdownPopover className="z-[1001] min-w-56" placement="top end">
        <DropdownMenu aria-label={ariaLabel} onAction={handleAction}>
          {actions.map((action) => (
            <DropdownItem key={action.id} id={action.id} textValue={action.label}>
              <span className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center [&_svg]:size-4">
                  {action.icon}
                </span>
                <span>{action.label}</span>
              </span>
            </DropdownItem>
          ))}
        </DropdownMenu>
      </DropdownPopover>
    </Dropdown>
  )
}
