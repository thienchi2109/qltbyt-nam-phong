"use client"

import * as React from "react"

import type { TechnicalConfigurationDossierWire } from "../../types"
import { useTechnicalConfigurationComparisonMatrix } from "../../_hooks/useTechnicalConfigurationComparisonMatrix"
import {
  TechnicalConfigurationCriterionPanel,
  type TechnicalConfigurationCriterionDetail,
} from "./TechnicalConfigurationCriterionPanel"
import { TechnicalConfigurationMatrix } from "./TechnicalConfigurationMatrix"
import { TechnicalConfigurationMatrixToolbar } from "./TechnicalConfigurationMatrixToolbar"

type TechnicalConfigurationComparisonTabProps = {
  dossier: TechnicalConfigurationDossierWire
}

/** Composes the read-only P10B1 comparison request, matrix, and criterion detail. */
export function TechnicalConfigurationComparisonTab({
  dossier,
}: Readonly<TechnicalConfigurationComparisonTabProps>) {
  const matrix = useTechnicalConfigurationComparisonMatrix(dossier.id)
  const [detail, setDetail] = React.useState<TechnicalConfigurationCriterionDetail | null>(null)
  const detailReturnFocusRef = React.useRef<HTMLElement | null>(null)
  const { comparisonQuery } = matrix.comparison
  const hasRequest = matrix.baselineVersionId !== null && matrix.selectedOptionIds.length > 0
  const openDetail = React.useCallback((nextDetail: TechnicalConfigurationCriterionDetail) => {
    detailReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDetail(nextDetail)
  }, [])

  return (
    <section className="min-w-0 space-y-4" aria-label="Ma trận so sánh cấu hình kỹ thuật">
      <TechnicalConfigurationMatrixToolbar
        baselineVersionId={matrix.baselineVersionId}
        versions={matrix.versions}
        versionsQuery={matrix.versionsQuery}
        options={matrix.options}
        optionsQuery={matrix.optionsQuery}
        selectedOptions={matrix.selectedOptions}
        isSelectionLimitReached={matrix.isSelectionLimitReached}
        onSelectBaselineVersion={matrix.selectBaselineVersion}
        onLoadMoreVersions={() => void matrix.loadMoreVersions()}
        onRetryVersions={() => void matrix.retryVersions()}
        onRetryOptions={() => void matrix.optionsQuery.refetch()}
        onAddOption={matrix.addOption}
        onRemoveOption={matrix.removeOption}
      />

      <TechnicalConfigurationMatrix
        hasRequest={hasRequest}
        result={comparisonQuery.data}
        isLoading={comparisonQuery.isLoading}
        isError={comparisonQuery.isError}
        error={comparisonQuery.error}
        onRetry={() => void comparisonQuery.refetch()}
        onPageChange={matrix.setPage}
        onOpenDetail={openDetail}
      />

      <TechnicalConfigurationCriterionPanel
        detail={detail}
        open={detail !== null}
        returnFocusRef={detailReturnFocusRef}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      />
    </section>
  )
}
