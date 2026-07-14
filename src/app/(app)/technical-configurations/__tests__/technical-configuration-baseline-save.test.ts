import { describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationBaselineCriterionMutationWire,
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineGroupMutationWire,
} from "../baseline-types"
import {
  BaselineEditorSaveFailure,
  createTechnicalConfigurationBaselineEditorCriterion,
  saveTechnicalConfigurationBaselineEditorDraft,
  toTechnicalConfigurationBaselineEditorDraft,
} from "../technical-configuration-baseline-editor"
import { TechnicalConfigurationRpcError } from "../technical-configuration-rpc"

const timestamp = "2026-07-13T00:00:00.000Z"

function createDraft(): TechnicalConfigurationBaselineDraftWire {
  return {
    id: "draft-1",
    dossier_id: "dossier-1",
    version_number: 1,
    status: "draft",
    next_criterion_number: 2,
    revision: 4,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    groups: [
      {
        id: "group-1",
        baseline_version_id: "draft-1",
        name: "Yêu cầu chung",
        sort_order: 1,
        created_at: timestamp,
        created_by: 1,
        updated_at: timestamp,
        updated_by: 1,
        criteria: [
          {
            id: "criterion-1",
            baseline_version_id: "draft-1",
            group_id: "group-1",
            criterion_code: "TC-0001",
            title: null,
            requirement_text: "Nguồn điện 220V",
            sort_order: 1,
            source_criterion_id: null,
            created_at: timestamp,
            created_by: 1,
            updated_at: timestamp,
            updated_by: 1,
          },
        ],
      },
    ],
  }
}

function groupMutation(
  revision: number,
  name = "Yêu cầu kỹ thuật cập nhật"
): TechnicalConfigurationBaselineGroupMutationWire {
  return {
    id: "group-1",
    baseline_version_id: "draft-1",
    name,
    sort_order: 1,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    revision,
  }
}

function criterionMutation(
  revision: number,
  overrides: Partial<TechnicalConfigurationBaselineCriterionMutationWire> = {}
): TechnicalConfigurationBaselineCriterionMutationWire {
  return {
    id: "criterion-2",
    baseline_version_id: "draft-1",
    group_id: "group-1",
    criterion_code: "TC-0002",
    title: "Nguồn điện",
    requirement_text: "220V\n50Hz",
    sort_order: 2,
    source_criterion_id: null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    revision,
    ...overrides,
  }
}

function createRpc() {
  return {
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    reorderGroups: vi.fn(),
    createCriterion: vi.fn(),
    updateCriterion: vi.fn(),
    deleteCriterion: vi.fn(),
    reorderCriteria: vi.fn(),
  }
}

describe("technical configuration baseline save runner", () => {
  it("chains P2 revisions and maps created IDs before reordering", async () => {
    const baseDraft = createDraft()
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)
    editorDraft.groups[0].name = "Yêu cầu kỹ thuật cập nhật"
    editorDraft.groups[0].criteria.unshift(
      Object.assign(createTechnicalConfigurationBaselineEditorCriterion("new-criterion-1"), {
        title: "Nguồn điện",
        requirementText: "220V\n50Hz",
      })
    )

    const rpc = createRpc()
    rpc.updateGroup.mockResolvedValue({ data: groupMutation(5) })
    rpc.createCriterion.mockResolvedValue({ data: criterionMutation(6) })
    rpc.reorderCriteria.mockResolvedValue({
      data: {
        ...baseDraft,
        revision: 7,
        groups: [
          {
            ...baseDraft.groups[0],
            name: "Yêu cầu kỹ thuật cập nhật",
            criteria: [
              {
                ...criterionMutation(6),
                revision: undefined,
                sort_order: 1,
              },
              {
                ...baseDraft.groups[0].criteria[0],
                sort_order: 2,
              },
            ].map(({ revision: _revision, ...criterion }) => criterion),
          },
        ],
      },
    })

    const result = await saveTechnicalConfigurationBaselineEditorDraft({
      baseDraft,
      editorDraft,
      rpc,
    })

    expect(rpc.updateGroup).toHaveBeenCalledWith({
      p_group_id: "group-1",
      p_name: "Yêu cầu kỹ thuật cập nhật",
      p_expected_revision: 4,
    })
    expect(rpc.createCriterion).toHaveBeenCalledWith({
      p_group_id: "group-1",
      p_title: "Nguồn điện",
      p_requirement_text: "220V\n50Hz",
      p_expected_revision: 5,
    })
    expect(rpc.reorderCriteria).toHaveBeenCalledWith({
      p_group_id: "group-1",
      p_criterion_ids: ["criterion-2", "criterion-1"],
      p_expected_revision: 6,
    })
    expect(result.baseDraft.revision).toBe(7)
    expect(result.editorDraft.groups[0].criteria[0]).toMatchObject({
      key: "new-criterion-1",
      id: "criterion-2",
      criterionCode: "TC-0002",
      requirementText: "220V\n50Hz",
    })
  })

  it("preserves successful progress and all local values when a later save step fails", async () => {
    const baseDraft = createDraft()
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)
    editorDraft.groups[0].name = "Yêu cầu kỹ thuật cập nhật"
    editorDraft.groups[0].criteria.push(
      Object.assign(createTechnicalConfigurationBaselineEditorCriterion("new-criterion-1"), {
        title: "Môi trường",
        requirementText: "Nhiệt độ vận hành\n10-40°C",
      })
    )

    const rpc = createRpc()
    rpc.updateGroup.mockResolvedValue({ data: groupMutation(5) })
    rpc.createCriterion.mockRejectedValue(new Error("network_down"))

    let failure: BaselineEditorSaveFailure | null = null
    try {
      await saveTechnicalConfigurationBaselineEditorDraft({ baseDraft, editorDraft, rpc })
    } catch (error) {
      expect(error).toBeInstanceOf(BaselineEditorSaveFailure)
      failure = error as BaselineEditorSaveFailure
    }

    expect(failure).toMatchObject({
      isConflict: false,
      progress: {
        baseDraft: {
          revision: 5,
          groups: [{ name: "Yêu cầu kỹ thuật cập nhật" }],
        },
        editorDraft: {
          groups: [
            {
              criteria: [
                expect.any(Object),
                {
                  title: "Môi trường",
                  requirementText: "Nhiệt độ vận hành\n10-40°C",
                },
              ],
            },
          ],
        },
      },
    })

    if (!failure) throw new Error("Expected baseline save failure")
    rpc.createCriterion.mockResolvedValue({
      data: criterionMutation(6, {
        title: "Môi trường",
        requirement_text: "Nhiệt độ vận hành\n10-40°C",
      }),
    })

    const retryResult = await saveTechnicalConfigurationBaselineEditorDraft({
      baseDraft: failure.progress.baseDraft,
      editorDraft: failure.progress.editorDraft,
      rpc,
    })

    expect(rpc.updateGroup).toHaveBeenCalledTimes(1)
    expect(rpc.createCriterion).toHaveBeenLastCalledWith(
      expect.objectContaining({ p_expected_revision: 5 })
    )
    expect(retryResult.baseDraft.revision).toBe(6)
    expect(retryResult.editorDraft.groups[0].criteria[1]).toMatchObject({
      id: "criterion-2",
      title: "Môi trường",
      requirementText: "Nhiệt độ vận hành\n10-40°C",
    })
  })

  it("persists values that only differ by trailing whitespace so the server can normalize them", async () => {
    const baseDraft = createDraft()
    baseDraft.groups[0].criteria[0].title = "Nguồn điện"
    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)
    editorDraft.groups[0].name = "Yêu cầu chung "
    editorDraft.groups[0].criteria[0].title = "Nguồn điện "
    editorDraft.groups[0].criteria[0].requirementText = "Nguồn điện 220V "

    const rpc = createRpc()
    rpc.updateGroup.mockResolvedValue({ data: groupMutation(5, "Yêu cầu chung") })
    rpc.updateCriterion.mockResolvedValue({
      data: criterionMutation(6, {
        id: "criterion-1",
        criterion_code: "TC-0001",
        title: "Nguồn điện",
        requirement_text: "Nguồn điện 220V",
        sort_order: 1,
      }),
    })

    const result = await saveTechnicalConfigurationBaselineEditorDraft({
      baseDraft,
      editorDraft,
      rpc,
    })

    expect(rpc.updateGroup).toHaveBeenCalledWith(
      expect.objectContaining({ p_expected_revision: 4, p_name: "Yêu cầu chung " })
    )
    expect(rpc.updateCriterion).toHaveBeenCalledWith(
      expect.objectContaining({
        p_expected_revision: 5,
        p_title: "Nguồn điện",
        p_requirement_text: "Nguồn điện 220V ",
      })
    )
    expect(result.editorDraft.groups[0]).toMatchObject({
      name: "Yêu cầu chung",
      criteria: [{ title: "Nguồn điện", requirementText: "Nguồn điện 220V" }],
    })
  })

  it.each(["stale_revision", "locked_version"])(
    "marks %s as conflict without discarding edited content",
    async (message) => {
      const baseDraft = createDraft()
      const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)
      editorDraft.groups[0].name = "Tên chưa lưu"

      const rpc = createRpc()
      rpc.updateGroup.mockRejectedValue(
        Object.assign(new Error(message), {
          status: 409,
          code: "PT409",
        })
      )

      await expect(
        saveTechnicalConfigurationBaselineEditorDraft({ baseDraft, editorDraft, rpc })
      ).rejects.toMatchObject({
        isConflict: true,
        progress: {
          editorDraft: {
            groups: [{ name: "Tên chưa lưu" }],
          },
        },
      })
    }
  )

  it.each(["stale_revision", "locked_version"])(
    "does not classify non-409 %s failures as conflicts",
    async (message) => {
      const baseDraft = createDraft()
      const editorDraft = toTechnicalConfigurationBaselineEditorDraft(baseDraft)
      editorDraft.groups[0].name = "Tên chưa lưu"

      const rpc = createRpc()
      rpc.updateGroup.mockRejectedValue(new TechnicalConfigurationRpcError(500, { message }))

      await expect(
        saveTechnicalConfigurationBaselineEditorDraft({ baseDraft, editorDraft, rpc })
      ).rejects.toMatchObject({
        isConflict: false,
        progress: {
          editorDraft: {
            groups: [{ name: "Tên chưa lưu" }],
          },
        },
      })
    }
  )
})
