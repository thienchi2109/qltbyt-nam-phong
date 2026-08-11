import { describe, expect, it } from "vitest"

import {
  moveTechnicalConfigurationBaselineEditorCriterionToOwner,
  toTechnicalConfigurationBaselineEditorDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

import {
  criterion,
  group,
  subgroup,
  wireDraft,
} from "./technical-configuration-baseline-hierarchy-editor-state-fixtures"

function criterionRow(id: string, criterionCode: string, subgroupId: string | null = null) {
  return criterion({
    id,
    subgroup_id: subgroupId,
    criterion_code: criterionCode,
    requirement_text: id,
  })
}

describe("technical configuration baseline hierarchy editor target ordering", () => {
  it("supports same-owner middle, default, and clamped target indexes", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(
      wireDraft({
        groups: [
          group({
            criteria: [
              criterion(),
              criterionRow("criterion-direct-2", "TC-0002"),
              criterionRow("criterion-direct-3", "TC-0003"),
            ],
            subgroups: [],
          }),
        ],
      })
    )
    const originalCriteria = editorDraft.groups[0].criteria
    const owner = { groupKey: "group-1", subgroupKey: null }

    const movedToMiddle = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      editorDraft,
      owner,
      "criterion-direct",
      owner,
      1
    )
    const movedToEnd = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      movedToMiddle,
      owner,
      "criterion-direct-2",
      owner
    )
    const clampedToStart = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      movedToEnd,
      owner,
      "criterion-direct-2",
      owner,
      -99
    )
    const clampedToEnd = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      clampedToStart,
      owner,
      "criterion-direct-2",
      owner,
      99
    )

    expect(movedToMiddle.groups[0].criteria.map((item) => item.id)).toEqual([
      "criterion-direct-2",
      "criterion-direct",
      "criterion-direct-3",
    ])
    expect(movedToMiddle.groups[0].criteria[1]).toBe(originalCriteria[0])
    expect(movedToEnd.groups[0].criteria.map((item) => item.id)).toEqual([
      "criterion-direct",
      "criterion-direct-3",
      "criterion-direct-2",
    ])
    expect(clampedToStart.groups[0].criteria.map((item) => item.id)).toEqual([
      "criterion-direct-2",
      "criterion-direct",
      "criterion-direct-3",
    ])
    expect(clampedToEnd.groups[0].criteria.map((item) => item.id)).toEqual([
      "criterion-direct",
      "criterion-direct-3",
      "criterion-direct-2",
    ])
    expect(clampedToEnd.groups[0].criteria[2]).toBe(originalCriteria[1])
  })

  it("inserts cross-owner moves at middle, default, and clamped target indexes", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(
      wireDraft({
        groups: [
          group({
            criteria: [
              criterion(),
              criterionRow("criterion-direct-2", "TC-0002"),
              criterionRow("criterion-direct-3", "TC-0003"),
              criterionRow("criterion-direct-4", "TC-0004"),
            ],
            subgroups: [
              subgroup({
                criteria: [
                  criterionRow("criterion-subgroup-1", "TC-0005", "subgroup-1"),
                  criterionRow("criterion-subgroup-2", "TC-0006", "subgroup-1"),
                ],
              }),
            ],
          }),
        ],
      })
    )
    const originalDirectCriteria = editorDraft.groups[0].criteria
    const directOwner = { groupKey: "group-1", subgroupKey: null }
    const subgroupOwner = { groupKey: "group-1", subgroupKey: "subgroup-1" }

    const movedToMiddle = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      editorDraft,
      directOwner,
      "criterion-direct",
      subgroupOwner,
      1
    )
    const movedToDefault = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      movedToMiddle,
      directOwner,
      "criterion-direct-2",
      subgroupOwner
    )
    const clampedToStart = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      movedToDefault,
      directOwner,
      "criterion-direct-3",
      subgroupOwner,
      -99
    )
    const clampedToEnd = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      clampedToStart,
      directOwner,
      "criterion-direct-4",
      subgroupOwner,
      99
    )

    expect(clampedToEnd.groups[0].criteria).toEqual([])
    expect(clampedToEnd.groups[0].subgroups[0].criteria.map((item) => item.id)).toEqual([
      "criterion-direct-3",
      "criterion-subgroup-1",
      "criterion-direct",
      "criterion-subgroup-2",
      "criterion-direct-2",
      "criterion-direct-4",
    ])
    expect(clampedToEnd.groups[0].subgroups[0].criteria[0]).toBe(originalDirectCriteria[2])
    expect(clampedToEnd.groups[0].subgroups[0].criteria[2]).toBe(originalDirectCriteria[0])
    expect(clampedToEnd.groups[0].subgroups[0].criteria[4]).toBe(originalDirectCriteria[1])
    expect(clampedToEnd.groups[0].subgroups[0].criteria[5]).toBe(originalDirectCriteria[3])
  })
})
