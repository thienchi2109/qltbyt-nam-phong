import { describe, expect, it, vi } from "vitest"

import { callRpc } from "@/lib/rpc-client"

import {
  BASELINE_RPC_FUNCTIONS,
  technicalConfigurationBaselineRpc,
} from "../_hooks/useTechnicalConfigurationBaseline"

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

describe("technical configuration baseline RPC contract", () => {
  it("freezes the eleven P2 RPC names", () => {
    expect(BASELINE_RPC_FUNCTIONS).toEqual([
      "technical_configuration_baseline_draft_create",
      "technical_configuration_baseline_draft_get",
      "technical_configuration_baseline_group_create",
      "technical_configuration_baseline_group_update",
      "technical_configuration_baseline_group_delete",
      "technical_configuration_baseline_groups_reorder",
      "technical_configuration_baseline_criterion_create",
      "technical_configuration_baseline_criterion_update",
      "technical_configuration_baseline_criterion_delete",
      "technical_configuration_baseline_criteria_reorder",
      "technical_configuration_baseline_bulk_preview",
    ])
  })

  it("passes snake_case draft and descendant revision arguments to callRpc", async () => {
    vi.mocked(callRpc).mockResolvedValue({ data: { id: "draft-1" } })

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

    expect(callRpc).toHaveBeenNthCalledWith(1, {
      fn: "technical_configuration_baseline_draft_create",
      args: {
        p_dossier_id: "dossier-1",
        p_expected_revision: 3,
      },
    })
    expect(callRpc).toHaveBeenNthCalledWith(2, {
      fn: "technical_configuration_baseline_criterion_create",
      args: {
        p_group_id: "group-1",
        p_title: null,
        p_requirement_text: "Dòng 1\nDòng 2",
        p_expected_revision: 4,
      },
    })
  })

  it("keeps bulk preview non-persisting at the client contract", async () => {
    vi.mocked(callRpc).mockResolvedValue({ data: [], errors: [] })

    await technicalConfigurationBaselineRpc.previewBulk({
      p_group_id: "group-1",
      p_items: [{ title: "Nguồn điện", requirement_text: "220V" }],
      p_expected_revision: 5,
    })

    expect(callRpc).toHaveBeenCalledWith({
      fn: "technical_configuration_baseline_bulk_preview",
      args: {
        p_group_id: "group-1",
        p_items: [{ title: "Nguồn điện", requirement_text: "220V" }],
        p_expected_revision: 5,
      },
    })
  })
})
