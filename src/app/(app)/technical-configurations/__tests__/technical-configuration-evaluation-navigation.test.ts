import { describe, expect, it } from "vitest"

import {
  buildTechnicalConfigurationEvaluationProjection,
  findNextTechnicalConfigurationEvaluationCriterion,
  getTechnicalConfigurationEvaluationPage,
} from "../_components/evaluation/technical-configuration-evaluation-navigation"
import { createBaselineGroups } from "./technical-configuration-evaluation-workspace.test-support"

const serverEntries = [
  { criterion_id: "criterion-1", canonical_index: 1, canonical_page: 1 },
  { criterion_id: "criterion-3", canonical_index: 3, canonical_page: 2 },
] as const

describe("P12B2 evaluation navigation projection", () => {
  it("uses the exact server-filtered IDs in canonical response order", () => {
    const projection = buildTechnicalConfigurationEvaluationProjection({
      groups: createBaselineGroups(),
      entries: serverEntries,
    })

    expect(projection.map((item) => item.criterion.id)).toEqual(["criterion-1", "criterion-3"])
    expect(projection.map((item) => item.canonicalPage)).toEqual([1, 2])
  })

  it("paginates the server-filtered projection without changing canonical page mapping", () => {
    const projection = buildTechnicalConfigurationEvaluationProjection({
      groups: createBaselineGroups(),
      entries: [
        { criterion_id: "criterion-1", canonical_index: 1, canonical_page: 1 },
        { criterion_id: "criterion-2", canonical_index: 2, canonical_page: 1 },
        { criterion_id: "criterion-3", canonical_index: 3, canonical_page: 2 },
      ],
    })

    expect(
      getTechnicalConfigurationEvaluationPage({
        projection,
        page: 2,
        pageSize: 2,
      }).map((item) => ({
        criterionId: item.criterion.id,
        canonicalPage: item.canonicalPage,
      }))
    ).toEqual([{ criterionId: "criterion-3", canonicalPage: 2 }])
  })

  it("finds the next matching criterion by canonical position and never wraps", () => {
    const projection = buildTechnicalConfigurationEvaluationProjection({
      groups: createBaselineGroups(),
      entries: serverEntries,
    })

    expect(
      findNextTechnicalConfigurationEvaluationCriterion({
        projection,
        currentCanonicalIndex: 1,
      })?.criterion.id
    ).toBe("criterion-3")
    expect(
      findNextTechnicalConfigurationEvaluationCriterion({
        projection,
        currentCanonicalIndex: 3,
      })
    ).toBeNull()
  })
})
