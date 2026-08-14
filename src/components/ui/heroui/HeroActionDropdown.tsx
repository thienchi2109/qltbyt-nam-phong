"use client"

import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownTrigger,
} from "@heroui/react"
import type * as React from "react"

import { useOverlayActionTransition } from "@/components/ui/use-deferred-dropdown-action"
import { cn } from "@/lib/utils"

export interface HeroActionDropdownItem {
  id: string
  label: React.ReactNode
  textValue: string
  onAction: () => void
  isDisabled?: boolean
}

interface HeroActionDropdownProps {
  ariaLabel: string
  trigger: React.ReactNode
  items: readonly HeroActionDropdownItem[]
  disabled?: boolean
  triggerClassName?: string
  popoverClassName?: string
  menuClassName?: string
  placement?: React.ComponentProps<typeof DropdownPopover>["placement"]
}

/** Renders a reusable accessible HeroUI action dropdown. */
export function HeroActionDropdown({
  ariaLabel,
  trigger,
  items,
  disabled = false,
  triggerClassName,
  popoverClassName,
  menuClassName,
  placement = "bottom end",
}: Readonly<HeroActionDropdownProps>): React.JSX.Element {
  const runOverlayAction = useOverlayActionTransition()

  return (
    <Dropdown>
      <DropdownTrigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          triggerClassName
        )}
        isDisabled={disabled}
      >
        {trigger}
      </DropdownTrigger>
      <DropdownPopover className={cn("min-w-56", popoverClassName)} placement={placement}>
        <DropdownMenu aria-label={ariaLabel} className={menuClassName}>
          {items.map((item) => (
            <DropdownItem
              key={item.id}
              id={item.id}
              isDisabled={item.isDisabled}
              onAction={() => runOverlayAction(item.onAction)}
              textValue={item.textValue}
            >
              {item.label}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </DropdownPopover>
    </Dropdown>
  )
}
