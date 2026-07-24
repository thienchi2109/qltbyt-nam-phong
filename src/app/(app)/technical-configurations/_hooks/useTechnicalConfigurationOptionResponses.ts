import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useTechnicalConfigurationBeforeUnloadGuard } from "./useTechnicalConfigurationBeforeUnloadGuard"
import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import { isTechnicalConfigurationBaselineConflict } from "../technical-configuration-baseline-version-state"
import {
  fetchTechnicalConfigurationDossierRevision,
  updateTechnicalConfigurationDossierRevisionCache,
} from "../technical-configuration-dossier-revision-cache"
import {
  readTechnicalConfigurationComparisonSet,
  saveTechnicalConfigurationOptionResponse,
  TechnicalConfigurationOptionResponseSaveFailure,
} from "../technical-configuration-option-response-operations"
import {
  areTechnicalConfigurationOptionResponseDraftsEqual,
  findTechnicalConfigurationOptionResponse,
  flattenTechnicalConfigurationBaselineCriteria,
  getTechnicalConfigurationOptionResponseErrorMessage,
  getTechnicalConfigurationOptionResponseUpdatedAt,
  replaceTechnicalConfigurationOptionResponse,
  toTechnicalConfigurationOptionResponseDraft,
  validateTechnicalConfigurationOptionResponseDraft,
  type TechnicalConfigurationOptionResponseDraft,
  type TechnicalConfigurationOptionResponseDraftPatch,
} from "../technical-configuration-option-response-state"
import { technicalConfigurationOptionResponsesQueryKey } from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationComparisonSetWire,
  TechnicalConfigurationOptionWire,
} from "../supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "../types"

type UseTechnicalConfigurationOptionResponsesArgs = {
  dossier: TechnicalConfigurationDossierWire
  option: TechnicalConfigurationOptionWire
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  onRevisionChange?: (revision: number) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

/** Owns one option/exact-baseline response snapshot, local criterion draft, and explicit save. */
export function useTechnicalConfigurationOptionResponses({
  dossier,
  option,
  baselineVersion,
  onRevisionChange,
  onNavigationBlockedChange,
}: UseTechnicalConfigurationOptionResponsesArgs) {
  const queryClient = useQueryClient()
  const queryKey = React.useMemo(
    () => technicalConfigurationOptionResponsesQueryKey(option.id, baselineVersion.id),
    [baselineVersion.id, option.id]
  )
  const criteria = React.useMemo(
    () => flattenTechnicalConfigurationBaselineCriteria(baselineVersion),
    [baselineVersion]
  )
  const [selectedCriterionId, setSelectedCriterionId] = React.useState<string | null>(
    criteria[0]?.id ?? null
  )
  const [snapshot, setSnapshot] = React.useState<TechnicalConfigurationComparisonSetWire | null>(
    null
  )
  const [baseDraft, setBaseDraft] = React.useState<TechnicalConfigurationOptionResponseDraft>(() =>
    toTechnicalConfigurationOptionResponseDraft(null)
  )
  const [draft, setDraft] = React.useState<TechnicalConfigurationOptionResponseDraft>(() =>
    toTechnicalConfigurationOptionResponseDraft(null)
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [isReloading, setIsReloading] = React.useState(false)
  const [isConflict, setIsConflict] = React.useState(false)
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [operationError, setOperationError] = React.useState<string | null>(null)
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saved">("idle")
  const activeOperationRef = React.useRef<"save" | "reload" | null>(null)
  const adoptedQueryAtRef = React.useRef(0)
  const revisionRef = React.useRef(dossier.revision)
  const responseQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      readTechnicalConfigurationComparisonSet(
        {
          p_option_id: option.id,
          p_baseline_version_id: baselineVersion.id,
        },
        signal
      ),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const isReadOnly = Boolean(dossier.archived_at)
  const isDirty =
    !isReadOnly && !areTechnicalConfigurationOptionResponseDraftsEqual(baseDraft, draft)
  const visibleDraft = isReadOnly ? baseDraft : draft
  const commitRevision = React.useCallback(
    (nextRevision: number) => {
      const committedRevision = Math.max(revisionRef.current, dossier.revision, nextRevision)
      revisionRef.current = committedRevision
      onRevisionChange?.(committedRevision)
      updateTechnicalConfigurationDossierRevisionCache(queryClient, dossier, committedRevision)
    },
    [dossier, onRevisionChange, queryClient]
  )
  React.useEffect(() => {
    if (
      !responseQuery.isSuccess ||
      responseQuery.dataUpdatedAt === adoptedQueryAtRef.current ||
      isDirty ||
      isConflict ||
      activeOperationRef.current
    ) {
      return
    }
    adoptedQueryAtRef.current = responseQuery.dataUpdatedAt
    const nextSnapshot = responseQuery.data
    const nextCriterionId = criteria.some((criterion) => criterion.id === selectedCriterionId)
      ? selectedCriterionId
      : (criteria[0]?.id ?? null)
    const nextDraft = toTechnicalConfigurationOptionResponseDraft(
      findTechnicalConfigurationOptionResponse(nextSnapshot, nextCriterionId)
    )
    setSnapshot(nextSnapshot)
    setSelectedCriterionId(nextCriterionId)
    setBaseDraft(nextDraft)
    setDraft(nextDraft)
    const nextRevision = Math.max(nextSnapshot?.revision ?? 0, dossier.revision)
    if (nextRevision > dossier.revision) {
      commitRevision(nextRevision) // react-doctor-disable-line react-doctor/no-pass-data-to-parent, react-doctor/no-pass-live-state-to-parent
    } else {
      revisionRef.current = Math.max(revisionRef.current, nextRevision)
    }
    setIsConflict(false) // react-doctor-disable-line react-doctor/no-adjust-state-on-prop-change
    setOperationError(null) // react-doctor-disable-line react-doctor/no-adjust-state-on-prop-change
  }, [
    commitRevision,
    criteria,
    dossier.revision,
    isConflict,
    isDirty,
    responseQuery.data,
    responseQuery.dataUpdatedAt,
    responseQuery.isSuccess,
    selectedCriterionId,
  ])

  React.useEffect(() => {
    revisionRef.current = Math.max(revisionRef.current, dossier.revision)
  }, [dossier.revision])

  useTechnicalConfigurationBeforeUnloadGuard(isDirty)

  const updateDraft = React.useCallback(
    (patch: TechnicalConfigurationOptionResponseDraftPatch) => {
      if (isReadOnly || activeOperationRef.current) return
      setDraft((current) => ({ ...current, ...patch }))
      setValidationError(null)
      if (!isConflict) setOperationError(null)
      setSaveStatus("idle")
    },
    [isConflict, isReadOnly]
  )

  const selectCriterion = React.useCallback(
    (criterionId: string) => {
      if (
        activeOperationRef.current ||
        !criteria.some((criterion) => criterion.id === criterionId)
      ) {
        return
      }
      const nextDraft = toTechnicalConfigurationOptionResponseDraft(
        findTechnicalConfigurationOptionResponse(snapshot, criterionId)
      )
      setSelectedCriterionId(criterionId)
      setBaseDraft(nextDraft)
      setDraft(nextDraft)
      setValidationError(null)
      if (!isConflict) setOperationError(null)
      setSaveStatus("idle")
    },
    [criteria, isConflict, snapshot]
  )

  const save = React.useCallback(async () => {
    if (isReadOnly || activeOperationRef.current || isConflict) return
    const error = validateTechnicalConfigurationOptionResponseDraft(draft, selectedCriterionId)
    if (error) {
      setValidationError(error)
      return
    }
    if (!selectedCriterionId) return

    activeOperationRef.current = "save"
    setIsSaving(true)
    setValidationError(null)
    setOperationError(null)
    setSaveStatus("idle")
    onNavigationBlockedChange?.(true)

    try {
      const saved = await saveTechnicalConfigurationOptionResponse({
        optionId: option.id,
        baselineVersionId: baselineVersion.id,
        criterionId: selectedCriterionId,
        responseText: draft.responseText,
        supplementaryInformation: draft.supplementaryInformation,
        expectedRevision: revisionRef.current,
        comparisonSet: snapshot,
        onComparisonSetReady: (comparisonSet) => {
          setSnapshot(comparisonSet)
          commitRevision(comparisonSet.revision)
        },
      })
      const nextSnapshot = replaceTechnicalConfigurationOptionResponse(
        saved.comparisonSet,
        saved.response
      )
      const nextDraft = toTechnicalConfigurationOptionResponseDraft(saved.response)
      queryClient.setQueryData(queryKey, nextSnapshot)
      adoptedQueryAtRef.current = Date.now()
      setSnapshot(nextSnapshot)
      commitRevision(saved.response.revision)
      setBaseDraft(nextDraft)
      setDraft(nextDraft)
      setIsConflict(false)
      setSaveStatus("saved")
    } catch (caught) {
      const sourceError =
        caught instanceof TechnicalConfigurationOptionResponseSaveFailure
          ? caught.originalError
          : caught
      if (caught instanceof TechnicalConfigurationOptionResponseSaveFailure) {
        setSnapshot(caught.comparisonSet)
        queryClient.setQueryData(queryKey, caught.comparisonSet)
        commitRevision(caught.comparisonSet.revision)
      }
      setIsConflict(
        caught instanceof TechnicalConfigurationOptionResponseSaveFailure
          ? caught.isConflict
          : isTechnicalConfigurationBaselineConflict(caught)
      )
      setOperationError(
        getTechnicalConfigurationOptionResponseErrorMessage(
          sourceError,
          "Không thể lưu phản hồi phương án."
        )
      )
    } finally {
      activeOperationRef.current = null
      setIsSaving(false)
      onNavigationBlockedChange?.(false)
    }
  }, [
    baselineVersion.id,
    commitRevision,
    draft,
    isConflict,
    isReadOnly,
    onNavigationBlockedChange,
    option.id,
    queryClient,
    queryKey,
    selectedCriterionId,
    snapshot,
  ])

  const reload = React.useCallback(async () => {
    if (activeOperationRef.current) return
    const preserveDraft = isDirty
    activeOperationRef.current = "reload"
    setIsReloading(true)
    setOperationError(null)
    onNavigationBlockedChange?.(true)
    try {
      const refreshed = await responseQuery.refetch({ throwOnError: true })
      adoptedQueryAtRef.current = refreshed.dataUpdatedAt
      const nextSnapshot = refreshed.data ?? null
      const nextRevision =
        nextSnapshot?.revision ??
        (await fetchTechnicalConfigurationDossierRevision(queryClient, dossier.id))
      const nextBaseDraft = toTechnicalConfigurationOptionResponseDraft(
        findTechnicalConfigurationOptionResponse(nextSnapshot, selectedCriterionId)
      )
      setSnapshot(nextSnapshot)
      setBaseDraft(nextBaseDraft)
      if (!preserveDraft) setDraft(nextBaseDraft)
      commitRevision(nextRevision)
      setIsConflict(false)
      setValidationError(null)
      setSaveStatus("idle")
    } catch (caught) {
      setOperationError(
        getTechnicalConfigurationOptionResponseErrorMessage(
          caught,
          "Không thể tải lại phản hồi phương án."
        )
      )
    } finally {
      activeOperationRef.current = null
      setIsReloading(false)
      onNavigationBlockedChange?.(false)
    }
  }, [
    commitRevision,
    dossier.id,
    isDirty,
    onNavigationBlockedChange,
    queryClient,
    responseQuery,
    selectedCriterionId,
  ])

  const selectedCriterion =
    criteria.find((criterion) => criterion.id === selectedCriterionId) ?? null
  const updatedAt = getTechnicalConfigurationOptionResponseUpdatedAt(
    option,
    snapshot,
    selectedCriterionId
  )

  return {
    responseQuery,
    criteria,
    selectedCriterion,
    selectedCriterionId,
    snapshot,
    draft: visibleDraft,
    isDirty,
    isReadOnly,
    isSaving,
    isReloading,
    isPending: isSaving || isReloading,
    isConflict,
    validationError,
    operationError,
    saveStatus,
    updatedAt,
    updateDraft,
    selectCriterion,
    save,
    reload,
  }
}
