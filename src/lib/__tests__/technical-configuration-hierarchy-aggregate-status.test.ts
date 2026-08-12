import { describe, expect, it } from "vitest"

import {
  TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS,
  TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_VALUES,
  buildTechnicalConfigurationHierarchyAggregateStatus,
  type TechnicalConfigurationAggregateStatus,
} from "@/lib/technical-configuration-hierarchy-aggregate-status"
import {
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES,
  type TechnicalConfigurationDerivedStatus,
} from "@/lib/technical-configuration-evaluation"

const ALL_STATUS_COUNTS = {
  not_evaluated: 0,
  not_applicable: 0,
  fails: 0,
  unclear: 0,
  insufficient_evidence: 0,
  exceeds: 0,
  meets: 0,
} as const

const SINGLE_STATUS_EXPECTED_AGGREGATE = {
  not_evaluated: "in_progress",
  not_applicable: "not_applicable",
  fails: "failed",
  unclear: "needs_clarification",
  insufficient_evidence: "needs_clarification",
  exceeds: "passed",
  meets: "passed",
} as const satisfies Record<
  TechnicalConfigurationDerivedStatus,
  TechnicalConfigurationAggregateStatus
>

function buildSingleSectionModel(
  statuses: readonly TechnicalConfigurationDerivedStatus[]
): ReturnType<typeof buildTechnicalConfigurationHierarchyAggregateStatus> {
  const criterionIds = statuses.map((_, index) => `criterion-${index + 1}`)

  return buildTechnicalConfigurationHierarchyAggregateStatus({
    sections: [
      {
        id: "section-1",
        criterionIds,
        subgroups: [],
      },
    ],
    statusByCriterionId: new Map(
      criterionIds.map((criterionId, index) => [criterionId, statuses[index]])
    ),
  })
}

describe("technical configuration hierarchy aggregate status", () => {
  it("publishes stable aggregate states and Vietnamese labels", () => {
    expect(TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_VALUES).toEqual([
      "no_criteria",
      "failed",
      "in_progress",
      "needs_clarification",
      "not_applicable",
      "passed",
    ])
    expect(TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS).toEqual({
      no_criteria: "Chưa có tiêu chí",
      failed: "Không đạt",
      in_progress: "Đang đánh giá",
      needs_clarification: "Cần làm rõ",
      not_applicable: "Không áp dụng",
      passed: "Đạt",
    })
  })

  it("returns no criteria and zero counts for an empty structural row", () => {
    const model = buildSingleSectionModel([])

    expect(model.criterionIds).toEqual([])
    expect(model.sections[0]).toMatchObject({
      id: "section-1",
      status: "no_criteria",
      descendantCriterionIds: [],
      descendantCount: 0,
      statusCounts: ALL_STATUS_COUNTS,
    })
  })

  it.each(TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES)(
    "handles the canonical %s leaf status explicitly",
    (status) => {
      const model = buildSingleSectionModel([status])

      expect(model.sections[0]?.status).toBe(SINGLE_STATUS_EXPECTED_AGGREGATE[status])
    }
  )

  it.each([
    {
      name: "fails immediately even while another leaf is incomplete",
      statuses: ["not_evaluated", "fails", "unclear"],
      expected: "failed",
    },
    {
      name: "stays in progress before review-required states can win",
      statuses: ["meets", "not_evaluated", "insufficient_evidence"],
      expected: "in_progress",
    },
    {
      name: "requires clarification for unclear leaves after evaluation is complete",
      statuses: ["meets", "unclear"],
      expected: "needs_clarification",
    },
    {
      name: "requires clarification for insufficient evidence",
      statuses: ["exceeds", "insufficient_evidence"],
      expected: "needs_clarification",
    },
    {
      name: "is not applicable when every descendant is not applicable",
      statuses: ["not_applicable", "not_applicable"],
      expected: "not_applicable",
    },
    {
      name: "passes when at least one applicable descendant meets",
      statuses: ["not_applicable", "meets"],
      expected: "passed",
    },
    {
      name: "passes without introducing a separate exceeds aggregate state",
      statuses: ["meets", "exceeds", "exceeds"],
      expected: "passed",
    },
  ] as const)("$name", ({ statuses, expected }) => {
    const model = buildSingleSectionModel(statuses)

    expect(model.sections[0]?.status).toBe(expected)
  })

  it("counts every canonical derived status exactly", () => {
    const statuses = [
      "not_evaluated",
      "not_applicable",
      "fails",
      "unclear",
      "insufficient_evidence",
      "exceeds",
      "meets",
    ] as const satisfies readonly TechnicalConfigurationDerivedStatus[]

    const model = buildSingleSectionModel(statuses)

    expect(model.sections[0]).toMatchObject({
      status: "failed",
      descendantCount: statuses.length,
      statusCounts: {
        not_evaluated: 1,
        not_applicable: 1,
        fails: 1,
        unclear: 1,
        insufficient_evidence: 1,
        exceeds: 1,
        meets: 1,
      },
    })
  })

  it("treats a missing canonical leaf status as not evaluated", () => {
    const model = buildTechnicalConfigurationHierarchyAggregateStatus({
      sections: [
        {
          id: "section-1",
          criterionIds: ["criterion-1"],
          subgroups: [],
        },
      ],
      statusByCriterionId: new Map(),
    })

    expect(model.sections[0]).toMatchObject({
      status: "in_progress",
      descendantCount: 1,
      statusCounts: {
        ...ALL_STATUS_COUNTS,
        not_evaluated: 1,
      },
    })
    expect(model.leafCriteria).toEqual([{ criterionId: "criterion-1", status: "not_evaluated" }])
    expect(model.statusCounts).toEqual({
      ...ALL_STATUS_COUNTS,
      not_evaluated: 1,
    })
  })

  it("fails closed for an unknown runtime leaf status", () => {
    const statusByCriterionId = new Map([
      ["criterion-1", "future_review_status"],
    ]) as unknown as ReadonlyMap<string, TechnicalConfigurationDerivedStatus>

    expect(() =>
      buildTechnicalConfigurationHierarchyAggregateStatus({
        sections: [
          {
            id: "section-1",
            criterionIds: ["criterion-1"],
            subgroups: [],
          },
        ],
        statusByCriterionId,
      })
    ).toThrow("Unsupported technical configuration derived status: future_review_status")
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
  ] as const)("fails closed for a present %s runtime leaf status", (_, invalidStatus) => {
    const statusByCriterionId = new Map([["criterion-1", invalidStatus]]) as unknown as ReadonlyMap<
      string,
      TechnicalConfigurationDerivedStatus
    >

    expect(() =>
      buildTechnicalConfigurationHierarchyAggregateStatus({
        sections: [
          {
            id: "section-1",
            criterionIds: ["criterion-1"],
            subgroups: [],
          },
        ],
        statusByCriterionId,
      })
    ).toThrow(`Unsupported technical configuration derived status: ${String(invalidStatus)}`)
  })

  it("rolls subgroups and sections up over unique leaf criterion IDs", () => {
    const model = buildTechnicalConfigurationHierarchyAggregateStatus({
      sections: [
        {
          id: "section-1",
          criterionIds: ["criterion-a", "criterion-shared", "criterion-a"],
          subgroups: [
            {
              id: "subgroup-1",
              criterionIds: ["criterion-b", "criterion-shared", "criterion-b"],
            },
            {
              id: "subgroup-2",
              criterionIds: ["criterion-c", "criterion-b"],
            },
          ],
        },
      ],
      statusByCriterionId: new Map([
        ["criterion-a", "meets"],
        ["criterion-shared", "fails"],
        ["criterion-b", "not_applicable"],
        ["criterion-c", "exceeds"],
      ]),
    })

    expect(model.criterionIds).toEqual([
      "criterion-a",
      "criterion-shared",
      "criterion-b",
      "criterion-c",
    ])
    expect(model.sections[0]).toMatchObject({
      id: "section-1",
      status: "failed",
      descendantCriterionIds: ["criterion-a", "criterion-shared", "criterion-b", "criterion-c"],
      descendantCount: 4,
      statusCounts: {
        ...ALL_STATUS_COUNTS,
        not_applicable: 1,
        fails: 1,
        exceeds: 1,
        meets: 1,
      },
    })
    expect(model.sections[0]?.subgroups).toEqual([
      {
        id: "subgroup-1",
        status: "failed",
        descendantCriterionIds: ["criterion-b", "criterion-shared"],
        descendantCount: 2,
        statusCounts: {
          ...ALL_STATUS_COUNTS,
          not_applicable: 1,
          fails: 1,
        },
      },
      {
        id: "subgroup-2",
        status: "passed",
        descendantCriterionIds: ["criterion-c", "criterion-b"],
        descendantCount: 2,
        statusCounts: {
          ...ALL_STATUS_COUNTS,
          not_applicable: 1,
          exceeds: 1,
        },
      },
    ])
  })

  it("fails a section when only a subgroup-exclusive descendant fails", () => {
    const model = buildTechnicalConfigurationHierarchyAggregateStatus({
      sections: [
        {
          id: "section-1",
          criterionIds: ["criterion-direct"],
          subgroups: [
            {
              id: "subgroup-1",
              criterionIds: ["criterion-subgroup"],
            },
          ],
        },
      ],
      statusByCriterionId: new Map([
        ["criterion-direct", "meets"],
        ["criterion-subgroup", "fails"],
      ]),
    })

    expect(model.sections[0]).toMatchObject({
      status: "failed",
      descendantCriterionIds: ["criterion-direct", "criterion-subgroup"],
    })
    expect(model.sections[0]?.subgroups[0]).toMatchObject({
      status: "failed",
      descendantCriterionIds: ["criterion-subgroup"],
    })
  })
})
