/** Stable persisted/domain values for the manual technical assessment axis. */
export const TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_VALUES = [
  "exceeds",
  "meets",
  "fails",
  "unclear",
  "not_applicable",
] as const

export type TechnicalConfigurationTechnicalAxis =
  (typeof TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_VALUES)[number]

/** Vietnamese display labels for the manual technical assessment axis. */
export const TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_LABELS = {
  exceeds: "Vượt yêu cầu",
  meets: "Đạt",
  fails: "Không đạt",
  unclear: "Chưa rõ",
  not_applicable: "Không áp dụng",
} as const satisfies Record<TechnicalConfigurationTechnicalAxis, string>

/** Stable persisted/domain values for the manual evidence assessment axis. */
export const TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES = [
  "complete",
  "partial",
  "missing",
  "not_required",
] as const

export type TechnicalConfigurationEvidenceAxis =
  (typeof TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES)[number]

/** Vietnamese display labels for the manual evidence assessment axis. */
export const TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_LABELS = {
  complete: "Đầy đủ",
  partial: "Một phần",
  missing: "Thiếu",
  not_required: "Không yêu cầu",
} as const satisfies Record<TechnicalConfigurationEvidenceAxis, string>

/** Stable derived statuses calculated from the two manual assessment axes. */
export const TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES = [
  "not_evaluated",
  "not_applicable",
  "fails",
  "unclear",
  "insufficient_evidence",
  "exceeds",
  "meets",
] as const

export type TechnicalConfigurationDerivedStatus =
  (typeof TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES)[number]

/** Vietnamese display labels for the derived manual evaluation status. */
export const TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS = {
  not_evaluated: "Chưa đánh giá",
  not_applicable: "Không áp dụng",
  fails: "Không đạt",
  unclear: "Chưa rõ",
  insufficient_evidence: "Chưa đủ bằng chứng",
  exceeds: "Vượt yêu cầu",
  meets: "Đạt",
} as const satisfies Record<TechnicalConfigurationDerivedStatus, string>

function isTechnicalConfigurationTechnicalAxis(
  value: unknown
): value is TechnicalConfigurationTechnicalAxis {
  return (
    typeof value === "string" &&
    (TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_VALUES as readonly string[]).includes(value)
  )
}

function isTechnicalConfigurationEvidenceAxis(
  value: unknown
): value is TechnicalConfigurationEvidenceAxis {
  return (
    typeof value === "string" &&
    (TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES as readonly string[]).includes(value)
  )
}

/** Derives the canonical overall status from nullable manual assessment axes. */
export function deriveTechnicalConfigurationEvaluationStatus(
  technicalAxis: TechnicalConfigurationTechnicalAxis | null | undefined,
  evidenceAxis: TechnicalConfigurationEvidenceAxis | null | undefined
): TechnicalConfigurationDerivedStatus {
  if (
    technicalAxis !== null &&
    technicalAxis !== undefined &&
    !isTechnicalConfigurationTechnicalAxis(technicalAxis)
  ) {
    throw new Error(`Invalid technical configuration technical axis: ${String(technicalAxis)}`)
  }

  if (
    evidenceAxis !== null &&
    evidenceAxis !== undefined &&
    !isTechnicalConfigurationEvidenceAxis(evidenceAxis)
  ) {
    throw new Error(`Invalid technical configuration evidence axis: ${String(evidenceAxis)}`)
  }

  if (technicalAxis === null || technicalAxis === undefined) {
    return "not_evaluated"
  }

  if (
    technicalAxis === "not_applicable" ||
    technicalAxis === "fails" ||
    technicalAxis === "unclear"
  ) {
    return technicalAxis
  }

  if (evidenceAxis === null || evidenceAxis === undefined) {
    return "not_evaluated"
  }

  if (evidenceAxis === "partial" || evidenceAxis === "missing") {
    return "insufficient_evidence"
  }

  return technicalAxis
}
