"use client"

import * as React from "react"

import type {
  TechnicalConfigurationEvidenceAxis,
  TechnicalConfigurationTechnicalAxis,
} from "@/lib/technical-configuration-evaluation"

import { useTechnicalConfigurationAssessments } from "./useTechnicalConfigurationAssessments"
import type { TechnicalConfigurationAssessmentWire } from "../assessment-types"
import {
  adoptTechnicalConfigurationEvaluationSave,
  applyTechnicalConfigurationEvaluationSaveFailure,
  beginTechnicalConfigurationEvaluationSave,
  createTechnicalConfigurationEvaluationDraftState,
  toTechnicalConfigurationAssessmentUpsertInput,
  updateTechnicalConfigurationEvaluationDraft,
  type TechnicalConfigurationEvaluationDraftState,
} from "../technical-configuration-evaluation-state"

const EMPTY_ASSESSMENTS: Readonly<Record<string, TechnicalConfigurationAssessmentWire>> = {}

type UseTechnicalConfigurationEvaluationDraftInput = {
  optionId: string
  baselineVersionId: string | null
  criterionId: string | null
  expectedDossierRevision: number
  onDossierRevisionChange?: (revision: number) => void
}

type TechnicalConfigurationEvaluationDraftEntry = {
  contextKey: string
  draft: TechnicalConfigurationEvaluationDraftState
}

function reconcileTechnicalConfigurationEvaluationDraft({
  draft,
  criterionId,
  comparisonSetId,
  assessment,
  expectedDossierRevision,
}: {
  draft: TechnicalConfigurationEvaluationDraftState | null
  criterionId: string
  comparisonSetId: string | null
  assessment: TechnicalConfigurationAssessmentWire | null
  expectedDossierRevision: number
}): TechnicalConfigurationEvaluationDraftState {
  if (!draft) {
    return createTechnicalConfigurationEvaluationDraftState({
      criterionId,
      comparisonSetId,
      assessment,
      expectedDossierRevision,
    })
  }

  if (
    !draft.isDirty &&
    draft.saveStatus !== "saving" &&
    (assessment?.revision ?? 0) > draft.expectedAssessmentRevision
  ) {
    return createTechnicalConfigurationEvaluationDraftState({
      criterionId,
      comparisonSetId,
      assessment,
      expectedDossierRevision: Math.max(draft.expectedDossierRevision, expectedDossierRevision),
    })
  }

  if (expectedDossierRevision > draft.expectedDossierRevision) {
    return {
      ...draft,
      expectedDossierRevision,
    }
  }

  return draft
}

/** Composes P11D complete reads with one criterion-local draft and save command. */
export function useTechnicalConfigurationEvaluationDraft({
  optionId,
  baselineVersionId,
  criterionId,
  expectedDossierRevision,
  onDossierRevisionChange,
}: UseTechnicalConfigurationEvaluationDraftInput) {
  const assessmentSource = useTechnicalConfigurationAssessments({
    optionId,
    baselineVersionId,
    collectionMode: "complete",
    onComparisonSetReady: (comparisonSet) => {
      onDossierRevisionChange?.(comparisonSet.revision)
    },
  })
  const assessmentsByCriterionId =
    assessmentSource.completeAssessmentsQuery.data ?? EMPTY_ASSESSMENTS
  const hasNoComparisonSet =
    assessmentSource.comparisonSetQuery.isSuccess &&
    assessmentSource.comparisonSetQuery.data === null
  const isCollectionReady =
    assessmentSource.completeAssessmentsQuery.isSuccess || hasNoComparisonSet
  const assessment = criterionId ? (assessmentsByCriterionId[criterionId] ?? null) : null
  const comparisonSetId = assessmentSource.comparisonSetQuery.data?.id ?? null
  const draftContextKey = JSON.stringify([optionId, baselineVersionId, criterionId])
  const draftContextToken = React.useMemo(() => Symbol(draftContextKey), [draftContextKey])
  const [draftEntry, setDraftEntry] =
    React.useState<TechnicalConfigurationEvaluationDraftEntry | null>(null)
  const draftEntryRef = React.useRef<TechnicalConfigurationEvaluationDraftEntry | null>(null)
  const activeDraftContextTokenRef = React.useRef(draftContextToken)
  const [isSaveInFlight, setIsSaveInFlight] = React.useState(false)
  const saveInFlightRef = React.useRef(false)
  const storedDraft = draftEntry?.contextKey === draftContextKey ? draftEntry.draft : null
  const currentDraft =
    criterionId && (isCollectionReady || storedDraft)
      ? reconcileTechnicalConfigurationEvaluationDraft({
          draft: storedDraft,
          criterionId,
          comparisonSetId,
          assessment,
          expectedDossierRevision,
        })
      : null

  React.useLayoutEffect(() => {
    activeDraftContextTokenRef.current = draftContextToken
  }, [draftContextToken])

  const replaceDraftEntry = React.useCallback(
    (entry: TechnicalConfigurationEvaluationDraftEntry) => {
      draftEntryRef.current = entry
      setDraftEntry(entry)
    },
    []
  )

  const updateDraft = React.useCallback(
    (patch: Parameters<typeof updateTechnicalConfigurationEvaluationDraft>[1]) => {
      if (activeDraftContextTokenRef.current !== draftContextToken) return

      const current = draftEntryRef.current
      const baseDraft =
        current?.contextKey === draftContextKey
          ? reconcileTechnicalConfigurationEvaluationDraft({
              draft: current.draft,
              criterionId: current.draft.criterionId,
              comparisonSetId,
              assessment,
              expectedDossierRevision,
            })
          : currentDraft
      if (!baseDraft) return

      replaceDraftEntry({
        contextKey: draftContextKey,
        draft: updateTechnicalConfigurationEvaluationDraft(baseDraft, patch),
      })
    },
    [
      assessment,
      comparisonSetId,
      currentDraft,
      draftContextKey,
      draftContextToken,
      expectedDossierRevision,
      replaceDraftEntry,
    ]
  )

  const discard = React.useCallback(() => {
    if (activeDraftContextTokenRef.current !== draftContextToken || saveInFlightRef.current) {
      return
    }
    draftEntryRef.current = null
    setDraftEntry(null)
  }, [draftContextToken])

  const save = React.useCallback(async () => {
    const current = draftEntryRef.current
    const latestDraft = current?.contextKey === draftContextKey ? current.draft : currentDraft
    if (
      activeDraftContextTokenRef.current !== draftContextToken ||
      !latestDraft ||
      latestDraft.criterionId !== criterionId ||
      saveInFlightRef.current
    ) {
      throw new Error("technical_configuration_evaluation_save_unavailable")
    }

    const draftToSave = reconcileTechnicalConfigurationEvaluationDraft({
      draft: latestDraft,
      criterionId: latestDraft.criterionId,
      comparisonSetId,
      assessment,
      expectedDossierRevision,
    })
    saveInFlightRef.current = true
    setIsSaveInFlight(true)
    const saveSnapshot = {
      contextKey: draftContextKey,
      draft: draftToSave,
    }
    replaceDraftEntry({
      contextKey: saveSnapshot.contextKey,
      draft: beginTechnicalConfigurationEvaluationSave(saveSnapshot.draft),
    })

    try {
      const result = await assessmentSource.upsertAssessment.mutateAsync(
        toTechnicalConfigurationAssessmentUpsertInput(saveSnapshot.draft)
      )
      const adoptedDraft = adoptTechnicalConfigurationEvaluationSave(saveSnapshot.draft, result)
      const latestEntry = draftEntryRef.current
      if (latestEntry?.contextKey === saveSnapshot.contextKey) {
        replaceDraftEntry({
          ...latestEntry,
          draft: adoptedDraft,
        })
      }
      return result
    } catch (error) {
      const latestEntry = draftEntryRef.current
      if (latestEntry?.contextKey === saveSnapshot.contextKey) {
        replaceDraftEntry({
          ...latestEntry,
          draft: applyTechnicalConfigurationEvaluationSaveFailure(latestEntry.draft, error),
        })
      }
      throw error
    } finally {
      saveInFlightRef.current = false
      setIsSaveInFlight(false)
    }
  }, [
    assessment,
    assessmentSource.upsertAssessment,
    comparisonSetId,
    criterionId,
    currentDraft,
    draftContextKey,
    draftContextToken,
    expectedDossierRevision,
    replaceDraftEntry,
  ])

  const setTechnicalAxis = React.useCallback(
    (technicalAxis: TechnicalConfigurationTechnicalAxis | null) => {
      updateDraft({ technicalAxis })
    },
    [updateDraft]
  )
  const setEvidenceAxis = React.useCallback(
    (evidenceAxis: TechnicalConfigurationEvidenceAxis | null) => {
      updateDraft({ evidenceAxis })
    },
    [updateDraft]
  )
  const setNotes = React.useCallback(
    (notes: string) => {
      updateDraft({ notes })
    },
    [updateDraft]
  )

  return {
    assessmentsByCriterionId,
    assessmentQuery: assessmentSource.completeAssessmentsQuery,
    comparisonSetQuery: assessmentSource.comparisonSetQuery,
    draft: currentDraft,
    isReady: currentDraft !== null,
    isSaving: isSaveInFlight,
    error: currentDraft?.error ?? null,
    setTechnicalAxis,
    setEvidenceAxis,
    setNotes,
    discard,
    save,
  }
}
