import { describe, expect, it } from "vitest"

import {
  cloneTechnicalConfigurationBaselineDraft,
  cloneTechnicalConfigurationBaselineEditorDraft,
  isTechnicalConfigurationBaselineEditorDirty,
  moveTechnicalConfigurationBaselineEditorCriterionWithinOwner,
  moveTechnicalConfigurationBaselineEditorCriterionToOwner,
  moveTechnicalConfigurationBaselineEditorGroup,
  moveTechnicalConfigurationBaselineEditorSubgroup,
  toTechnicalConfigurationBaselineEditorDraft,
  toTechnicalConfigurationBaselineEditorSaveRows,
  validateTechnicalConfigurationBaselineEditorDraft,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

import {
  criterion,
  group,
  subgroup,
  wireDraft,
} from "./technical-configuration-baseline-hierarchy-editor-state-fixtures"

describe("technical configuration baseline hierarchy editor snapshot", () => {
  it("validates section, subgroup, and criterion required text", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(wireDraft())
    editorDraft.groups[0].name = " "
    editorDraft.groups[0].criteria[0].requirementText = "\n"
    editorDraft.groups[0].subgroups[0].name = ""
    editorDraft.groups[0].subgroups[0].criteria[0].requirementText = "\t"

    expect(validateTechnicalConfigurationBaselineEditorDraft(editorDraft)).toEqual({
      groupErrors: { "group-1": "Tên nhóm là bắt buộc." },
      subgroupErrors: { "subgroup-1": "Tên nhóm con là bắt buộc." },
      criterionErrors: {
        "criterion-direct": "Nội dung yêu cầu là bắt buộc.",
        "criterion-subgroup": "Nội dung yêu cầu là bắt buộc.",
      },
    })
  })

  it("deep-clones persisted and editable subgroup trees", () => {
    const baseDraft = wireDraft()
    const baseClone = cloneTechnicalConfigurationBaselineDraft(baseDraft)
    const legacyBaseDraft = wireDraft({ groups: [group({ subgroups: undefined })] })
    const legacyBaseClone = cloneTechnicalConfigurationBaselineDraft(legacyBaseDraft)
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)
    const editorClone = cloneTechnicalConfigurationBaselineEditorDraft(editorDraft)

    expect(baseClone.groups[0].subgroups?.[0]).not.toBe(baseDraft.groups[0].subgroups?.[0])
    expect(baseClone.groups[0].subgroups?.[0].criteria[0]).not.toBe(
      baseDraft.groups[0].subgroups?.[0].criteria[0]
    )
    expect(legacyBaseClone.groups[0].subgroups).toBeUndefined()
    expect(legacyBaseClone.groups[0].criteria[0]).not.toBe(legacyBaseDraft.groups[0].criteria[0])
    expect(editorClone.groups[0]).not.toBe(editorDraft.groups[0])
    expect(editorClone.groups[0].subgroups[0]).not.toBe(editorDraft.groups[0].subgroups[0])
    expect(editorClone.groups[0].subgroups[0].criteria[0]).not.toBe(
      editorDraft.groups[0].subgroups[0].criteria[0]
    )
  })

  it("compares hierarchy content, order, and ownership for dirty state", () => {
    const baseDraft = wireDraft()
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)

    expect(isTechnicalConfigurationBaselineEditorDirty(baseDraft, editorDraft)).toBe(false)
    expect(
      isTechnicalConfigurationBaselineEditorDirty(
        wireDraft({ groups: [group({ subgroups: undefined })] }),
        toTechnicalConfigurationBaselineEditorDraft(
          wireDraft({ groups: [group({ subgroups: undefined })] })
        )
      )
    ).toBe(false)

    const renamed = cloneTechnicalConfigurationBaselineEditorDraft(editorDraft)
    renamed.groups[0].subgroups[0].name = "Changed"
    expect(isTechnicalConfigurationBaselineEditorDirty(baseDraft, renamed)).toBe(true)

    const recoded = cloneTechnicalConfigurationBaselineEditorDraft(editorDraft)
    recoded.groups[0].criteria[0].criterionCode = "TC-9999"
    expect(isTechnicalConfigurationBaselineEditorDirty(baseDraft, recoded)).toBe(true)

    const moved = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      editorDraft,
      { groupKey: "group-1", subgroupKey: null },
      "criterion-direct",
      { groupKey: "group-1", subgroupKey: "subgroup-1" },
      0
    )
    expect(isTechnicalConfigurationBaselineEditorDirty(baseDraft, moved)).toBe(true)
  })

  it("detects section, subgroup, and criterion order changes as dirty", () => {
    const baseDraft = wireDraft({
      groups: [
        group({
          criteria: [
            criterion(),
            criterion({
              id: "criterion-direct-2",
              criterion_code: "TC-0003",
              requirement_text: "Direct criterion 2",
            }),
          ],
          subgroups: [
            subgroup({
              criteria: [
                criterion({
                  id: "criterion-subgroup",
                  subgroup_id: "subgroup-1",
                  criterion_code: "TC-0002",
                  requirement_text: "Subgroup criterion",
                }),
                criterion({
                  id: "criterion-subgroup-2",
                  subgroup_id: "subgroup-1",
                  criterion_code: "TC-0004",
                  requirement_text: "Subgroup criterion 2",
                }),
              ],
            }),
            subgroup({
              id: "subgroup-2",
              name: "Subgroup 2",
              criteria: [],
            }),
          ],
        }),
        group({
          id: "group-2",
          name: "Section 2",
          criteria: [],
          subgroups: [],
        }),
      ],
    })
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)

    expect(
      isTechnicalConfigurationBaselineEditorDirty(
        baseDraft,
        moveTechnicalConfigurationBaselineEditorGroup(editorDraft, 1, -1)
      )
    ).toBe(true)
    expect(
      isTechnicalConfigurationBaselineEditorDirty(
        baseDraft,
        moveTechnicalConfigurationBaselineEditorSubgroup(editorDraft, "group-1", 1, -1)
      )
    ).toBe(true)
    expect(
      isTechnicalConfigurationBaselineEditorDirty(
        baseDraft,
        moveTechnicalConfigurationBaselineEditorCriterionWithinOwner(
          editorDraft,
          { groupKey: "group-1", subgroupKey: null },
          1,
          -1
        )
      )
    ).toBe(true)
    expect(
      isTechnicalConfigurationBaselineEditorDirty(
        baseDraft,
        moveTechnicalConfigurationBaselineEditorCriterionWithinOwner(
          editorDraft,
          { groupKey: "group-1", subgroupKey: "subgroup-1" },
          1,
          -1
        )
      )
    ).toBe(true)
  })

  it("maps canonical save rows with direct criteria before complete subgroup blocks", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(wireDraft())

    expect(toTechnicalConfigurationBaselineEditorSaveRows(editorDraft)).toEqual([
      {
        kind: "section",
        key: "group-1",
        id: "group-1",
        name: "Section 1",
        sortOrder: 1,
      },
      {
        kind: "criterion",
        key: "criterion-direct",
        id: "criterion-direct",
        criterionCode: "TC-0001",
        sectionKey: "group-1",
        subgroupKey: null,
        title: "",
        requirementText: "Direct criterion",
        sortOrder: 1,
      },
      {
        kind: "subgroup",
        key: "subgroup-1",
        id: "subgroup-1",
        sectionKey: "group-1",
        name: "Subgroup 1",
        sortOrder: 1,
      },
      {
        kind: "criterion",
        key: "criterion-subgroup",
        id: "criterion-subgroup",
        criterionCode: "TC-0002",
        sectionKey: "group-1",
        subgroupKey: "subgroup-1",
        title: "",
        requirementText: "Subgroup criterion",
        sortOrder: 1,
      },
    ])
  })
})
