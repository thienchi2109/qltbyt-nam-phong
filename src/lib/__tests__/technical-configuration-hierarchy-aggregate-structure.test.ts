import { describe, expect, it } from "vitest"

import { buildTechnicalConfigurationHierarchyAggregateStatus } from "@/lib/technical-configuration-hierarchy-aggregate-status"
import type { TechnicalConfigurationDerivedStatus } from "@/lib/technical-configuration-evaluation"

function expectEmptyAggregate(
  aggregate:
    | ReturnType<typeof buildTechnicalConfigurationHierarchyAggregateStatus>["sections"][number]
    | ReturnType<
        typeof buildTechnicalConfigurationHierarchyAggregateStatus
      >["sections"][number]["subgroups"][number]
): void {
  expect(aggregate).toMatchObject({
    status: "no_criteria",
    descendantCriterionIds: [],
    descendantCount: 0,
    statusCounts: {
      not_evaluated: 0,
      not_applicable: 0,
      fails: 0,
      unclear: 0,
      insufficient_evidence: 0,
      exceeds: 0,
      meets: 0,
    },
  })
}

describe("technical configuration hierarchy aggregate structure", () => {
  it("deduplicates the hierarchy-wide leaf universe without changing owner rollups", () => {
    const model = buildTechnicalConfigurationHierarchyAggregateStatus({
      sections: [
        {
          id: "section-1",
          criterionIds: ["criterion-shared", "criterion-a"],
          subgroups: [],
        },
        {
          id: "section-2",
          criterionIds: [],
          subgroups: [
            {
              id: "subgroup-2",
              criterionIds: ["criterion-shared", "criterion-b"],
            },
          ],
        },
      ],
      statusByCriterionId: new Map([
        ["criterion-shared", "fails"],
        ["criterion-a", "meets"],
        ["criterion-b", "exceeds"],
      ]),
    })

    expect(model.criterionIds).toEqual(["criterion-shared", "criterion-a", "criterion-b"])
    expect(model.leafCriteria).toEqual([
      { criterionId: "criterion-shared", status: "fails" },
      { criterionId: "criterion-a", status: "meets" },
      { criterionId: "criterion-b", status: "exceeds" },
    ])
    expect(model.statusCounts).toEqual({
      not_evaluated: 0,
      not_applicable: 0,
      fails: 1,
      unclear: 0,
      insufficient_evidence: 0,
      exceeds: 1,
      meets: 1,
    })
    expect(model.sections[0]).toMatchObject({
      descendantCriterionIds: ["criterion-shared", "criterion-a"],
      descendantCount: 2,
      status: "failed",
    })
    expect(model.sections[1]).toMatchObject({
      descendantCriterionIds: ["criterion-shared", "criterion-b"],
      descendantCount: 2,
      status: "failed",
    })
    expect(model.sections[1]?.subgroups[0]).toMatchObject({
      descendantCriterionIds: ["criterion-shared", "criterion-b"],
      descendantCount: 2,
      status: "failed",
    })
  })

  it("returns explicit empty aggregates for empty sections and subgroups", () => {
    const model = buildTechnicalConfigurationHierarchyAggregateStatus({
      sections: [
        {
          id: "empty-section",
          criterionIds: [],
          subgroups: [{ id: "empty-subgroup", criterionIds: [] }],
        },
      ],
      statusByCriterionId: new Map(),
    })

    expect(model.criterionIds).toEqual([])
    expectEmptyAggregate(model.sections[0]!)
    expectEmptyAggregate(model.sections[0]!.subgroups[0]!)
  })

  it("returns a snapshot independent from later input mutations", () => {
    const directCriterionIds = ["criterion-a"]
    const subgroupCriterionIds = ["criterion-b"]
    const subgroups = [{ id: "subgroup-1", criterionIds: subgroupCriterionIds }]
    const sections = [{ id: "section-1", criterionIds: directCriterionIds, subgroups }]
    const statusByCriterionId = new Map<string, TechnicalConfigurationDerivedStatus>([
      ["criterion-a", "meets"],
      ["criterion-b", "exceeds"],
    ])
    const originalInput = structuredClone(sections)

    const model = buildTechnicalConfigurationHierarchyAggregateStatus({
      sections,
      statusByCriterionId,
    })

    expect(sections).toEqual(originalInput)

    directCriterionIds.push("criterion-late")
    subgroupCriterionIds.push("criterion-late-subgroup")
    subgroups.push({ id: "subgroup-late", criterionIds: [] })
    sections.push({ id: "section-late", criterionIds: [], subgroups: [] })
    statusByCriterionId.set("criterion-a", "fails")

    expect(model.criterionIds).toEqual(["criterion-a", "criterion-b"])
    expect(model.sections).toHaveLength(1)
    expect(model.sections[0]).toMatchObject({
      status: "passed",
      descendantCriterionIds: ["criterion-a", "criterion-b"],
      descendantCount: 2,
    })
    expect(model.sections[0]?.subgroups).toHaveLength(1)
  })

  it("keeps structural rows out of denominator, filter, ranking, and score inputs", () => {
    const statusByCriterionId = new Map<string, TechnicalConfigurationDerivedStatus>([
      ["criterion-a", "not_evaluated"],
      ["criterion-b", "fails"],
      ["criterion-c", "insufficient_evidence"],
      ["criterion-d", "exceeds"],
    ])
    const flat = buildTechnicalConfigurationHierarchyAggregateStatus({
      sections: [
        {
          id: "flat-section",
          criterionIds: ["criterion-a", "criterion-b", "criterion-c", "criterion-d"],
          subgroups: [],
        },
      ],
      statusByCriterionId,
    })
    const nested = buildTechnicalConfigurationHierarchyAggregateStatus({
      sections: [
        {
          id: "section-1",
          criterionIds: ["criterion-a"],
          subgroups: [
            {
              id: "subgroup-1",
              criterionIds: ["criterion-b", "criterion-c", "criterion-d"],
            },
            {
              id: "subgroup-duplicate",
              criterionIds: ["criterion-b"],
            },
          ],
        },
        {
          id: "empty-section",
          criterionIds: [],
          subgroups: [{ id: "empty-subgroup", criterionIds: [] }],
        },
      ],
      statusByCriterionId,
    })

    expect(nested.criterionIds).toEqual([
      "criterion-a",
      "criterion-b",
      "criterion-c",
      "criterion-d",
    ])
    expect(nested.leafCriteria).toEqual(flat.leafCriteria)
    expect(nested.statusCounts).toEqual(flat.statusCounts)

    const progressDenominator = nested.leafCriteria.length
    const filterTotals = nested.statusCounts
    const rankingInputs = {
      criterionIds: nested.criterionIds,
      failed_count: nested.statusCounts.fails,
      insufficient_evidence_count: nested.statusCounts.insufficient_evidence,
      exceeds_count: nested.statusCounts.exceeds,
    }
    const scoreInputs = nested.leafCriteria

    expect(progressDenominator).toBe(4)
    expect(filterTotals).toEqual({
      not_evaluated: 1,
      not_applicable: 0,
      fails: 1,
      unclear: 0,
      insufficient_evidence: 1,
      exceeds: 1,
      meets: 0,
    })
    expect(rankingInputs).toEqual({
      criterionIds: ["criterion-a", "criterion-b", "criterion-c", "criterion-d"],
      failed_count: 1,
      insufficient_evidence_count: 1,
      exceeds_count: 1,
    })
    expect(scoreInputs).toEqual([
      { criterionId: "criterion-a", status: "not_evaluated" },
      { criterionId: "criterion-b", status: "fails" },
      { criterionId: "criterion-c", status: "insufficient_evidence" },
      { criterionId: "criterion-d", status: "exceeds" },
    ])
    expect(scoreInputs.every(({ criterionId }) => criterionId.startsWith("criterion-"))).toBe(true)
  })
})
