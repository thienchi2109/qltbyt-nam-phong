import { describe, expect, it } from "vitest"

import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import {
  createTechnicalConfigurationBaselineEditorCriterion,
  createTechnicalConfigurationBaselineEditorGroup,
  moveTechnicalConfigurationBaselineEditorItem,
  toTechnicalConfigurationBaselineEditorDraft,
  validateTechnicalConfigurationBaselineEditorDraft,
} from "../technical-configuration-baseline-editor"

const draft: TechnicalConfigurationBaselineDraftWire = {
  id: "draft-1",
  dossier_id: "dossier-1",
  version_number: 1,
  status: "draft",
  next_criterion_number: 2,
  revision: 4,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
  groups: [
    {
      id: "group-1",
      baseline_version_id: "draft-1",
      name: "Yêu cầu chung",
      sort_order: 1,
      created_at: "2026-07-13T00:00:00.000Z",
      created_by: 1,
      updated_at: "2026-07-13T00:00:00.000Z",
      updated_by: 1,
      criteria: [
        {
          id: "criterion-1",
          baseline_version_id: "draft-1",
          group_id: "group-1",
          criterion_code: "TC-0001",
          title: null,
          requirement_text: "Dòng 1\nDòng 2",
          sort_order: 1,
          source_criterion_id: null,
          created_at: "2026-07-13T00:00:00.000Z",
          created_by: 1,
          updated_at: "2026-07-13T00:00:00.000Z",
          updated_by: 1,
        },
      ],
    },
  ],
}

describe("technical configuration baseline editor state", () => {
  it("maps the P2 wire draft into editable two-level multiline state", () => {
    expect(toTechnicalConfigurationBaselineEditorDraft(draft)).toEqual({
      id: "draft-1",
      dossierId: "dossier-1",
      status: "draft",
      revision: 4,
      groups: [
        {
          key: "group-1",
          id: "group-1",
          name: "Yêu cầu chung",
          criteria: [
            {
              key: "criterion-1",
              id: "criterion-1",
              criterionCode: "TC-0001",
              title: "",
              requirementText: "Dòng 1\nDòng 2",
            },
          ],
        },
      ],
    })
  })

  it("creates unsaved group and criterion rows without inventing content columns", () => {
    expect(createTechnicalConfigurationBaselineEditorGroup("new-group-1")).toEqual({
      key: "new-group-1",
      id: null,
      name: "",
      criteria: [],
    })
    expect(createTechnicalConfigurationBaselineEditorCriterion("new-criterion-1")).toEqual({
      key: "new-criterion-1",
      id: null,
      criterionCode: null,
      title: "",
      requirementText: "",
    })
  })

  it("moves rows by one stable position and preserves boundary order", () => {
    const rows = ["first", "second", "third"]

    expect(moveTechnicalConfigurationBaselineEditorItem(rows, 1, -1)).toEqual([
      "second",
      "first",
      "third",
    ])
    expect(moveTechnicalConfigurationBaselineEditorItem(rows, 1, 1)).toEqual([
      "first",
      "third",
      "second",
    ])
    expect(moveTechnicalConfigurationBaselineEditorItem(rows, 0, -1)).toBe(rows)
    expect(moveTechnicalConfigurationBaselineEditorItem(rows, 2, 1)).toBe(rows)
  })

  it("reports blank group names and requirement text before persistence", () => {
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(draft)
    editorDraft.groups[0].name = " "
    editorDraft.groups[0].criteria[0].requirementText = "\n "

    expect(validateTechnicalConfigurationBaselineEditorDraft(editorDraft)).toEqual({
      groupErrors: {
        "group-1": "Tên nhóm là bắt buộc.",
      },
      criterionErrors: {
        "criterion-1": "Nội dung yêu cầu là bắt buộc.",
      },
    })
  })
})
