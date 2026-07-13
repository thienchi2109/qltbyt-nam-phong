import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { TechnicalConfigurationDossierWire } from "../types"
import {
  BaselineEditorSaveFailure,
  BaselineEditorValidationFailure,
  isTechnicalConfigurationBaselineEditorDirty,
  saveTechnicalConfigurationBaselineEditorDraft,
  toTechnicalConfigurationBaselineEditorDraft,
} from "../technical-configuration-baseline-editor"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "../technical-configuration-baseline-editor"
import { TechnicalConfigurationRpcError } from "../technical-configuration-rpc"
import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import { useTechnicalConfigurationBaseline } from "./useTechnicalConfigurationBaseline"

const EMPTY_VALIDATION: TechnicalConfigurationBaselineEditorValidation = {
  groupErrors: {},
  criterionErrors: {},
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
  onDirtyChange,
}: {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange: (dirty: boolean) => void
}) {
  const queryClient = useQueryClient()
  const rpc = useTechnicalConfigurationBaseline()
  const queryKey = baselineQueryKey(dossier.id)
  const [baseDraft, setBaseDraft] = React.useState<TechnicalConfigurationBaselineDraftWire | null>(
    null
  )
  const [editorDraft, setEditorDraft] =
    React.useState<TechnicalConfigurationBaselineEditorDraft | null>(null)
  const [validation, setValidation] =
    React.useState<TechnicalConfigurationBaselineEditorValidation>(EMPTY_VALIDATION)
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

  React.useEffect(() => {
    if (!draftQuery.data?.data || isDirty) return
    setBaseDraft(draftQuery.data.data)
    setEditorDraft(toTechnicalConfigurationBaselineEditorDraft(draftQuery.data.data))
  }, [draftQuery.data, isDirty])

  React.useEffect(() => {
    onDirtyChange(isDirty)
    return () => onDirtyChange(false)
  }, [isDirty, onDirtyChange])

  React.useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

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
      setValidation(EMPTY_VALIDATION)
      setSaveError(null)
      setIsConflict(false)
      setSaveStatus("saved")
      queryClient.setQueryData(queryKey, { data: progress.baseDraft })
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
        return
      }
      setSaveError("Không thể lưu cấu hình cơ sở.")
    },
  })

  const handleEditorChange = React.useCallback(
    (draft: TechnicalConfigurationBaselineEditorDraft) => {
      setEditorDraft(draft)
      setValidation(EMPTY_VALIDATION)
      setSaveError(null)
      setSaveStatus("idle")
    },
    []
  )

  const reloadFromServer = React.useCallback(async () => {
    const response = await rpc.getDraft({ p_dossier_id: dossier.id })
    setBaseDraft(response.data)
    setEditorDraft(toTechnicalConfigurationBaselineEditorDraft(response.data))
    setValidation(EMPTY_VALIDATION)
    setSaveError(null)
    setIsConflict(false)
    setSaveStatus("idle")
    queryClient.setQueryData(queryKey, response)
  }, [dossier.id, queryClient, queryKey, rpc])

  return {
    baseDraft,
    editorDraft,
    validation,
    isDirty,
    isConflict,
    saveStatus,
    saveError,
    isSaving: saveMutation.isPending,
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
    onRetryQuery: () => void draftQuery.refetch(),
    onReloadFromServer: reloadFromServer,
  }
}
