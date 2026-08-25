import { describe, expect, it } from "vitest"

import {
  moveTechnicalConfigurationBaselineEditorCriterionToOwner,
  moveTechnicalConfigurationBaselineEditorGroupToIndex,
  moveTechnicalConfigurationBaselineEditorSubgroupToIndex,
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

function groupRow(id: string) {
  return group({ id, name: id, criteria: [], subgroups: [] })
}

function subgroupRow(id: string) {
  return subgroup({ id, name: id, criteria: [] })
}

describe("technical configuration baseline hierarchy editor target ordering", () => {
  it("reorders groups by stable key to target indexes at the start, middle, and end", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(
      wireDraft({
        groups: [
          groupRow("group-1"),
          groupRow("group-2"),
          groupRow("group-3"),
          groupRow("group-4"),
        ],
      })
    )
    const originalGroups = editorDraft.groups

    const movedToStart = moveTechnicalConfigurationBaselineEditorGroupToIndex(
      editorDraft,
      "group-3",
      0
    )
    const movedToMiddle = moveTechnicalConfigurationBaselineEditorGroupToIndex(
      editorDraft,
      "group-4",
      2
    )
    const movedToEnd = moveTechnicalConfigurationBaselineEditorGroupToIndex(
      editorDraft,
      "group-1",
      3
    )

    expect(movedToStart.groups.map((item) => item.key)).toEqual([
      "group-3",
      "group-1",
      "group-2",
      "group-4",
    ])
    expect(movedToMiddle.groups.map((item) => item.key)).toEqual([
      "group-1",
      "group-2",
      "group-4",
      "group-3",
    ])
    expect(movedToEnd.groups.map((item) => item.key)).toEqual([
      "group-2",
      "group-3",
      "group-4",
      "group-1",
    ])
    expect(movedToStart.groups[0]).toBe(originalGroups[2])
    expect(editorDraft.groups).toBe(originalGroups)
  })

  it("reorders subgroups by stable key and target index within the same parent", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(
      wireDraft({
        groups: [
          group({
            criteria: [],
            subgroups: [
              subgroupRow("subgroup-1"),
              subgroupRow("subgroup-2"),
              subgroupRow("subgroup-3"),
            ],
          }),
        ],
      })
    )
    const originalSubgroups = editorDraft.groups[0].subgroups

    const moved = moveTechnicalConfigurationBaselineEditorSubgroupToIndex(
      editorDraft,
      "group-1",
      "subgroup-3",
      1
    )

    expect(moved.groups[0].subgroups.map((item) => item.key)).toEqual([
      "subgroup-1",
      "subgroup-3",
      "subgroup-2",
    ])
    expect(moved.groups[0].subgroups[1]).toBe(originalSubgroups[2])
    expect(editorDraft.groups[0].subgroups).toBe(originalSubgroups)
  })

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

  it("preserves stable criterion identity and every field for indexed same-owner and cross-owner moves", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(
      wireDraft({
        groups: [
          group({
            criteria: [
              criterion({
                title: "-",
                requirement_text: "Requirement with a literal dash title",
              }),
              criterionRow("criterion-direct-2", "TC-0002"),
            ],
            subgroups: [subgroup({ criteria: [] })],
          }),
        ],
      })
    )
    const originalCriterion = editorDraft.groups[0].criteria[0]
    const directOwner = { groupKey: "group-1", subgroupKey: null }
    const subgroupOwner = { groupKey: "group-1", subgroupKey: "subgroup-1" }

    const reordered = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      editorDraft,
      directOwner,
      originalCriterion.key,
      directOwner,
      1
    )
    const movedAcrossOwners = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      reordered,
      directOwner,
      originalCriterion.key,
      subgroupOwner,
      0
    )

    expect(reordered.groups[0].criteria[1]).toBe(originalCriterion)
    expect(movedAcrossOwners.groups[0].subgroups[0].criteria[0]).toBe(originalCriterion)
    expect(movedAcrossOwners.groups[0].subgroups[0].criteria[0]).toEqual({
      key: "criterion-direct",
      id: "criterion-direct",
      criterionCode: "TC-0001",
      title: "-",
      requirementText: "Requirement with a literal dash title",
    })
  })
})
