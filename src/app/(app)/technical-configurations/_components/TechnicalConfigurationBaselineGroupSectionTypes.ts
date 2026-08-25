import type {
  TechnicalConfigurationEntryMode,
  TechnicalConfigurationFocusTarget,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBulkEntrySession } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import type { TechnicalConfigurationBaselineEditorGroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

import type {
  TechnicalConfigurationBaselineCriterionOwnerOption,
  TechnicalConfigurationBaselineHierarchyAuthoring,
} from "./TechnicalConfigurationBaselineHierarchyAuthoring"

type CriterionTextField = "title" | "requirementText"

export type TechnicalConfigurationBaselineGroupSectionProps = Readonly<{
  group: TechnicalConfigurationBaselineEditorGroup
  groupIndex: number
  groupCount: number
  expanded: boolean
  mode: TechnicalConfigurationEntryMode
  bulkSession: TechnicalConfigurationBulkEntrySession
  groupError?: string
  subgroupErrors: Record<string, string>
  criterionErrors: Record<string, string>
  summaryErrorCount: number
  pendingInputDescriptionId?: string
  disabled: boolean
  interactionDisabled?: boolean
  focusTarget: TechnicalConfigurationFocusTarget
  recentlyAcceptedCriterionKeys: ReadonlySet<string>
  ownerOptions: readonly TechnicalConfigurationBaselineCriterionOwnerOption[]
  hierarchyAuthoring?: TechnicalConfigurationBaselineHierarchyAuthoring
  onExpandedChange: (expanded: boolean) => void
  onModeChange: (groupKey: string, mode: TechnicalConfigurationEntryMode) => void
  onGroupNameChange: (groupKey: string, name: string) => void
  onMoveGroup: (groupIndex: number, offset: -1 | 1) => void
  onDeleteGroup: (groupKey: string) => void
  onCriterionTextChange: (
    groupKey: string,
    criterionKey: string,
    field: CriterionTextField,
    value: string
  ) => void
  onMoveCriterion: (groupKey: string, criterionIndex: number, offset: -1 | 1) => void
  onDeleteCriterion: (groupKey: string, criterionKey: string) => void
  onAddCriterion: (groupKey: string) => void
  onBulkInputChange: (input: string) => void
  onBulkPreview: () => void
  onBulkCancel: () => void
  onBulkAccept: () => void
}>
