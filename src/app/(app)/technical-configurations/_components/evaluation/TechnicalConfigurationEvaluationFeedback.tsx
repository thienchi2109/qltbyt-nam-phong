import { Loader2 } from "lucide-react"

import { TechnicalConfigurationEvaluationLoadError } from "./TechnicalConfigurationEvaluationLoadError"

type TechnicalConfigurationEvaluationFeedbackProps = {
  isPanelOpen: boolean
  isPanelLoading: boolean
  isPanelError: boolean
  panelError: unknown
  onRetryPanel: () => void
  hasEvaluationReadError: boolean
  evaluationReadError: unknown
  onRetryEvaluation: () => void
}

/** Renders asynchronous feedback for criterion details and saved assessments. */
// react-doctor-disable-next-line react-doctor/no-many-boolean-props -- Panel visibility and the two independent query states retain their source ownership.
export function TechnicalConfigurationEvaluationFeedback({
  isPanelOpen,
  isPanelLoading,
  isPanelError,
  panelError,
  onRetryPanel,
  hasEvaluationReadError,
  evaluationReadError,
  onRetryEvaluation,
}: Readonly<TechnicalConfigurationEvaluationFeedbackProps>) {
  return (
    <>
      {isPanelLoading && isPanelOpen ? (
        <div
          className="flex min-h-20 items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải tiêu chí...
        </div>
      ) : null}
      {isPanelOpen && isPanelError ? (
        <TechnicalConfigurationEvaluationLoadError
          title="Không thể tải tiêu chí đánh giá"
          error={panelError}
          fallback="Không thể tải dữ liệu so sánh."
          onRetry={onRetryPanel}
        />
      ) : null}
      {hasEvaluationReadError ? (
        <TechnicalConfigurationEvaluationLoadError
          title="Không thể tải dữ liệu đánh giá"
          error={evaluationReadError}
          fallback="Không thể tải comparison set hoặc đánh giá đã lưu."
          onRetry={onRetryEvaluation}
        />
      ) : null}
    </>
  )
}
