"use client"

import * as React from "react"
import { Loader2, Save, StepForward } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useTechnicalConfigurationComparison } from "../../_hooks/useTechnicalConfigurationComparison"
import { useTechnicalConfigurationEvaluationDraft } from "../../_hooks/useTechnicalConfigurationEvaluationDraft"
import { useTechnicalConfigurationGuardedNavigation } from "../../_hooks/useTechnicalConfigurationGuardedNavigation"
import type { TechnicalConfigurationBaselineGroupWire } from "../../baseline-types"
import { TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE } from "../../comparison-matrix-constants"
import type {
  TechnicalConfigurationComparisonCriterionRow,
  TechnicalConfigurationComparisonOption,
} from "../../comparison-types"
import type { TechnicalConfigurationOptionWire } from "../../supplier-option-types"
import { toTechnicalConfigurationComparisonOption } from "../../technical-configuration-comparison-mappers"
import type { TechnicalConfigurationDossierWire } from "../../types"
import { TechnicalConfigurationCriterionPagination } from "../comparison/TechnicalConfigurationCriterionPagination"
import { createTechnicalConfigurationOptionCriterionDetail } from "../comparison/technical-configuration-criterion-detail"
import { buildTechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"
import { TechnicalConfigurationCriterionList } from "./TechnicalConfigurationCriterionList"
import { TechnicalConfigurationEvaluationLoadError } from "./TechnicalConfigurationEvaluationLoadError"
import { TechnicalConfigurationEvaluationPanel } from "./TechnicalConfigurationEvaluationPanel"
import { TechnicalConfigurationProgressSummary } from "./TechnicalConfigurationProgressSummary"
import {
  resolveTechnicalConfigurationCriterionId,
  toTechnicalConfigurationSaveErrorMessage,
} from "./TechnicalConfigurationEvaluationWorkspaceUtils"

type TechnicalConfigurationEvaluationActiveWorkspaceProps = {
  dossier: TechnicalConfigurationDossierWire
  baselineVersionId: string
  baselineGroups: TechnicalConfigurationBaselineGroupWire[]
  options: TechnicalConfigurationOptionWire[]
  onDirtyChange: (dirty: boolean) => void
  onNavigationBlockedChange: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
}

const EMPTY_CRITERIA: TechnicalConfigurationComparisonCriterionRow[] = []

/** Owns the selected option, page, criterion and P12A1 draft for evaluation mode. */
export function TechnicalConfigurationEvaluationActiveWorkspace({
  dossier,
  baselineVersionId,
  baselineGroups,
  options,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
}: Readonly<TechnicalConfigurationEvaluationActiveWorkspaceProps>) {
  const [selectedOptionId, setSelectedOptionId] = React.useState(options[0]?.id ?? "")
  const [page, setPage] = React.useState(1)
  const [requestedCriterionId, setRequestedCriterionId] = React.useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = React.useState(false)
  const detailReturnFocusRef = React.useRef<HTMLElement | null>(null)
  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? options[0]
  const activeSelectedOptionId = selectedOption?.id ?? ""
  const comparison = useTechnicalConfigurationComparison({
    baselineVersionId,
    optionIds: activeSelectedOptionId ? [activeSelectedOptionId] : [],
    page,
    pageSize: TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE,
  })
  const result = comparison.comparisonQuery.data
  const criteria = result?.data.criteria ?? EMPTY_CRITERIA
  const criterionId = resolveTechnicalConfigurationCriterionId(criteria, requestedCriterionId)
  const currentRow = criteria.find((row) => row.criterion.id === criterionId) ?? null
  const evaluation = useTechnicalConfigurationEvaluationDraft({
    optionId: activeSelectedOptionId,
    baselineVersionId,
    criterionId,
    expectedDossierRevision: dossier.revision,
    onDossierRevisionChange: onRevisionChange,
  })
  const { assessmentQuery, comparisonSetQuery } = evaluation
  const {
    error: assessmentQueryError,
    isError: isAssessmentQueryError,
    refetch: refetchAssessments,
  } = assessmentQuery
  const {
    error: comparisonSetQueryError,
    isError: isComparisonSetQueryError,
    refetch: refetchComparisonSet,
  } = comparisonSetQuery
  const isDirty = evaluation.draft?.isDirty ?? false
  const isNavigationBlocked = evaluation.isSaving
  const currentIndex = currentRow
    ? criteria.findIndex((row) => row.criterion.id === currentRow.criterion.id)
    : -1
  const hasNextPage = result ? result.page * result.pageSize < result.total : false
  const { requestNavigation, discardConfirmationDialog } =
    useTechnicalConfigurationGuardedNavigation({
      isDirty,
      isBlocked: isNavigationBlocked,
      onDiscard: evaluation.discard,
    })
  const hasEvaluationReadError = isComparisonSetQueryError || isAssessmentQueryError
  const evaluationReadError = isComparisonSetQueryError
    ? comparisonSetQueryError
    : assessmentQueryError
  const progress = React.useMemo(
    () =>
      buildTechnicalConfigurationEvaluationProgress({
        groups: baselineGroups,
        assessments: Object.values(evaluation.assessmentsByCriterionId),
      }),
    [baselineGroups, evaluation.assessmentsByCriterionId]
  )

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- P12A2 exposes one criterion-local draft to every enclosing navigation boundary.
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])
  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- Pending assessment saves hard-block option, page, mode, tab and dossier navigation.
    onNavigationBlockedChange(isNavigationBlocked)
  }, [isNavigationBlocked, onNavigationBlockedChange])
  React.useEffect(
    () => () => {
      onDirtyChange(false)
      onNavigationBlockedChange(false)
    },
    [onDirtyChange, onNavigationBlockedChange]
  )

  const handleOptionChange = React.useCallback(
    (nextOptionId: string) => {
      if (nextOptionId === activeSelectedOptionId) return
      requestNavigation(() => {
        setSelectedOptionId(nextOptionId)
        setPage(1)
        setRequestedCriterionId(null)
        setIsPanelOpen(false)
      })
    },
    [activeSelectedOptionId, requestNavigation]
  )
  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      if (nextPage === page) return
      requestNavigation(() => {
        setPage(nextPage)
        setRequestedCriterionId(null)
      })
    },
    [page, requestNavigation]
  )
  const handleCriterionChange = React.useCallback(
    (nextCriterionId: string) => {
      const navigate = () => {
        detailReturnFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        setRequestedCriterionId(nextCriterionId)
        setIsPanelOpen(true)
      }
      if (nextCriterionId === criterionId) {
        navigate()
        return
      }
      requestNavigation(navigate)
    },
    [criterionId, requestNavigation]
  )
  const handleSave = React.useCallback(async () => {
    try {
      await evaluation.save()
    } catch {
      // The draft hook preserves input and exposes the actionable error.
    }
  }, [evaluation])
  const handleSaveAndContinue = React.useCallback(async () => {
    try {
      await evaluation.save()
      const nextCriterionId = criteria[currentIndex + 1]?.criterion.id
      if (nextCriterionId) {
        setRequestedCriterionId(nextCriterionId)
        setIsPanelOpen(true)
      } else if (hasNextPage) {
        setPage((current) => current + 1)
        setRequestedCriterionId(null)
        setIsPanelOpen(true)
      }
    } catch {
      // Failed saves intentionally remain on the current criterion.
    }
  }, [criteria, currentIndex, evaluation, hasNextPage])
  const handleRetryEvaluationData = React.useCallback(() => {
    if (isComparisonSetQueryError) {
      void refetchComparisonSet()
    }
    if (isAssessmentQueryError) {
      void refetchAssessments()
    }
  }, [isAssessmentQueryError, isComparisonSetQueryError, refetchAssessments, refetchComparisonSet])

  const comparisonOption: TechnicalConfigurationComparisonOption | null = selectedOption
    ? (result?.data.options.find((option) => option.id === activeSelectedOptionId) ??
      toTechnicalConfigurationComparisonOption(selectedOption))
    : null
  const currentOptionValue =
    currentRow && comparisonOption
      ? currentRow.optionValues.find((value) => value.optionId === comparisonOption.id)
      : undefined
  const detail =
    currentRow && comparisonOption
      ? createTechnicalConfigurationOptionCriterionDetail({
          row: currentRow,
          option: comparisonOption,
          value: currentOptionValue,
          baselineVersionId,
        })
      : null
  const draft = evaluation.draft
  const saveDisabled =
    Boolean(dossier.archived_at) || !evaluation.isReady || !isDirty || isNavigationBlocked

  return (
    <section className="min-w-0 space-y-4" aria-label="Không gian đánh giá cấu hình kỹ thuật">
      <div className="flex flex-col gap-2 border-y py-3 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor="technical-configuration-evaluation-option">Phương án đánh giá</Label>
        <Select
          value={activeSelectedOptionId}
          onValueChange={handleOptionChange}
          disabled={isNavigationBlocked}
        >
          <SelectTrigger
            id="technical-configuration-evaluation-option"
            aria-label="Phương án đánh giá"
            className="w-full sm:max-w-md"
          >
            <SelectValue placeholder="Chọn phương án" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.display_label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TechnicalConfigurationProgressSummary
        progress={progress}
        isLoading={comparisonSetQuery.isLoading || assessmentQuery.isLoading}
        isError={hasEvaluationReadError}
      />

      {comparison.comparisonQuery.isLoading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải tiêu chí...
        </div>
      ) : null}
      {comparison.comparisonQuery.isError ? (
        <TechnicalConfigurationEvaluationLoadError
          title="Không thể tải tiêu chí đánh giá"
          error={comparison.comparisonQuery.error}
          fallback="Không thể tải dữ liệu so sánh."
          onRetry={() => void comparison.comparisonQuery.refetch()}
        />
      ) : null}
      {hasEvaluationReadError ? (
        <TechnicalConfigurationEvaluationLoadError
          title="Không thể tải dữ liệu đánh giá"
          error={evaluationReadError}
          fallback="Không thể tải comparison set hoặc đánh giá đã lưu."
          onRetry={handleRetryEvaluationData}
        />
      ) : null}
      {result ? (
        <>
          <TechnicalConfigurationCriterionList
            criteria={criteria}
            assessmentsByCriterionId={evaluation.assessmentsByCriterionId}
            currentCriterionId={criterionId}
            onSelectCriterion={handleCriterionChange}
            disabled={isNavigationBlocked}
          />
          <TechnicalConfigurationCriterionPagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            onPageChange={handlePageChange}
            disabled={isNavigationBlocked}
          />
        </>
      ) : null}

      <TechnicalConfigurationEvaluationPanel
        detail={detail}
        open={isPanelOpen && detail !== null}
        onOpenChange={setIsPanelOpen}
        returnFocusRef={detailReturnFocusRef}
        technicalAxis={draft?.technicalAxis ?? null}
        evidenceAxis={draft?.evidenceAxis ?? null}
        notes={draft?.notes ?? ""}
        onTechnicalAxisChange={evaluation.setTechnicalAxis}
        onEvidenceAxisChange={evaluation.setEvidenceAxis}
        onNotesChange={evaluation.setNotes}
        disabled={Boolean(dossier.archived_at)}
        loading={!evaluation.isReady}
        errorMessage={
          evaluation.error ? toTechnicalConfigurationSaveErrorMessage(evaluation.error) : null
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={saveDisabled}
              onClick={() => void handleSave()}
            >
              {isNavigationBlocked ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Lưu
            </Button>
            <Button
              type="button"
              disabled={saveDisabled}
              onClick={() => void handleSaveAndContinue()}
            >
              <StepForward className="size-4" aria-hidden="true" />
              Lưu &amp; tiếp tục
            </Button>
          </>
        }
      />
      {discardConfirmationDialog}
    </section>
  )
}
