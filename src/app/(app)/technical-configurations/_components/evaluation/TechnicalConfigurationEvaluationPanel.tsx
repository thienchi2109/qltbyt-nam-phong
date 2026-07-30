"use client"

import type * as React from "react"

import {
  TechnicalConfigurationCriterionPanel,
  type TechnicalConfigurationCriterionDetail,
} from "../comparison/TechnicalConfigurationCriterionPanel"
import {
  TechnicalConfigurationAssessmentControls,
  type TechnicalConfigurationAssessmentControlsProps,
} from "./TechnicalConfigurationAssessmentControls"

type TechnicalConfigurationEvaluationPanelProps = TechnicalConfigurationAssessmentControlsProps & {
  detail: TechnicalConfigurationCriterionDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
  actions?: React.ReactNode
}

/** Adds manual assessment controls to the single shared P10B criterion detail surface. */
export function TechnicalConfigurationEvaluationPanel({
  detail,
  open,
  onOpenChange,
  returnFocusRef,
  actions,
  ...assessmentControls
}: Readonly<TechnicalConfigurationEvaluationPanelProps>) {
  return (
    <TechnicalConfigurationCriterionPanel
      detail={detail}
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      assessmentControls={
        <div className="space-y-4">
          <TechnicalConfigurationAssessmentControls {...assessmentControls} />
          {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
        </div>
      }
    />
  )
}
