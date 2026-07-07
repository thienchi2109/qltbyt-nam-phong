/**
 * Pilot-only HeroUI import boundary for the Equipments toolbar slice.
 *
 * HeroUI must not be imported directly from feature files during the spike.
 * #684 should import only the controls it needs from this module.
 */

"use client"

import * as React from "react"
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownTrigger,
} from "@heroui/react"

import { cn } from "@/lib/utils"

export interface EquipmentHeroDropdownItem {
  id: string
  label: React.ReactNode
  textValue: string
  onAction: () => void
  isDisabled?: boolean
}

interface EquipmentHeroDropdownProps {
  ariaLabel: string
  trigger: React.ReactNode
  items: EquipmentHeroDropdownItem[]
  triggerClassName?: string
  popoverClassName?: string
  menuClassName?: string
  placement?: React.ComponentProps<typeof DropdownPopover>["placement"]
}

export { Button as EquipmentHeroButton }

/** Adapts HeroUI's React Aria dropdown API to the existing Equipments toolbar action model. */
export function EquipmentHeroDropdown({
  ariaLabel,
  trigger,
  items,
  triggerClassName,
  popoverClassName,
  menuClassName,
  placement = "bottom end",
}: EquipmentHeroDropdownProps) {
  return (
    <Dropdown>
      <DropdownTrigger
        className={cn(
          "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          triggerClassName
        )}
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
              onAction={item.onAction}
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
