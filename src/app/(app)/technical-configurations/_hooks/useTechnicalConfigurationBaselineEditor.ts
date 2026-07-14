import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import {
  BaselineEditorSaveFailure,
  BaselineEditorValidationFailure,
  isTechnicalConfigurationBaselineEditorDirty,
  saveTechnicalConfigurationBaselineEditorDraft,
  toTechnicalConfigurationBaselineEditorDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import {
  BASELINE_VERSION_PAGE_SIZE,
  getTechnicalConfigurationBaselineErrorMessage,
  isTechnicalConfigurationBaselineConflict,
  splitTechnicalConfigurationBaselineCreatedVersion,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"
import { technicalConfigurationDossierDetailQueryKey } from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierWire,
  TechnicalConfigurationDossierWireResponse,
} from "@/app/(app)/technical-configurations/types"
import { useTechnicalConfigurationBaseline } from "./useTechnicalConfigurationBaseline"
import type { UseTechnicalConfigurationBaselineEditorResult } from "./useTechnicalConfigurationBaselineEditorTypes"
import { useTechnicalConfigurationBaselineVersions } from "./useTechnicalConfigurationBaselineVersions"

const EMPTY_VALIDATION: TechnicalConfigurationBaselineEditorValidation = {
  groupErrors: {},
  criterionErrors: {},
}
/** Owns baseline version selection, lifecycle, explicit-save, dirty, and conflict state. */
export function useTechnicalConfigurationBaselineEditor({
  dossier,
  isExternalDraftReplacementBlocked = false,
}: {
  dossier: TechnicalConfigurationDossierWire
  isExternalDraftReplacementBlocked?: boolean
}): UseTechnicalConfigurationBaselineEditorResult {
  const queryClient = useQueryClient()
  const rpc = useTechnicalConfigurationBaseline()
  const { versionsQuery, versions, cacheVersion, replaceVersions, loadMoreVersions } =
    useTechnicalConfigurationBaselineVersions({
      dossierId: dossier.id,
      listVersions: rpc.listVersions,
    })
  const [dossierRevision, setDossierRevision] = React.useState(dossier.revision)
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

  React.useEffect(() => {
    if (!versionsQuery.data || isDirty || isExternalDraftReplacementBlocked) return

    const nextVersion =
      versions.find((version) => version.id === selectedVersionId) ??
      versions.find((version) => version.status === "draft") ??
      versions[0] ??
      null

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
    isDirty,
    isExternalDraftReplacementBlocked,
    selectedVersionId,
    versions,
    versionsQuery.data,
  ])

  const cacheDossierRevision = React.useCallback(
    (revision: number) => {
      queryClient.setQueryData<TechnicalConfigurationDossierWireResponse>(
        technicalConfigurationDossierDetailQueryKey(dossier.id),
        (current) =>
          current
            ? {
                data: {
                  ...current.data,
                  revision,
                },
              }
            : current
      )
    },
    [dossier.id, queryClient]
  )

  const createDraftMutation = useMutation({
    mutationFn: () =>
      rpc.createDraft({
        p_dossier_id: dossier.id,
        p_expected_revision: dossierRevision,
      }),
    onSuccess: (response) => {
      const { version, dossierRevision: nextDossierRevision } =
        splitTechnicalConfigurationBaselineCreatedVersion(response.data)
      setDossierRevision(nextDossierRevision)
      cacheDossierRevision(nextDossierRevision)
      cacheVersion(version)
      adoptVersion(version)
    },
    onMutate: () => {
      setLifecycleError(null)
      setIsConflict(false)
    },
    onError: (error) => {
      const stale = isTechnicalConfigurationBaselineConflict(error)
      setIsConflict(stale)
      setLifecycleError(stale ? null : "Không thể khởi tạo bản nháp.")
    },
  })

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
    onError: (error) => {
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
        cacheVersion(error.progress.baseDraft)
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
      setDossierRevision(nextDossierRevision)
      cacheDossierRevision(nextDossierRevision)
      cacheVersion(version)
      adoptVersion(version)
    },
    onError: (error) => {
      const stale = isTechnicalConfigurationBaselineConflict(error)
      setIsConflict(stale)
      setLifecycleError(stale ? null : "Không thể sao chép phiên bản cấu hình.")
    },
  })

  const reloadMutation = useMutation({
    mutationFn: () =>
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
    onSuccess: (response) => {
      replaceVersions(response)
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
  const retryQuery = React.useCallback(async (): Promise<void> => {
    await versionsQuery.refetch()
  }, [versionsQuery])
  const isLifecycleBusy =
    createDraftMutation.isPending ||
    saveMutation.isPending ||
    lockMutation.isPending ||
    copyMutation.isPending ||
    reloadMutation.isPending ||
    versionsQuery.isFetching
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
    isLifecycleBusy,
    createError: createDraftMutation.isError && !isConflict ? "Không thể khởi tạo bản nháp." : null,
    queryError: versionsQuery.isError
      ? getTechnicalConfigurationBaselineErrorMessage(
          versionsQuery.error,
          "Không thể tải cấu hình cơ sở."
        )
      : null,
    isLoading: versionsQuery.isLoading,
    isMissing: versionsQuery.isSuccess && versions.length === 0,
    hasDraft: versions.some((version) => version.status === "draft"),
    hasMoreVersions: Boolean(versionsQuery.hasNextPage),
    onEditorChange: handleEditorChange,
    onSave: () => saveMutation.mutate(),
    onCreate: () => createDraftMutation.mutate(),
    onLock: async () => {
      if (!baseDraft || baseDraft.status !== "draft") return
      await lockMutation.mutateAsync(baseDraft)
    },
    onCopy: async () => {
      if (!baseDraft || baseDraft.status !== "locked") return
      await copyMutation.mutateAsync(baseDraft)
    },
    onSelectVersion: (versionId) => {
      const version = versions.find((item) => item.id === versionId)
      if (version) adoptVersion(version)
    },
    onLoadMoreVersions: loadMoreVersions,
    onRetryQuery: retryQuery,
    onRefreshVersions: async () => {
      await reloadMutation.mutateAsync()
    },
    onReloadFromServer: async () => {
      const response = await reloadMutation.mutateAsync()
      const version =
        response.data.find((item) => item.id === selectedVersionId) ??
        response.data.find((item) => item.status === "draft")
      return version?.status === "draft"
        ? toTechnicalConfigurationBaselineEditorDraft(version)
        : null
    },
  }
}
