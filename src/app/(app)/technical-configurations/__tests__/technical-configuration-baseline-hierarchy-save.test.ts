import { describe, expect, it, vi } from "vitest"

import {
  BaselineEditorSaveFailure,
  createTechnicalConfigurationBaselineEditorCriterion,
  moveTechnicalConfigurationBaselineEditorCriterionToOwner,
  saveTechnicalConfigurationBaselineEditorDraft,
  toTechnicalConfigurationBaselineEditorDraft,
} from "../technical-configuration-baseline-editor"
import { TechnicalConfigurationRpcError } from "../technical-configuration-rpc"
import {
  createDraft,
  createRpc,
  criterion,
  criterionMutation,
  subgroupMutation,
} from "./technical-configuration-baseline-hierarchy-save-fixtures"

describe("technical configuration baseline hierarchy save", () => {
  it("maps a created subgroup ID and resumes without recreating it after a later failure", async () => {
    const baseDraft = createDraft()
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)
    const newSubgroup = {
      key: "new-subgroup",
      id: null,
      name: "An toàn",
      criteria: [
        Object.assign(createTechnicalConfigurationBaselineEditorCriterion("new-criterion"), {
          requirementText: "Có tiếp địa an toàn",
        }),
      ],
    }
    editorDraft.groups[0].subgroups.unshift(newSubgroup)

    const rpc = createRpc()
    rpc.createSubgroup.mockResolvedValue({
      data: subgroupMutation("subgroup-4", "An toàn", 3, 5),
    })
    rpc.createHierarchyCriterion.mockRejectedValueOnce(new Error("network_down"))

    let failure: BaselineEditorSaveFailure | null = null
    try {
      await saveTechnicalConfigurationBaselineEditorDraft({ baseDraft, editorDraft, rpc })
    } catch (error) {
      failure = error as BaselineEditorSaveFailure
    }

    expect(failure).toBeInstanceOf(BaselineEditorSaveFailure)
    expect(failure?.progress.editorDraft.groups[0].subgroups[0]).toMatchObject({
      key: "new-subgroup",
      id: "subgroup-4",
      name: "An toàn",
    })

    rpc.createHierarchyCriterion.mockResolvedValue({
      data: criterionMutation("criterion-4", "TC-0004", "subgroup-4", 4, 6),
    })
    rpc.reorderSubgroups.mockImplementation(async () => ({
      data: {
        ...failure?.progress.baseDraft,
        revision: 7,
        groups: [
          {
            ...failure?.progress.baseDraft.groups[0],
            subgroups: [
              {
                ...failure?.progress.baseDraft.groups[0].subgroups?.[2],
                criteria: [criterion("criterion-4", "TC-0004", "group-1", "subgroup-4", 1)],
              },
              failure?.progress.baseDraft.groups[0].subgroups?.[0],
              failure?.progress.baseDraft.groups[0].subgroups?.[1],
            ],
          },
        ],
      },
    }))

    if (!failure) throw new Error("Expected hierarchy save failure")
    const result = await saveTechnicalConfigurationBaselineEditorDraft({
      baseDraft: failure.progress.baseDraft,
      editorDraft: failure.progress.editorDraft,
      rpc,
    })

    expect(rpc.createSubgroup).toHaveBeenCalledTimes(1)
    expect(rpc.createHierarchyCriterion).toHaveBeenLastCalledWith(
      expect.objectContaining({
        p_group_id: "group-1",
        p_subgroup_id: "subgroup-4",
        p_expected_revision: 5,
      })
    )
    expect(result.editorDraft.groups[0].subgroups[0].criteria[0]).toMatchObject({
      id: "criterion-4",
      criterionCode: "TC-0004",
    })
  })

  it("does not repeat an accepted criterion move when retrying the target reorder", async () => {
    const baseDraft = createDraft()
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)
    const movedDraft = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      editorDraft,
      { groupKey: "group-1", subgroupKey: null },
      "criterion-1",
      { groupKey: "group-1", subgroupKey: "subgroup-1" },
      0
    )
    const rpc = createRpc()
    rpc.moveHierarchyCriterion.mockResolvedValue({
      data: criterionMutation("criterion-1", "TC-0001", "subgroup-1", 4, 5),
    })
    rpc.reorderHierarchyCriteria.mockRejectedValueOnce(new Error("network_down"))

    let failure: BaselineEditorSaveFailure | null = null
    try {
      await saveTechnicalConfigurationBaselineEditorDraft({
        baseDraft,
        editorDraft: movedDraft,
        rpc,
      })
    } catch (error) {
      failure = error as BaselineEditorSaveFailure
    }

    if (!failure) throw new Error("Expected hierarchy move failure")
    rpc.reorderHierarchyCriteria.mockResolvedValue({
      data: { ...failure.progress.baseDraft, revision: 6 },
    })
    await saveTechnicalConfigurationBaselineEditorDraft({
      baseDraft: failure.progress.baseDraft,
      editorDraft: failure.progress.editorDraft,
      rpc,
    })

    expect(rpc.moveHierarchyCriterion).toHaveBeenCalledTimes(1)
    expect(rpc.reorderHierarchyCriteria).toHaveBeenLastCalledWith({
      p_group_id: "group-1",
      p_subgroup_id: "subgroup-1",
      p_criterion_ids: ["criterion-1", "criterion-2"],
      p_expected_revision: 5,
    })
  })

  it("uses the hierarchy move path for direct owner changes without subgroups", async () => {
    const baseDraft = createDraft()
    baseDraft.groups[0].subgroups = []
    baseDraft.groups.push({
      ...baseDraft.groups[0],
      id: "group-2",
      name: "Yêu cầu bổ sung",
      sort_order: 2,
      criteria: [],
      subgroups: [],
    })
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)
    const movedDraft = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      editorDraft,
      { groupKey: "group-1", subgroupKey: null },
      "criterion-1",
      { groupKey: "group-2", subgroupKey: null }
    )
    const rpc = createRpc()
    rpc.moveHierarchyCriterion.mockResolvedValue({
      data: criterionMutation("criterion-1", "TC-0001", null, 1, 5, "group-2"),
    })

    const result = await saveTechnicalConfigurationBaselineEditorDraft({
      baseDraft,
      editorDraft: movedDraft,
      rpc,
    })

    expect(rpc.moveHierarchyCriterion).toHaveBeenCalledWith({
      p_criterion_id: "criterion-1",
      p_target_group_id: "group-2",
      p_target_subgroup_id: null,
      p_expected_revision: 4,
    })
    expect(rpc.deleteCriterion).not.toHaveBeenCalled()
    expect(rpc.createCriterion).not.toHaveBeenCalled()
    expect(result.editorDraft.groups[1].criteria[0]).toMatchObject({
      id: "criterion-1",
      criterionCode: "TC-0001",
    })
  })

  it("deletes removed descendants before subgroup and exact-set reorder calls", async () => {
    const baseDraft = createDraft()
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)
    editorDraft.groups[0].subgroups = [editorDraft.groups[0].subgroups[0]]
    const rpc = createRpc()
    rpc.deleteCriterion.mockResolvedValue({ data: { id: "criterion-3", revision: 5 } })
    rpc.deleteSubgroup.mockResolvedValue({ data: { id: "subgroup-2", revision: 6 } })

    await saveTechnicalConfigurationBaselineEditorDraft({ baseDraft, editorDraft, rpc })

    expect(rpc.deleteCriterion).toHaveBeenCalledWith({
      p_criterion_id: "criterion-3",
      p_expected_revision: 4,
    })
    expect(rpc.deleteSubgroup).toHaveBeenCalledWith({
      p_subgroup_id: "subgroup-2",
      p_expected_revision: 5,
    })
    expect(rpc.deleteCriterion.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.deleteSubgroup.mock.invocationCallOrder[0]
    )
  })

  it("classifies a stale hierarchy mutation as a conflict without losing the local move", async () => {
    const baseDraft = createDraft()
    const editorDraft = moveTechnicalConfigurationBaselineEditorCriterionToOwner(
      toTechnicalConfigurationBaselineEditorDraft(baseDraft),
      { groupKey: "group-1", subgroupKey: null },
      "criterion-1",
      { groupKey: "group-1", subgroupKey: "subgroup-1" }
    )
    const rpc = createRpc()
    rpc.moveHierarchyCriterion.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )

    let failure: BaselineEditorSaveFailure | null = null
    try {
      await saveTechnicalConfigurationBaselineEditorDraft({ baseDraft, editorDraft, rpc })
    } catch (error) {
      failure = error as BaselineEditorSaveFailure
    }

    expect(failure).toBeInstanceOf(BaselineEditorSaveFailure)
    expect(failure?.isConflict).toBe(true)
    expect(failure?.progress.editorDraft.groups[0].criteria).toEqual([])
    expect(
      failure?.progress.editorDraft.groups[0].subgroups
        .find((subgroup) => subgroup.id === "subgroup-1")
        ?.criteria.map((item) => [item.id, item.criterionCode])
    ).toEqual([
      ["criterion-2", "TC-0002"],
      ["criterion-1", "TC-0001"],
    ])
  })
})
