import { describe, expect, it } from "vitest"

import {
  appendTechnicalConfigurationBaselineEditorCriterionToOwner,
  appendTechnicalConfigurationBaselineEditorGroup,
  appendTechnicalConfigurationBaselineEditorSubgroup,
  createTechnicalConfigurationBaselineEditorCriterion,
  createTechnicalConfigurationBaselineEditorGroup,
  createTechnicalConfigurationBaselineEditorSubgroup,
  moveTechnicalConfigurationBaselineEditorCriterionToOwner,
  moveTechnicalConfigurationBaselineEditorCriterionWithinOwner,
  moveTechnicalConfigurationBaselineEditorGroup,
  moveTechnicalConfigurationBaselineEditorSubgroup,
  removeTechnicalConfigurationBaselineEditorCriterionFromOwner,
  removeTechnicalConfigurationBaselineEditorGroup,
  removeTechnicalConfigurationBaselineEditorSubgroup,
  toTechnicalConfigurationBaselineEditorDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

import {
  criterion,
  group,
  subgroup,
  wireDraft,
} from "./technical-configuration-baseline-hierarchy-editor-state-fixtures"

describe("technical configuration baseline hierarchy editor state", () => {
  it("maps hierarchical drafts and normalizes legacy two-level groups", () => {
    const hierarchical = toTechnicalConfigurationBaselineEditorDraft(wireDraft())

    expect(hierarchical.groups[0]).toMatchObject({
      key: "group-1",
      criteria: [{ key: "criterion-direct", id: "criterion-direct" }],
      subgroups: [
        {
          key: "subgroup-1",
          id: "subgroup-1",
          name: "Subgroup 1",
          criteria: [{ key: "criterion-subgroup", id: "criterion-subgroup" }],
        },
      ],
    })

    const legacy = toTechnicalConfigurationBaselineEditorDraft(
      wireDraft({ groups: [group({ subgroups: undefined })] })
    )
    expect(legacy.groups[0].subgroups).toEqual([])
  })

  it("creates and appends sections, subgroups, and criteria for either owner", () => {
    const empty = toTechnicalConfigurationBaselineEditorDraft(wireDraft({ groups: [] }))
    const section = createTechnicalConfigurationBaselineEditorGroup("section-new")
    const subgroupRow = createTechnicalConfigurationBaselineEditorSubgroup("subgroup-new")
    const directCriterion = createTechnicalConfigurationBaselineEditorCriterion("direct-new")
    const subgroupCriterion =
      createTechnicalConfigurationBaselineEditorCriterion("subgroup-criterion-new")

    const withSection = appendTechnicalConfigurationBaselineEditorGroup(empty, section)
    const withSubgroup = appendTechnicalConfigurationBaselineEditorSubgroup(
      withSection,
      section.key,
      subgroupRow
    )
    const withDirectCriterion = appendTechnicalConfigurationBaselineEditorCriterionToOwner(
      withSubgroup,
      { groupKey: section.key, subgroupKey: null },
      directCriterion
    )
    const complete = appendTechnicalConfigurationBaselineEditorCriterionToOwner(
      withDirectCriterion,
      { groupKey: section.key, subgroupKey: subgroupRow.key },
      subgroupCriterion
    )

    expect(complete.groups[0]).toEqual({
      key: "section-new",
      id: null,
      name: "",
      criteria: [directCriterion],
      subgroups: [
        {
          key: "subgroup-new",
          id: null,
          name: "",
          criteria: [subgroupCriterion],
        },
      ],
    })
    expect(empty.groups).toEqual([])
  })

  it("reorders sections and complete subgroup blocks without mutating prior state", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(
      wireDraft({
        groups: [
          group({
            subgroups: [
              subgroup(),
              subgroup({
                id: "subgroup-2",
                name: "Subgroup 2",
                criteria: [
                  criterion({
                    id: "criterion-subgroup-2",
                    subgroup_id: "subgroup-2",
                    criterion_code: "TC-0003",
                  }),
                ],
              }),
            ],
          }),
          group({ id: "group-2", name: "Section 2", criteria: [], subgroups: [] }),
        ],
      })
    )

    const reorderedSubgroups = moveTechnicalConfigurationBaselineEditorSubgroup(
      editorDraft,
      "group-1",
      1,
      -1
    )
    const reorderedSections = moveTechnicalConfigurationBaselineEditorGroup(
      reorderedSubgroups,
      1,
      -1
    )

    expect(reorderedSubgroups.groups[0].subgroups.map((item) => item.id)).toEqual([
      "subgroup-2",
      "subgroup-1",
    ])
    expect(reorderedSubgroups.groups[0].subgroups[0].criteria[0].id).toBe("criterion-subgroup-2")
    expect(reorderedSections.groups.map((item) => item.id)).toEqual(["group-2", "group-1"])
    expect(editorDraft.groups.map((item) => item.id)).toEqual(["group-1", "group-2"])
  })

  it("reorders criteria within direct and subgroup owners", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(
      wireDraft({
        groups: [
          group({
            criteria: [
              criterion(),
              criterion({ id: "criterion-direct-2", criterion_code: "TC-0003" }),
            ],
            subgroups: [
              subgroup({
                criteria: [
                  criterion({
                    id: "criterion-subgroup",
                    subgroup_id: "subgroup-1",
                    criterion_code: "TC-0002",
                  }),
                  criterion({
                    id: "criterion-subgroup-2",
                    subgroup_id: "subgroup-1",
                    criterion_code: "TC-0004",
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    )

    const direct = moveTechnicalConfigurationBaselineEditorCriterionWithinOwner(
      editorDraft,
      { groupKey: "group-1", subgroupKey: null },
      1,
      -1
    )
    const nested = moveTechnicalConfigurationBaselineEditorCriterionWithinOwner(
      direct,
      { groupKey: "group-1", subgroupKey: "subgroup-1" },
      0,
      1
    )

    expect(direct.groups[0].criteria.map((item) => item.id)).toEqual([
      "criterion-direct-2",
      "criterion-direct",
    ])
    expect(nested.groups[0].subgroups[0].criteria.map((item) => item.id)).toEqual([
      "criterion-subgroup-2",
      "criterion-subgroup",
    ])
  })

  it("moves criteria between owners while preserving stable identity", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(wireDraft())
    const originalCriterion = editorDraft.groups[0].criteria[0]

    const nested = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      editorDraft,
      { groupKey: "group-1", subgroupKey: null },
      originalCriterion.key,
      { groupKey: "group-1", subgroupKey: "subgroup-1" },
      0
    )
    const directAgain = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      nested,
      { groupKey: "group-1", subgroupKey: "subgroup-1" },
      originalCriterion.key,
      { groupKey: "group-1", subgroupKey: null },
      0
    )

    expect(nested.groups[0].criteria).toEqual([])
    expect(nested.groups[0].subgroups[0].criteria[0]).toBe(originalCriterion)
    expect(directAgain.groups[0].criteria[0]).toBe(originalCriterion)
    expect(directAgain.groups[0].criteria[0]).toMatchObject({
      key: "criterion-direct",
      id: "criterion-direct",
      criterionCode: "TC-0001",
    })
  })

  it("moves criteria between subgroup owners across sections without changing identity", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(
      wireDraft({
        groups: [
          group(),
          group({
            id: "group-2",
            name: "Section 2",
            criteria: [],
            subgroups: [
              subgroup({
                id: "subgroup-2",
                group_id: "group-2",
                name: "Subgroup 2",
                criteria: [],
              }),
            ],
          }),
        ],
      })
    )
    const originalCriterion = editorDraft.groups[0].subgroups[0].criteria[0]

    const moved = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      editorDraft,
      { groupKey: "group-1", subgroupKey: "subgroup-1" },
      originalCriterion.key,
      { groupKey: "group-2", subgroupKey: "subgroup-2" },
      0
    )

    expect(moved.groups[0].subgroups[0].criteria).toEqual([])
    expect(moved.groups[1].subgroups[0].criteria[0]).toBe(originalCriterion)
    expect(moved.groups[1].subgroups[0].criteria[0]).toMatchObject({
      key: "criterion-subgroup",
      id: "criterion-subgroup",
      criterionCode: "TC-0002",
    })
  })

  it("deletes criteria, subgroups, and sections as complete immutable blocks", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(wireDraft())
    const withoutNestedCriterion = removeTechnicalConfigurationBaselineEditorCriterionFromOwner(
      editorDraft,
      { groupKey: "group-1", subgroupKey: "subgroup-1" },
      "criterion-subgroup"
    )
    const withoutSubgroup = removeTechnicalConfigurationBaselineEditorSubgroup(
      editorDraft,
      "group-1",
      "subgroup-1"
    )
    const withoutSection = removeTechnicalConfigurationBaselineEditorGroup(editorDraft, "group-1")

    expect(withoutNestedCriterion.groups[0].subgroups[0].criteria).toEqual([])
    expect(withoutSubgroup.groups[0].subgroups).toEqual([])
    expect(withoutSection.groups).toEqual([])
    expect(editorDraft.groups[0].subgroups[0].criteria).toHaveLength(1)
  })

  it("keeps the same draft for boundary moves and missing criterion deletes", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(wireDraft())

    expect(
      moveTechnicalConfigurationBaselineEditorCriterionWithinOwner(
        editorDraft,
        { groupKey: "group-1", subgroupKey: null },
        0,
        -1
      )
    ).toBe(editorDraft)
    expect(
      removeTechnicalConfigurationBaselineEditorCriterionFromOwner(
        editorDraft,
        { groupKey: "group-1", subgroupKey: "subgroup-1" },
        "missing-criterion"
      )
    ).toBe(editorDraft)
    expect(
      moveTechnicalConfigurationBaselineEditorCriterionToOwner(
        editorDraft,
        { groupKey: "group-1", subgroupKey: null },
        "criterion-direct",
        { groupKey: "group-1", subgroupKey: "missing-subgroup" }
      )
    ).toBe(editorDraft)
  })
})
