import type {
  TechnicalConfigurationEntryMode,
  TechnicalConfigurationFocusTarget,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBulkEntrySessionsApi } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

export type TechnicalConfigurationHierarchyViewTransition = Readonly<{
  activeValue?: string
  entryMode?: TechnicalConfigurationEntryMode
  focusTarget?: TechnicalConfigurationFocusTarget
}>

export type UseTechnicalConfigurationHierarchyAuthoringOptions = Readonly<{
  draft: TechnicalConfigurationBaselineEditorDraft | null
  validation: TechnicalConfigurationBaselineEditorValidation
  activeValue: string
  entryMode: TechnicalConfigurationEntryMode
  bulkSessions: TechnicalConfigurationBulkEntrySessionsApi
  updateDraft: (draft: TechnicalConfigurationBaselineEditorDraft) => void
  transitionView: (transition: TechnicalConfigurationHierarchyViewTransition) => void
  nextFocusToken: () => number
}>
