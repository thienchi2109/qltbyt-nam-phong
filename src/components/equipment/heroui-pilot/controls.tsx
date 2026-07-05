/**
 * Pilot-only HeroUI import boundary for the Equipments toolbar slice.
 *
 * HeroUI must not be imported directly from feature files during the spike.
 * #684 should import only the controls it needs from this module.
 */

"use client"

import * as React from "react"
import { X } from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownTrigger,
  Input,
} from "@heroui/react"

import { cn } from "@/lib/utils"

type EquipmentHeroSearchInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "type" | "value"
> & {
  value: string
  onValueChange: (value: string) => void
  onClear?: () => void
  showClearButton?: boolean
  endAddon?: React.ReactNode
}

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

export {
  Button as EquipmentHeroButton,
  Card as EquipmentHeroCard,
  CardContent as EquipmentHeroCardContent,
  CardDescription as EquipmentHeroCardDescription,
  CardHeader as EquipmentHeroCardHeader,
  CardTitle as EquipmentHeroCardTitle,
}

/** Renders the Equipments pilot search input with the current toolbar end-addon contract. */
export function EquipmentHeroSearchInput({
  value,
  onValueChange,
  onClear,
  showClearButton = true,
  endAddon,
  className,
  fullWidth = true,
  ...props
}: EquipmentHeroSearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const hasClearButton = showClearButton && value.length > 0
  const paddingRight =
    hasClearButton && endAddon ? "pr-20" : hasClearButton || endAddon ? "pr-9" : null

  const handleClear = React.useCallback(() => {
    onValueChange("")
    onClear?.()
    inputRef.current?.focus()
  }, [onClear, onValueChange])

  return (
    <div className="relative w-full" data-testid="equipment-heroui-search-control">
      <Input
        {...props}
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        fullWidth={fullWidth}
        className={cn("h-9 w-full pl-3", paddingRight, className)}
      />
      {hasClearButton || endAddon ? (
        <div className="absolute inset-y-0 right-1 flex items-center gap-1">
          {hasClearButton ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              isIconOnly
              onPress={handleClear}
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label="Xóa tìm kiếm"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          {endAddon}
        </div>
      ) : null}
    </div>
  )
}

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
