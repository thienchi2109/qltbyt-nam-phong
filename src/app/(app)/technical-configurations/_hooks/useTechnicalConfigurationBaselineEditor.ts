import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import {
  BaselineEditorSaveFailure,
  BaselineEditorValidationFailure,
  EMPTY_TECHNICAL_CONFIGURATION_BASELINE_EDITOR_VALIDATION as EMPTY_VALIDATION,
  isTechnicalConfigurationBaselineEditorDirty,
  saveTechnicalConfigurationBaselineEditorDraft,
  type TechnicalConfigurationBaselineEditorDraft,
  type TechnicalConfigurationBaselineEditorValidation,
  toTechnicalConfigurationBaselineEditorDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import {
  BASELINE_VERSION_PAGE_SIZE,
  getTechnicalConfigurationBaselineCreateError,
  getTechnicalConfigurationBaselineQueryError,
  isTechnicalConfigurationBaselineConflict,
  selectTechnicalConfigurationBaselineVersion,
  splitTechnicalConfigurationBaselineCreatedVersion,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"
import { createBaselineImportBridge } from "@/app/(app)/technical-configurations/technical-configuration-baseline-import-bridge"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { useTechnicalConfigurationBaseline } from "./useTechnicalConfigurationBaseline"
import { useTechnicalConfigurationBaselineDossierRevision } from "./useTechnicalConfigurationBaselineDossierRevision"
import type { UseTechnicalConfigurationBaselineEditorResult } from "./useTechnicalConfigurationBaselineEditorTypes"
import { useTechnicalConfigurationBaselineVersions } from "./useTechnicalConfigurationBaselineVersions"
/** Owns baseline version selection, lifecycle, explicit-save, dirty, and conflict state. */
export function useTechnicalConfigurationBaselineEditor({
  dossier,
  isExternalDraftReplacementBlocked = false,
}: {
  dossier: TechnicalConfigurationDossierWire
  isExternalDraftReplacementBlocked?: boolean
}): UseTechnicalConfigurationBaselineEditorResult {
  const rpc = useTechnicalConfigurationBaseline()
  const revisionState = useTechnicalConfigurationBaselineDossierRevision({
    dossier,
    getDossier: rpc.getDossier,
  })
  const { dossierRevision, updateDossierRevision, refreshDossierRevision } = revisionState
  const versionState = useTechnicalConfigurationBaselineVersions({
    dossierId: dossier.id,
    listVersions: rpc.listVersions,
  })
  const {
    versionsQuery,
    versions,
    cacheVersion,
    replaceVersions,
    refreshVersions,
    retryVersions,
    loadMoreVersions,
    hasHistoryRecoveryError,
  } = versionState
  const [selectedVersionId, setSelectedVersionId] = React.useState<string | null>(null)
  const [baseDraft, setBaseDraft] = React.useState<TechnicalConfigurationBaselineDraftWire | null>(
    null
  )
  const [editorDraft, setEditorDraft] =
    React.useState<TechnicalConfigurationBaselineEditorDraft | null>(null)
  const [validation, setValidation] =
    React.useState<TechnicalConfigurationBaselineEditorValidation>(EMPTY_VALIDATION)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [lifecycleError, setLifecycleError] = React.useState<string | null>(null)
  const [isConflict, setIsConflict] = React.useState(false)
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saved">("idle")
  const isDirty = React.useMemo(
    () => isTechnicalConfigurationBaselineEditorDirty(baseDraft, editorDraft),
    [baseDraft, editorDraft]
  )
  const isDraftReplacementBlocked = isDirty || isExternalDraftReplacementBlocked
  const adoptVersion = React.useCallback(
    (version: TechnicalConfigurationBaselineDraftWire | null) => {
      setSelectedVersionId(version?.id ?? null)
      setBaseDraft(() => version)
      setEditorDraft(
        version?.status === "draft" ? toTechnicalConfigurationBaselineEditorDraft(version) : null
      )
      setValidation(EMPTY_VALIDATION)
      setSaveError(null)
      setLifecycleError(null)
      setIsConflict(false)
      setSaveStatus("idle")
    },
    []
  )
  const importBridge = createBaselineImportBridge(revisionState, versionState, adoptVersion)
  React.useEffect(() => {
    if (!versionsQuery.data || isDraftReplacementBlocked) return
    const nextVersion = selectTechnicalConfigurationBaselineVersion(
      versions,
      selectedVersionId,
      baseDraft,
      Boolean(versionsQuery.hasNextPage)
    )
    if (
      baseDraft?.id === nextVersion?.id &&
      baseDraft?.revision === nextVersion?.revision &&
      baseDraft?.status === nextVersion?.status
    ) {
      return
    }
    adoptVersion(nextVersion)
  }, [
    adoptVersion,
    baseDraft,
    isDraftReplacementBlocked,
    selectedVersionId,
    versions,
    versionsQuery.data,
    versionsQuery.hasNextPage,
  ])
  // react-doctor-disable-next-line react-doctor/query-mutation-missing-invalidation -- cacheVersion updates the exact history cache; conflict recovery refetches it.
  const createDraftMutation = useMutation({
    mutationFn: () =>
      rpc.createDraft({
        p_dossier_id: dossier.id,
        p_expected_revision: dossierRevision,
      }),
    onSuccess: (response) => {
      const { version, dossierRevision: nextDossierRevision } =
        splitTechnicalConfigurationBaselineCreatedVersion(response.data)
      updateDossierRevision(nextDossierRevision)
      cacheVersion(version)
      adoptVersion(version)
    },
    onMutate: () => {
      setLifecycleError(null)
      setIsConflict(false)
    },
    onError: async (error) => {
      const stale = isTechnicalConfigurationBaselineConflict(error)
      setIsConflict(stale)
      setLifecycleError(stale ? null : "Không thể khởi tạo bản nháp.")
      if (!stale) return
      try {
        await refreshDossierRevision()
        await refreshVersions()
      } catch {
        setLifecycleError("Không thể tải lại trạng thái hồ sơ.")
      }
    },
  })
  React.useEffect(() => {
    if (createDraftMutation.isError && versions.some((version) => version.status === "draft"))
      createDraftMutation.reset()
  }, [createDraftMutation, versions])
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!baseDraft || !editorDraft) {
        throw new Error("baseline_editor_not_ready")
      }
      return saveTechnicalConfigurationBaselineEditorDraft({
        baseDraft,
        editorDraft,
        rpc,
      })
    },
    onSuccess: (progress) => {
      setBaseDraft(progress.baseDraft)
      setEditorDraft(progress.editorDraft)
      setValidation(EMPTY_VALIDATION)
      setSaveError(null)
      setIsConflict(false)
      setSaveStatus("saved")
      cacheVersion(progress.baseDraft)
    },
    onError: async (error) => {
      setSaveStatus("idle")
      if (error instanceof BaselineEditorValidationFailure) {
        setValidation(error.validation)
        setSaveError(null)
        return
      }
      if (error instanceof BaselineEditorSaveFailure) {
        setBaseDraft(error.progress.baseDraft)
        setEditorDraft(error.progress.editorDraft)
        setIsConflict(error.isConflict)
        setSaveError(error.isConflict ? null : "Không thể lưu cấu hình cơ sở.")
        if (error.isConflict) {
          await refreshVersions()
        } else {
          cacheVersion(error.progress.baseDraft)
        }
        return
      }
      setSaveError("Không thể lưu cấu hình cơ sở.")
    },
  })
  const lockMutation = useMutation({
    mutationFn: (version: TechnicalConfigurationBaselineDraftWire) =>
      rpc.lockVersion({
        p_baseline_version_id: version.id,
        p_expected_revision: version.revision,
      }),
    onMutate: () => {
      setLifecycleError(null)
      setIsConflict(false)
    },
    onSuccess: (response) => {
      cacheVersion(response.data)
      adoptVersion(response.data)
    },
    onError: (error) => {
      const stale = isTechnicalConfigurationBaselineConflict(error)
      setIsConflict(stale)
      setLifecycleError(stale ? null : "Không thể khóa phiên bản cấu hình.")
    },
  })
  const copyMutation = useMutation({
    mutationFn: (version: TechnicalConfigurationBaselineDraftWire) =>
      rpc.copyVersion({
        p_source_baseline_version_id: version.id,
        p_expected_revision: version.revision,
      }),
    onMutate: () => {
      setLifecycleError(null)
      setIsConflict(false)
    },
    onSuccess: (response) => {
      const { version, dossierRevision: nextDossierRevision } =
        splitTechnicalConfigurationBaselineCreatedVersion(response.data)
      updateDossierRevision(nextDossierRevision)
      cacheVersion(version)
      adoptVersion(version)
    },
    onError: async (error) => {
      const stale = isTechnicalConfigurationBaselineConflict(error)
      setIsConflict(stale)
      setLifecycleError(stale ? null : "Không thể sao chép phiên bản cấu hình.")
      if (stale) {
        await refreshDossierRevision()
        adoptVersion(await refreshVersions())
      }
    },
  })
  const reloadMutation = useMutation({
    mutationFn: (_forceEditorReplacement: boolean) =>
      rpc.listVersions({
        p_dossier_id: dossier.id,
        p_page: 1,
        p_page_size: BASELINE_VERSION_PAGE_SIZE,
      }),
    onMutate: () => {
      setSaveError(null)
      setLifecycleError(null)
      setSaveStatus("idle")
    },
    onSuccess: (response, forceEditorReplacement) => {
      replaceVersions(response)
      if (!forceEditorReplacement && isDraftReplacementBlocked) return
      const nextVersion =
        response.data.find((version) => version.id === selectedVersionId) ??
        versions.find((version) => version.id === selectedVersionId) ??
        response.data.find((version) => version.status === "draft") ??
        response.data[0] ??
        null
      adoptVersion(nextVersion)
    },
    onError: () => {
      setSaveError("Không thể tải lại cấu hình cơ sở.")
    },
  })
  const handleEditorChange = React.useCallback(
    (draft: TechnicalConfigurationBaselineEditorDraft) => {
      setEditorDraft(draft)
      setValidation(EMPTY_VALIDATION)
      setSaveError(null)
      setLifecycleError(null)
      setSaveStatus("idle")
    },
    []
  )
  const isLifecycleBusy =
    createDraftMutation.isPending ||
    saveMutation.isPending ||
    lockMutation.isPending ||
    copyMutation.isPending ||
    reloadMutation.isPending ||
    versionsQuery.isFetching
  const createError = getTechnicalConfigurationBaselineCreateError(
    createDraftMutation.isError,
    isConflict,
    lifecycleError
  )
  return {
    versions,
    selectedVersion: baseDraft,
    baseDraft,
    editorDraft,
    validation,
    isDirty,
    isConflict,
    saveStatus,
    saveError,
    lifecycleError,
    isSaving: saveMutation.isPending,
    isReloading: reloadMutation.isPending,
    isCreating: createDraftMutation.isPending,
    isLocking: lockMutation.isPending,
    isCopying: copyMutation.isPending,
    isLoadingMoreVersions: versionsQuery.isFetchingNextPage,
    hasLoadMoreError: hasHistoryRecoveryError,
    isLifecycleBusy,
    createError,
    queryError: getTechnicalConfigurationBaselineQueryError(
      versionsQuery.isError,
      versionsQuery.error,
      versions.length > 0
    ),
    isLoading: versionsQuery.isLoading,
    isMissing: versionsQuery.isSuccess && versions.length === 0,
    hasDraft: versions.some((version) => version.status === "draft"),
    hasMoreVersions: Boolean(versionsQuery.hasNextPage),
    onEditorChange: handleEditorChange,
    onSave: () => saveMutation.mutate(),
    onCreate: () => createDraftMutation.mutate(),
    onLock: async () => {
      if (isConflict || isDraftReplacementBlocked || !baseDraft || baseDraft.status !== "draft")
        return
      await lockMutation.mutateAsync(baseDraft)
    },
    onCopy: async () => {
      if (!baseDraft || baseDraft.status !== "locked") return
      await copyMutation.mutateAsync(baseDraft)
    },
    onSelectVersion: (versionId, options) => {
      const version = versions.find((item) => item.id === versionId)
      if (version && (options?.force || !isDraftReplacementBlocked)) adoptVersion(version)
    },
    onLoadMoreVersions: loadMoreVersions,
    onRetryQuery: retryVersions,
    onRefreshVersions: async () => {
      await reloadMutation.mutateAsync(false)
    },
    onReloadFromServer: async () => {
      const response = await reloadMutation.mutateAsync(true)
      const version =
        response.data.find((item) => item.id === selectedVersionId) ??
        response.data.find((item) => item.status === "draft")
      return version?.status === "draft"
        ? toTechnicalConfigurationBaselineEditorDraft(version)
        : null
    },
    ...importBridge,
  }
}
