import type { TechnicalConfigurationBaselineEditorCriterionOwner } from "./technical-configuration-baseline-hierarchy-editor-state"

interface TechnicalConfigurationBaselineDndIndexedPayload {
  index: number
}

export interface TechnicalConfigurationBaselineDndGroupActive extends TechnicalConfigurationBaselineDndIndexedPayload {
  kind: "group"
  groupKey: string
}

export interface TechnicalConfigurationBaselineDndSubgroupActive extends TechnicalConfigurationBaselineDndIndexedPayload {
  kind: "subgroup"
  groupKey: string
  subgroupKey: string
}

export interface TechnicalConfigurationBaselineDndCriterionActive extends TechnicalConfigurationBaselineDndIndexedPayload {
  kind: "criterion"
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
  criterionKey: string
}

export type TechnicalConfigurationBaselineDndActive =
  | TechnicalConfigurationBaselineDndGroupActive
  | TechnicalConfigurationBaselineDndSubgroupActive
  | TechnicalConfigurationBaselineDndCriterionActive

export interface TechnicalConfigurationBaselineDndGroupTarget extends TechnicalConfigurationBaselineDndIndexedPayload {
  kind: "group"
}

export interface TechnicalConfigurationBaselineDndSubgroupTarget extends TechnicalConfigurationBaselineDndIndexedPayload {
  kind: "subgroup"
  groupKey: string
}

export interface TechnicalConfigurationBaselineDndCriterionTarget extends TechnicalConfigurationBaselineDndIndexedPayload {
  kind: "criterion"
  owner: TechnicalConfigurationBaselineEditorCriterionOwner
}

export type TechnicalConfigurationBaselineDndTarget =
  | TechnicalConfigurationBaselineDndGroupTarget
  | TechnicalConfigurationBaselineDndSubgroupTarget
  | TechnicalConfigurationBaselineDndCriterionTarget

export type TechnicalConfigurationBaselineDndCommand =
  | { type: "move-group"; groupKey: string; targetIndex: number }
  | {
      type: "move-subgroup"
      groupKey: string
      subgroupKey: string
      targetIndex: number
    }
  | {
      type: "move-criterion"
      sourceOwner: TechnicalConfigurationBaselineEditorCriterionOwner
      criterionKey: string
      targetOwner: TechnicalConfigurationBaselineEditorCriterionOwner
      targetIndex: number
    }

export type TechnicalConfigurationBaselineDndSourceData = Readonly<{
  active: TechnicalConfigurationBaselineDndActive
  label: string
}>

export type TechnicalConfigurationBaselineDndTargetData = Readonly<{
  target: TechnicalConfigurationBaselineDndTarget
  targetMode: "owner" | "sortable"
}>

export type TechnicalConfigurationBaselineDndDragEndProjection = Readonly<{
  canceled: boolean
  projectedIndex?: number
  sourceData: unknown
  targetData: unknown
}>

/** Validates a DnD source and target and returns the normalized hierarchy authoring command. */
export function projectTechnicalConfigurationBaselineDndCommand(
  active: TechnicalConfigurationBaselineDndActive,
  target: TechnicalConfigurationBaselineDndTarget | null
): TechnicalConfigurationBaselineDndCommand | null {
  if (!target) return null
  if (!isValidIndex(active.index) || !isValidIndex(target.index)) return null

  const targetIndex = projectSameListTargetIndex(active.index, target.index)

  switch (active.kind) {
    case "group":
      if (target.kind !== "group") return null
      if (!isStableKey(active.groupKey) || targetIndex === active.index) return null
      return {
        type: "move-group",
        groupKey: active.groupKey,
        targetIndex,
      }
    case "subgroup":
      if (target.kind !== "subgroup") return null
      if (
        !isStableKey(active.groupKey) ||
        !isStableKey(active.subgroupKey) ||
        !isStableKey(target.groupKey) ||
        active.groupKey !== target.groupKey ||
        targetIndex === active.index
      ) {
        return null
      }
      return {
        type: "move-subgroup",
        groupKey: active.groupKey,
        subgroupKey: active.subgroupKey,
        targetIndex,
      }
    case "criterion": {
      if (target.kind !== "criterion") return null
      if (
        !isStableKey(active.criterionKey) ||
        !isValidOwner(active.owner) ||
        !isValidOwner(target.owner)
      ) {
        return null
      }

      const sameList = sameOwner(active.owner, target.owner)
      const criterionTargetIndex = sameList ? targetIndex : target.index
      if (sameList && criterionTargetIndex === active.index) return null

      return {
        type: "move-criterion",
        sourceOwner: active.owner,
        criterionKey: active.criterionKey,
        targetOwner: target.owner,
        targetIndex: criterionTargetIndex,
      }
    }
  }
}

/** Converts one runtime drag-end payload into the canonical hierarchy command. */
export function projectTechnicalConfigurationBaselineDndDragEndCommand({
  canceled,
  projectedIndex,
  sourceData,
  targetData,
}: TechnicalConfigurationBaselineDndDragEndProjection): TechnicalConfigurationBaselineDndCommand | null {
  if (canceled) return null

  const active = readActiveData(sourceData)
  const targetEnvelope = readTargetData(targetData)
  if (!active || !targetEnvelope) return null

  const command = projectTechnicalConfigurationBaselineDndCommand(active, targetEnvelope.target)
  if (!command || targetEnvelope.targetMode !== "sortable") return command
  if (!isValidIndexValue(projectedIndex)) return command
  if (sameList(active, targetEnvelope.target) && projectedIndex === active.index) return null

  return { ...command, targetIndex: projectedIndex }
}

function projectSameListTargetIndex(sourceIndex: number, targetIndex: number): number {
  return sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
}

function isValidIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0
}

function isStableKey(key: string): boolean {
  return key.length > 0
}

function isValidOwner(owner: TechnicalConfigurationBaselineEditorCriterionOwner): boolean {
  return (
    isStableKey(owner.groupKey) && (owner.subgroupKey === null || isStableKey(owner.subgroupKey))
  )
}

function sameOwner(
  left: TechnicalConfigurationBaselineEditorCriterionOwner,
  right: TechnicalConfigurationBaselineEditorCriterionOwner
): boolean {
  return left.groupKey === right.groupKey && left.subgroupKey === right.subgroupKey
}

function sameList(
  active: TechnicalConfigurationBaselineDndActive,
  target: TechnicalConfigurationBaselineDndTarget
): boolean {
  if (active.kind !== target.kind) return false
  if (active.kind === "group") return true
  if (active.kind === "subgroup" && target.kind === "subgroup") {
    return active.groupKey === target.groupKey
  }
  return (
    active.kind === "criterion" &&
    target.kind === "criterion" &&
    sameOwner(active.owner, target.owner)
  )
}

function readActiveData(value: unknown): TechnicalConfigurationBaselineDndActive | null {
  if (!isRecord(value)) return null
  const active = value.active
  if (!isRecord(active) || !isValidIndexValue(active.index)) return null

  if (active.kind === "group" && isStableKeyValue(active.groupKey)) {
    return { kind: "group", groupKey: active.groupKey, index: active.index }
  }
  if (
    active.kind === "subgroup" &&
    isStableKeyValue(active.groupKey) &&
    isStableKeyValue(active.subgroupKey)
  ) {
    return {
      kind: "subgroup",
      groupKey: active.groupKey,
      subgroupKey: active.subgroupKey,
      index: active.index,
    }
  }
  if (
    active.kind === "criterion" &&
    isStableKeyValue(active.criterionKey) &&
    isValidOwnerRecord(active.owner)
  ) {
    return {
      kind: "criterion",
      owner: active.owner,
      criterionKey: active.criterionKey,
      index: active.index,
    }
  }
  return null
}

function readTargetData(value: unknown): TechnicalConfigurationBaselineDndTargetData | null {
  if (!isRecord(value)) return null
  if (value.targetMode !== "owner" && value.targetMode !== "sortable") return null

  const target = value.target
  if (!isRecord(target) || !isValidIndexValue(target.index)) return null

  if (target.kind === "group") {
    return { target: { kind: "group", index: target.index }, targetMode: value.targetMode }
  }
  if (target.kind === "subgroup" && isStableKeyValue(target.groupKey)) {
    return {
      target: { kind: "subgroup", groupKey: target.groupKey, index: target.index },
      targetMode: value.targetMode,
    }
  }
  if (target.kind === "criterion" && isValidOwnerRecord(target.owner)) {
    return {
      target: { kind: "criterion", owner: target.owner, index: target.index },
      targetMode: value.targetMode,
    }
  }
  return null
}

function isValidOwnerRecord(
  value: unknown
): value is TechnicalConfigurationBaselineEditorCriterionOwner {
  return (
    isRecord(value) &&
    isStableKeyValue(value.groupKey) &&
    (value.subgroupKey === null || isStableKeyValue(value.subgroupKey))
  )
}

function isValidIndexValue(value: unknown): value is number {
  return typeof value === "number" && isValidIndex(value)
}

function isStableKeyValue(value: unknown): value is string {
  return typeof value === "string" && isStableKey(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
