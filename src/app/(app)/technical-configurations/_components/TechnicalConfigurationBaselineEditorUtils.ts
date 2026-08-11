import type {
  TechnicalConfigurationBaselineEditorGroup,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

export type TechnicalConfigurationFocusTarget =
  | { kind: "criterion"; key: string; token: number }
  | { kind: "group-name"; key: string; token: number }
  | { kind: "group-disclosure"; key: string; token: number }
  | { kind: "group-mode-action"; key: string; token: number }
  | { kind: "bulk-input"; token: number }
  | { kind: "add-group"; token: number }
  | { kind: "add-criterion"; key: string; token: number }
  | { kind: "subgroup-name"; key: string; token: number }
  | { kind: "subgroup-disclosure"; key: string; token: number }
  | { kind: "subgroup-mode-action"; key: string; token: number }
  | { kind: "subgroup-bulk-input"; key: string; token: number }
  | { kind: "add-subgroup"; key: string; token: number }
  | { kind: "add-subgroup-criterion"; key: string; token: number }
  | null

function groupContainsCriterion(
  group: TechnicalConfigurationBaselineEditorGroup,
  criterionKey: string
): boolean {
  if (group.criteria.some((criterion) => criterion.key === criterionKey)) return true

  return (group.subgroups ?? []).some((subgroup) =>
    subgroup.criteria.some((criterion) => criterion.key === criterionKey)
  )
}

function isSubgroupFocusTarget(
  focusTarget: Exclude<TechnicalConfigurationFocusTarget, null>
): boolean {
  return (
    focusTarget.kind === "subgroup-name" ||
    focusTarget.kind === "subgroup-disclosure" ||
    focusTarget.kind === "subgroup-mode-action" ||
    focusTarget.kind === "subgroup-bulk-input" ||
    focusTarget.kind === "add-subgroup-criterion"
  )
}

/** Resolves the owning group key for a pending baseline-editor focus target. */
export function getTechnicalConfigurationFocusTargetGroupKey(
  focusTarget: Exclude<TechnicalConfigurationFocusTarget, null>,
  groups: readonly TechnicalConfigurationBaselineEditorGroup[],
  activeValue: string
): string | null {
  if (focusTarget.kind === "add-group") return null
  if (focusTarget.kind === "criterion") {
    return groups.find((group) => groupContainsCriterion(group, focusTarget.key))?.key ?? null
  }
  if (focusTarget.kind === "bulk-input") return activeValue
  if (isSubgroupFocusTarget(focusTarget)) {
    return (
      groups.find((group) =>
        (group.subgroups ?? []).some((subgroup) => subgroup.key === focusTarget.key)
      )?.key ?? null
    )
  }
  return focusTarget.key
}

/** Counts group, subgroup, and criterion validation errors owned by one group. */
export function countTechnicalConfigurationGroupValidationErrors(
  group: TechnicalConfigurationBaselineEditorGroup,
  validation: TechnicalConfigurationBaselineEditorValidation
): number {
  let count = validation.groupErrors[group.key] ? 1 : 0

  for (const criterion of group.criteria) {
    if (validation.criterionErrors[criterion.key]) count += 1
  }

  for (const subgroup of group.subgroups ?? []) {
    if (validation.subgroupErrors?.[subgroup.key]) count += 1
    for (const criterion of subgroup.criteria) {
      if (validation.criterionErrors[criterion.key]) count += 1
    }
  }

  return count
}

/** Returns the focus target when it belongs to the supplied editor group. */
export function getTechnicalConfigurationFocusTargetForGroup(
  focusTarget: TechnicalConfigurationFocusTarget,
  group: TechnicalConfigurationBaselineEditorGroup,
  activeValue: string
): TechnicalConfigurationFocusTarget | null {
  if (!focusTarget || focusTarget.kind === "add-group") return null
  if (focusTarget.kind === "criterion") {
    return groupContainsCriterion(group, focusTarget.key) ? focusTarget : null
  }
  if (focusTarget.kind === "bulk-input") {
    return activeValue === group.key ? focusTarget : null
  }
  if (isSubgroupFocusTarget(focusTarget)) {
    return (group.subgroups ?? []).some((subgroup) => subgroup.key === focusTarget.key)
      ? focusTarget
      : null
  }
  return focusTarget.key === group.key ? focusTarget : null
}
