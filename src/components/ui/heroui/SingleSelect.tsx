"use client"

import { ListBox } from "@heroui/react/list-box"
import { Select } from "@heroui/react/select"

export interface SingleSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SingleSelectProps {
  value: string | null
  onValueChange: (value: string) => void
  options: readonly SingleSelectOption[]
  ariaLabel: string
  disabled?: boolean
  placeholder?: string
  className?: string
}

/** Renders a non-clearable app-level HeroUI single-select control. */
export function SingleSelect({
  value,
  onValueChange,
  options,
  ariaLabel,
  disabled = false,
  placeholder,
  className,
}: Readonly<SingleSelectProps>) {
  return (
    <Select
      aria-label={ariaLabel}
      className={className}
      fullWidth
      isDisabled={disabled}
      onSelectionChange={(selectedKey) => {
        if (selectedKey !== null) {
          onValueChange(String(selectedKey))
        }
      }}
      placeholder={placeholder}
      selectedKey={value}
    >
      <Select.Trigger className="h-10 w-full">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              id={option.value}
              isDisabled={option.disabled}
              key={option.value}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
