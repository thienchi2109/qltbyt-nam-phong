import { describe, expect, it } from "vitest"

import {
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS,
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES,
  TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_LABELS,
  TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES,
  TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_LABELS,
  TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_VALUES,
  deriveTechnicalConfigurationEvaluationStatus,
  type TechnicalConfigurationEvidenceAxis,
  type TechnicalConfigurationTechnicalAxis,
} from "@/lib/technical-configuration-evaluation"

const EVIDENCE_INPUTS = [...TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES, null, undefined] as const

describe("technical configuration manual evaluation contract", () => {
  it("freezes the canonical technical-axis values and Vietnamese labels", () => {
    expect(TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_VALUES).toEqual([
      "exceeds",
      "meets",
      "fails",
      "unclear",
      "not_applicable",
    ])
    expect(TECHNICAL_CONFIGURATION_TECHNICAL_AXIS_LABELS).toEqual({
      exceeds: "Vượt yêu cầu",
      meets: "Đạt",
      fails: "Không đạt",
      unclear: "Chưa rõ",
      not_applicable: "Không áp dụng",
    })
  })

  it("freezes the canonical evidence-axis values and Vietnamese labels", () => {
    expect(TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_VALUES).toEqual([
      "complete",
      "partial",
      "missing",
      "not_required",
    ])
    expect(TECHNICAL_CONFIGURATION_EVIDENCE_AXIS_LABELS).toEqual({
      complete: "Đầy đủ",
      partial: "Một phần",
      missing: "Thiếu",
      not_required: "Không yêu cầu",
    })
  })

  it("freezes the canonical derived statuses and Vietnamese labels", () => {
    expect(TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES).toEqual([
      "not_evaluated",
      "not_applicable",
      "fails",
      "unclear",
      "insufficient_evidence",
      "exceeds",
      "meets",
    ])
    expect(TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS).toEqual({
      not_evaluated: "Chưa đánh giá",
      not_applicable: "Không áp dụng",
      fails: "Không đạt",
      unclear: "Chưa rõ",
      insufficient_evidence: "Chưa đủ bằng chứng",
      exceeds: "Vượt yêu cầu",
      meets: "Đạt",
    })
  })

  it.each([
    ["fails", "fails"],
    ["unclear", "unclear"],
    ["not_applicable", "not_applicable"],
  ] as const)(
    "keeps %s authoritative for every canonical or missing evidence value",
    (technicalAxis, expectedStatus) => {
      for (const evidenceAxis of EVIDENCE_INPUTS) {
        expect(deriveTechnicalConfigurationEvaluationStatus(technicalAxis, evidenceAxis)).toBe(
          expectedStatus
        )
      }
    }
  )

  it.each([
    ["exceeds", "complete", "exceeds"],
    ["exceeds", "not_required", "exceeds"],
    ["meets", "complete", "meets"],
    ["meets", "not_required", "meets"],
    ["exceeds", "partial", "insufficient_evidence"],
    ["exceeds", "missing", "insufficient_evidence"],
    ["meets", "partial", "insufficient_evidence"],
    ["meets", "missing", "insufficient_evidence"],
    ["exceeds", null, "not_evaluated"],
    ["exceeds", undefined, "not_evaluated"],
    ["meets", null, "not_evaluated"],
    ["meets", undefined, "not_evaluated"],
  ] as const)(
    "derives %s with %s evidence as %s",
    (technicalAxis, evidenceAxis, expectedStatus) => {
      expect(deriveTechnicalConfigurationEvaluationStatus(technicalAxis, evidenceAxis)).toBe(
        expectedStatus
      )
    }
  )

  it.each(EVIDENCE_INPUTS)(
    "maps a missing technical axis with %s evidence to not_evaluated",
    (evidenceAxis) => {
      expect(deriveTechnicalConfigurationEvaluationStatus(null, evidenceAxis)).toBe("not_evaluated")
      expect(deriveTechnicalConfigurationEvaluationStatus(undefined, evidenceAxis)).toBe(
        "not_evaluated"
      )
    }
  )

  it.each(["", "unexpected"])("rejects invalid technical-axis value %j", (value) => {
    expect(() =>
      deriveTechnicalConfigurationEvaluationStatus(
        value as TechnicalConfigurationTechnicalAxis,
        "complete"
      )
    ).toThrow(`Invalid technical configuration technical axis: ${value}`)
  })

  it.each(["", "unexpected"])(
    "rejects invalid evidence-axis value %j before applying technical precedence",
    (value) => {
      expect(() =>
        deriveTechnicalConfigurationEvaluationStatus(
          "fails",
          value as TechnicalConfigurationEvidenceAxis
        )
      ).toThrow(`Invalid technical configuration evidence axis: ${value}`)
    }
  )
})
