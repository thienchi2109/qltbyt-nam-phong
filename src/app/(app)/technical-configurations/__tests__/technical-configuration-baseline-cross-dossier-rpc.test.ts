import { beforeEach, describe, expect, it, vi } from "vitest"

import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"
import {
  applyTechnicalConfigurationBaselineCrossDossierCopy,
  listTechnicalConfigurationBaselineCrossDossierSources,
  previewTechnicalConfigurationBaselineCrossDossierCopy,
} from "../technical-configuration-baseline-cross-dossier-rpc"

const callRpcMock = vi.hoisted(() => vi.fn())

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => callRpcMock(...args),
}))

describe("technical configuration cross-dossier baseline RPC client", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
    callRpcMock.mockResolvedValue({ data: [] })
  })

  it("calls the bounded source-list RPC with the frozen paging contract", async () => {
    const signal = new AbortController().signal
    await listTechnicalConfigurationBaselineCrossDossierSources(
      {
        p_target_dossier_id: "target-1",
        p_search: "máy thở",
        p_page: 2,
        p_page_size: 20,
      },
      signal
    )

    expect(callRpcMock).toHaveBeenCalledWith(
      BASELINE_RPC_FUNCTIONS.listCrossDossierSources,
      {
        p_target_dossier_id: "target-1",
        p_search: "máy thở",
        p_page: 2,
        p_page_size: 20,
      },
      { signal }
    )
  })

  it("preserves the paired-null target draft contract during preview", async () => {
    await previewTechnicalConfigurationBaselineCrossDossierCopy({
      p_source_baseline_version_id: "source-1",
      p_target_dossier_id: "target-1",
      p_expected_dossier_revision: 7,
      p_expected_target_baseline_version_id: null,
      p_expected_target_baseline_revision: null,
    })

    expect(callRpcMock).toHaveBeenCalledWith(
      BASELINE_RPC_FUNCTIONS.previewCrossDossierCopy,
      expect.objectContaining({
        p_expected_target_baseline_version_id: null,
        p_expected_target_baseline_revision: null,
      })
    )
  })

  it("carries the exact preview fingerprint and replacement confirmation into apply", async () => {
    await applyTechnicalConfigurationBaselineCrossDossierCopy({
      p_source_baseline_version_id: "source-1",
      p_target_dossier_id: "target-1",
      p_expected_dossier_revision: 7,
      p_expected_target_baseline_version_id: "draft-1",
      p_expected_target_baseline_revision: 4,
      p_preview_fingerprint: "a".repeat(64),
      p_confirm_replace: true,
    })

    expect(callRpcMock).toHaveBeenCalledWith(
      BASELINE_RPC_FUNCTIONS.applyCrossDossierCopy,
      expect.objectContaining({
        p_preview_fingerprint: "a".repeat(64),
        p_confirm_replace: true,
      })
    )
  })
})
