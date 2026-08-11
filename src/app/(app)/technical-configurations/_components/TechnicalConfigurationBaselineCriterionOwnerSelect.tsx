"use client"

import type { TechnicalConfigurationBaselineEditorCriterionOwner } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

import {
  getTechnicalConfigurationBaselineCriterionOwnerValue,
  type TechnicalConfigurationBaselineCriterionOwnerOption,
} from "./TechnicalConfigurationBaselineHierarchyAuthoring"

type TechnicalConfigurationBaselineCriterionOwnerSelectProps = Readonly<{
  label: string
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
  options: readonly TechnicalConfigurationBaselineCriterionOwnerOption[]
  disabled: boolean
  onMove: (owner: TechnicalConfigurationBaselineEditorCriterionOwner) => void
}>

/** Selects a canonical direct or subgroup owner for one criterion. */
export function TechnicalConfigurationBaselineCriterionOwnerSelect({
  label,
  owner,
  options,
  disabled,
  onMove,
}: TechnicalConfigurationBaselineCriterionOwnerSelectProps): React.JSX.Element {
  return (
    <select
      aria-label={label}
      className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
      value={getTechnicalConfigurationBaselineCriterionOwnerValue(owner)}
      disabled={disabled}
      onChange={(event) => {
        const target = options.find((option) => option.value === event.target.value)
        if (target) onMove(target.owner)
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
