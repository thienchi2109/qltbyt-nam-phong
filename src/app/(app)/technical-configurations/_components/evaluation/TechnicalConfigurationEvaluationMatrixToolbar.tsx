"use client"

import { useTechnicalConfigurationComparisonMatrix } from "../../_hooks/useTechnicalConfigurationComparisonMatrix"
import { TechnicalConfigurationMatrixToolbar } from "../comparison/TechnicalConfigurationMatrixToolbar"

type TechnicalConfigurationEvaluationMatrixToolbarProps = {
  matrix: ReturnType<typeof useTechnicalConfigurationComparisonMatrix>
  activeOptionId: string
  navigationBlocked: boolean
  runContextChange: (change: () => void) => void
}

/** Applies assessment navigation guards to matrix request and column controls. */
export function TechnicalConfigurationEvaluationMatrixToolbar({
  matrix,
  activeOptionId,
  navigationBlocked,
  runContextChange,
}: Readonly<TechnicalConfigurationEvaluationMatrixToolbarProps>) {
  return (
    <TechnicalConfigurationMatrixToolbar
      baselineVersionId={matrix.baselineVersionId}
      versions={matrix.versions}
      versionsQuery={matrix.versionsQuery}
      options={matrix.options}
      optionsQuery={matrix.optionsQuery}
      selectedOptions={matrix.selectedOptions}
      visibleOptionIds={matrix.visibleOptionIds}
      pinnedOptionIds={matrix.pinnedOptionIds}
      focusedOptionId={matrix.focusedOptionId}
      isSelectionLimitReached={matrix.isSelectionLimitReached}
      onSelectBaselineVersion={(id) => runContextChange(() => matrix.selectBaselineVersion(id))}
      onLoadMoreVersions={() => void matrix.loadMoreVersions()}
      onRetryVersions={() => void matrix.retryVersions()}
      onRetryOptions={() => void matrix.optionsQuery.refetch()}
      onAddOption={(id) => {
        if (!navigationBlocked) matrix.addOption(id)
      }}
      onRemoveOption={(id) => {
        if (id === activeOptionId) {
          runContextChange(() => matrix.removeOption(id))
          return
        }
        if (!navigationBlocked) matrix.removeOption(id)
      }}
      onToggleOptionVisibility={(id) => {
        if (id === activeOptionId && matrix.visibleOptionIds.includes(id)) {
          runContextChange(() => matrix.toggleOptionVisibility(id))
          return
        }
        if (!navigationBlocked) matrix.toggleOptionVisibility(id)
      }}
      onToggleOptionPin={(id) => {
        if (!navigationBlocked) matrix.toggleOptionPin(id)
      }}
      onFocusOption={(id) => {
        if (id === activeOptionId) {
          if (!navigationBlocked) matrix.focusOption(id)
          return
        }
        runContextChange(() => matrix.focusOption(id))
      }}
      onExitFocus={() => {
        if (!matrix.visibleOptionIds.includes(activeOptionId)) {
          runContextChange(() => matrix.exitFocusMode())
          return
        }
        if (!navigationBlocked) matrix.exitFocusMode()
      }}
    />
  )
}
