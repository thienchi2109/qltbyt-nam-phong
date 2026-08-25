"use client"

import type * as React from "react"

import { Input } from "@/components/ui/input"

type TechnicalConfigurationBaselineHierarchyNameFieldProps = Readonly<{
  level: "group" | "subgroup"
  inputRef: React.Ref<HTMLInputElement>
  id: string
  ariaLabel: string
  value: string
  displayValue: string
  locked: boolean
  disabled: boolean
  invalid: boolean
  describedBy?: string
  onChange: (value: string) => void
}>

const EDITABLE_NAME_CLASS =
  "border-transparent bg-transparent shadow-none hover:border-input hover:bg-muted/20 focus-visible:border-ring focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0"

/** Preserves heading semantics when locked and inline editing semantics when editable. */
export function TechnicalConfigurationBaselineHierarchyNameField({
  level,
  inputRef,
  id,
  ariaLabel,
  value,
  displayValue,
  locked,
  disabled,
  invalid,
  describedBy,
  onChange,
}: TechnicalConfigurationBaselineHierarchyNameFieldProps): React.JSX.Element {
  if (locked) {
    const className = "min-h-10 break-words px-2 py-2 text-sm font-semibold"

    return level === "group" ? (
      <h2
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={className}
      >
        {displayValue}
      </h2>
    ) : (
      <h3
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={className}
      >
        {displayValue}
      </h3>
    )
  }

  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {ariaLabel}
      </label>
      <Input
        ref={inputRef}
        id={id}
        aria-label={ariaLabel}
        value={value}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        disabled={disabled}
        className={EDITABLE_NAME_CLASS}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
  )
}
