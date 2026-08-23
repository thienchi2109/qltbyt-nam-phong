"use client"

import type { TechnicalConfigurationBaselineEditorCriterionOwner } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
    <Select
      value={getTechnicalConfigurationBaselineCriterionOwnerValue(owner)}
      disabled={disabled}
      onValueChange={(value) => {
        const target = options.find((option) => option.value === value)
        if (target) onMove(target.owner)
      }}
    >
      <SelectTrigger aria-label={label} className="h-9 w-full min-w-0 px-2">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
