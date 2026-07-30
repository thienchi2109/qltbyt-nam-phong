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
}

/** Adds manual assessment controls to the single shared P10B criterion detail surface. */
export function TechnicalConfigurationEvaluationPanel({
  detail,
  open,
  onOpenChange,
  returnFocusRef,
  ...assessmentControls
}: Readonly<TechnicalConfigurationEvaluationPanelProps>) {
  return (
    <TechnicalConfigurationCriterionPanel
      detail={detail}
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      assessmentControls={<TechnicalConfigurationAssessmentControls {...assessmentControls} />}
    />
  )
}
