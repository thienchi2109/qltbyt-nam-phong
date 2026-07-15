import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

export interface UseTechnicalConfigurationBaselineEditorResult {
  versions: TechnicalConfigurationBaselineDraftWire[]
  selectedVersion: TechnicalConfigurationBaselineDraftWire | null
  baseDraft: TechnicalConfigurationBaselineDraftWire | null
  editorDraft: TechnicalConfigurationBaselineEditorDraft | null
  validation: TechnicalConfigurationBaselineEditorValidation
  isDirty: boolean
  isConflict: boolean
  saveStatus: "idle" | "saved"
  saveError: string | null
  lifecycleError: string | null
  isSaving: boolean
  isReloading: boolean
  isCreating: boolean
  isLocking: boolean
  isCopying: boolean
  isLoadingMoreVersions: boolean
  hasLoadMoreError: boolean
  isLifecycleBusy: boolean
  createError: string | null
  queryError: string | null
  isLoading: boolean
  isMissing: boolean
  hasDraft: boolean
  hasMoreVersions: boolean
  onEditorChange: (draft: TechnicalConfigurationBaselineEditorDraft) => void
  onSave: () => void
  onCreate: () => void
  onLock: () => Promise<void>
  onCopy: () => Promise<void>
  onSelectVersion: (versionId: string, options?: { force?: boolean }) => void
  onLoadMoreVersions: () => Promise<void>
  onRetryQuery: () => Promise<void>
  onRefreshVersions: () => Promise<void>
  onReloadFromServer: () => Promise<TechnicalConfigurationBaselineEditorDraft | null>
  onAdoptImportSnapshot: (version: TechnicalConfigurationBaselineDraftWire) => Promise<void>
  onRefreshImportConflict: (versionId: string) => Promise<void>
}
