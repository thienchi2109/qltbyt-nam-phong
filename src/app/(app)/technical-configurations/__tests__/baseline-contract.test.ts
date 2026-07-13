import { beforeEach, describe, expect, it, vi } from "vitest"

import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"

import { technicalConfigurationBaselineRpc } from "../_hooks/useTechnicalConfigurationBaseline"
import { callTechnicalConfigurationRpc } from "../technical-configuration-rpc"

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: vi.fn(),
}))

describe("technical configuration baseline RPC contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("freezes the eleven named P2 RPC mappings", () => {
    expect(BASELINE_RPC_FUNCTIONS).toEqual({
      createDraft: "technical_configuration_baseline_draft_create",
      getDraft: "technical_configuration_baseline_draft_get",
      createGroup: "technical_configuration_baseline_group_create",
      updateGroup: "technical_configuration_baseline_group_update",
      deleteGroup: "technical_configuration_baseline_group_delete",
      reorderGroups: "technical_configuration_baseline_groups_reorder",
      createCriterion: "technical_configuration_baseline_criterion_create",
      updateCriterion: "technical_configuration_baseline_criterion_update",
      deleteCriterion: "technical_configuration_baseline_criterion_delete",
      reorderCriteria: "technical_configuration_baseline_criteria_reorder",
      previewBulk: "technical_configuration_baseline_bulk_preview",
    })
  })

  it("passes snake_case arguments through the module-local typed adapter", async () => {
    vi.mocked(callTechnicalConfigurationRpc).mockResolvedValue({ data: { id: "draft-1" } })

    await technicalConfigurationBaselineRpc.createDraft({
      p_dossier_id: "dossier-1",
      p_expected_revision: 3,
    })
    await technicalConfigurationBaselineRpc.createCriterion({
      p_group_id: "group-1",
      p_title: null,
      p_requirement_text: "Dòng 1\nDòng 2",
      p_expected_revision: 4,
    })

    expect(callTechnicalConfigurationRpc).toHaveBeenNthCalledWith(
      1,
      "technical_configuration_baseline_draft_create",
      {
        p_dossier_id: "dossier-1",
        p_expected_revision: 3,
      }
    )
    expect(callTechnicalConfigurationRpc).toHaveBeenNthCalledWith(
      2,
      "technical_configuration_baseline_criterion_create",
      {
        p_group_id: "group-1",
        p_title: null,
        p_requirement_text: "Dòng 1\nDòng 2",
        p_expected_revision: 4,
      }
    )
  })

  it("keeps bulk preview non-persisting at the client contract", async () => {
    vi.mocked(callTechnicalConfigurationRpc).mockResolvedValue({ data: [], errors: [] })

    await technicalConfigurationBaselineRpc.previewBulk({
      p_group_id: "group-1",
      p_items: [{ title: "Nguồn điện", requirement_text: "220V" }],
      p_expected_revision: 5,
    })

    expect(callTechnicalConfigurationRpc).toHaveBeenCalledWith(
      "technical_configuration_baseline_bulk_preview",
      {
        p_group_id: "group-1",
        p_items: [{ title: "Nguồn điện", requirement_text: "220V" }],
        p_expected_revision: 5,
      }
    )
  })
})
