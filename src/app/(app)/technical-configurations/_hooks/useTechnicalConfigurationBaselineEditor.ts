import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import {
  BaselineEditorSaveFailure,
  BaselineEditorValidationFailure,
  isTechnicalConfigurationBaselineEditorDirty,
  saveTechnicalConfigurationBaselineEditorDraft,
  toTechnicalConfigurationBaselineEditorDraft,
  validateTechnicalConfigurationBaselineEditorDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { useTechnicalConfigurationBaseline } from "./useTechnicalConfigurationBaseline"

const EMPTY_VALIDATION: TechnicalConfigurationBaselineEditorValidation = {
  groupErrors: {},
  criterionErrors: {},
}

export interface UseTechnicalConfigurationBaselineEditorResult {
  baseDraft: TechnicalConfigurationBaselineDraftWire | null
  editorDraft: TechnicalConfigurationBaselineEditorDraft | null
  validation: TechnicalConfigurationBaselineEditorValidation
  isDirty: boolean
  isConflict: boolean
  saveStatus: "idle" | "saved"
  saveError: string | null
  isSaving: boolean
  isReloading: boolean
  isCreating: boolean
  createError: string | null
  queryError: string | null
  isLoading: boolean
  isMissing: boolean
  onEditorChange: (draft: TechnicalConfigurationBaselineEditorDraft) => void
  onSave: () => void
  onCreate: () => void
  onRetryQuery: () => Promise<void>
  onReloadFromServer: () => void
}

function baselineQueryKey(dossierId: string) {
  return ["technical-configurations", "baseline-draft", dossierId] as const
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof TechnicalConfigurationRpcError &&
    error.status === 404 &&
    error.message === "not_found"
  )
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Owns P3B baseline query, explicit-save, dirty, and conflict state. */
export function useTechnicalConfigurationBaselineEditor({
  dossier,
  isExternalDraftReplacementBlocked = false,
}: {
  dossier: TechnicalConfigurationDossierWire
  isExternalDraftReplacementBlocked?: boolean
}): UseTechnicalConfigurationBaselineEditorResult {
  const queryClient = useQueryClient()
  const rpc = useTechnicalConfigurationBaseline()
  const queryKey = baselineQueryKey(dossier.id)
  const [baseDraft, setBaseDraft] = React.useState<TechnicalConfigurationBaselineDraftWire | null>(
    null
  )
  const [editorDraft, setEditorDraft] =
    React.useState<TechnicalConfigurationBaselineEditorDraft | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [isConflict, setIsConflict] = React.useState(false)
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saved">("idle")

  const draftQuery = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await rpc.getDraft({ p_dossier_id: dossier.id })
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const isDirty = React.useMemo(
    () => isTechnicalConfigurationBaselineEditorDirty(baseDraft, editorDraft),
    [baseDraft, editorDraft]
  )
  const validation = React.useMemo(
    () =>
      editorDraft
        ? validateTechnicalConfigurationBaselineEditorDraft(editorDraft)
        : EMPTY_VALIDATION,
    [editorDraft]
  )

  React.useEffect(() => {
    if (!draftQuery.data?.data || isDirty || isExternalDraftReplacementBlocked) return
    setBaseDraft(draftQuery.data.data)
    setEditorDraft(toTechnicalConfigurationBaselineEditorDraft(draftQuery.data.data))
  }, [draftQuery.data, isDirty, isExternalDraftReplacementBlocked])

  const createDraftMutation = useMutation({
    mutationFn: () =>
      rpc.createDraft({
        p_dossier_id: dossier.id,
        p_expected_revision: dossier.revision,
      }),
    onSuccess: (response) => {
      const draft = response.data
      setBaseDraft(draft)
      setEditorDraft(toTechnicalConfigurationBaselineEditorDraft(draft))
      queryClient.setQueryData(queryKey, { data: draft })
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
      setSaveError(null)
      setIsConflict(false)
      setSaveStatus("saved")
      queryClient.setQueryData(queryKey, { data: progress.baseDraft })
    },
    onError: (error) => {
      setSaveStatus("idle")
      if (error instanceof BaselineEditorValidationFailure) {
        setSaveError(null)
        return
      }
      if (error instanceof BaselineEditorSaveFailure) {
        setBaseDraft(error.progress.baseDraft)
        setEditorDraft(error.progress.editorDraft)
        setIsConflict(error.isConflict)
        setSaveError(error.isConflict ? null : "Không thể lưu cấu hình cơ sở.")
        queryClient.setQueryData(queryKey, { data: error.progress.baseDraft })
        return
      }
      setSaveError("Không thể lưu cấu hình cơ sở.")
    },
  })

  const reloadMutation = useMutation({
    mutationFn: () => rpc.getDraft({ p_dossier_id: dossier.id }),
    onMutate: () => {
      setSaveError(null)
      setSaveStatus("idle")
    },
    onSuccess: (response) => {
      setBaseDraft(response.data)
      setEditorDraft(toTechnicalConfigurationBaselineEditorDraft(response.data))
      setSaveError(null)
      setIsConflict(false)
      setSaveStatus("idle")
      queryClient.setQueryData(queryKey, response)
    },
    onError: () => {
      setSaveError("Không thể tải lại cấu hình cơ sở.")
    },
  })

  const handleEditorChange = React.useCallback(
    (draft: TechnicalConfigurationBaselineEditorDraft) => {
      setEditorDraft(draft)
      setSaveError(null)
      setSaveStatus("idle")
    },
    []
  )

  const retryQuery = React.useCallback(async (): Promise<void> => {
    await draftQuery.refetch()
  }, [draftQuery])

  return {
    baseDraft,
    editorDraft,
    validation,
    isDirty,
    isConflict,
    saveStatus,
    saveError,
    isSaving: saveMutation.isPending,
    isReloading: reloadMutation.isPending,
    isCreating: createDraftMutation.isPending,
    createError: createDraftMutation.isError
      ? getErrorMessage(createDraftMutation.error, "Không thể khởi tạo bản nháp.")
      : null,
    queryError: draftQuery.isError
      ? getErrorMessage(draftQuery.error, "Không thể tải cấu hình cơ sở.")
      : null,
    isLoading: draftQuery.isLoading,
    isMissing: draftQuery.data === null,
    onEditorChange: handleEditorChange,
    onSave: () => saveMutation.mutate(),
    onCreate: () => createDraftMutation.mutate(),
    onRetryQuery: retryQuery,
    onReloadFromServer: () => reloadMutation.mutate(),
  }
}
