import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"

import { technicalConfigurationBaselineRpc } from "../_hooks/useTechnicalConfigurationBaseline"
import { callTechnicalConfigurationRpc } from "../technical-configuration-rpc"

const baselineTypesSource = readFileSync(
  resolve(process.cwd(), "src/app/(app)/technical-configurations/baseline-types.ts"),
  "utf8"
)

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: vi.fn(),
}))

const legacyDraft = {
  id: "draft-1",
  dossier_id: "dossier-1",
  version_number: 1,
  status: "draft",
  source_baseline_version_id: null,
  source_version_number: null,
  next_criterion_number: 1,
  revision: 4,
  locked_at: null,
  locked_by: null,
  created_at: "2026-08-07T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-08-07T00:00:00.000Z",
  updated_by: 1,
  groups: [],
} as const

describe("technical configuration baseline RPC contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("freezes the P2, P4, and P5C baseline RPC mappings", () => {
    expect(BASELINE_RPC_FUNCTIONS).toEqual({
      createDraft: "technical_configuration_baseline_draft_create",
      getDraft: "technical_configuration_baseline_draft_get",
      listVersions: "technical_configuration_baseline_versions_list",
      lockVersion: "technical_configuration_baseline_lock",
      copyVersion: "technical_configuration_baseline_copy",
      listCrossDossierSources: "technical_configuration_baseline_cross_dossier_sources_list",
      previewCrossDossierCopy: "technical_configuration_baseline_cross_dossier_copy_preview",
      applyCrossDossierCopy: "technical_configuration_baseline_cross_dossier_copy_apply",
      createGroup: "technical_configuration_baseline_group_create",
      updateGroup: "technical_configuration_baseline_group_update",
      deleteGroup: "technical_configuration_baseline_group_delete",
      reorderGroups: "technical_configuration_baseline_groups_reorder",
      createCriterion: "technical_configuration_baseline_criterion_create",
      updateCriterion: "technical_configuration_baseline_criterion_update",
      deleteCriterion: "technical_configuration_baseline_criterion_delete",
      reorderCriteria: "technical_configuration_baseline_criteria_reorder",
      previewBulk: "technical_configuration_baseline_bulk_preview",
      previewImport: "technical_configuration_baseline_import_preview",
      previewHierarchyImport: "technical_configuration_baseline_import_preview_v2",
      applyImport: "technical_configuration_baseline_import_apply",
      applyHierarchyImport: "technical_configuration_baseline_import_apply_v2",
    })
  })

  it("keeps group mutation responses scalar-only", () => {
    expect(baselineTypesSource).toMatch(
      /TechnicalConfigurationBaselineGroupMutationWire extends Omit<\s*TechnicalConfigurationBaselineGroupWire,\s*"criteria" \| "subgroups"\s*>/
    )
  })

  it("passes snake_case arguments through the module-local typed adapter", async () => {
    vi.mocked(callTechnicalConfigurationRpc)
      .mockResolvedValueOnce({
        data: { ...legacyDraft, dossier_revision: 4 },
      })
      .mockResolvedValueOnce({ data: { id: "criterion-1" } })
      .mockResolvedValueOnce({
        data: [legacyDraft],
        total: 1,
        page: 2,
        page_size: 25,
      })
      .mockResolvedValueOnce({ data: legacyDraft })
      .mockResolvedValueOnce({
        data: { ...legacyDraft, dossier_revision: 6 },
      })

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
    await technicalConfigurationBaselineRpc.listVersions({
      p_dossier_id: "dossier-1",
      p_page: 2,
      p_page_size: 25,
    })
    await technicalConfigurationBaselineRpc.lockVersion({
      p_baseline_version_id: "draft-1",
      p_expected_revision: 5,
    })
    await technicalConfigurationBaselineRpc.copyVersion({
      p_source_baseline_version_id: "draft-1",
      p_expected_revision: 6,
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
    expect(callTechnicalConfigurationRpc).toHaveBeenNthCalledWith(
      3,
      "technical_configuration_baseline_versions_list",
      {
        p_dossier_id: "dossier-1",
        p_page: 2,
        p_page_size: 25,
      }
    )
    expect(callTechnicalConfigurationRpc).toHaveBeenNthCalledWith(
      4,
      "technical_configuration_baseline_lock",
      {
        p_baseline_version_id: "draft-1",
        p_expected_revision: 5,
      }
    )
    expect(callTechnicalConfigurationRpc).toHaveBeenNthCalledWith(
      5,
      "technical_configuration_baseline_copy",
      {
        p_source_baseline_version_id: "draft-1",
        p_expected_revision: 6,
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

  it("passes the same canonical import contract to preview and apply", async () => {
    vi.mocked(callTechnicalConfigurationRpc)
      .mockResolvedValueOnce({ data: {}, errors: [] })
      .mockResolvedValueOnce({ data: legacyDraft })
    const args = {
      p_baseline_version_id: "draft-1",
      p_template_metadata: {
        template_kind: "technical_configuration_baseline" as const,
        template_version: 1 as const,
        dossier_id: "dossier-1",
        baseline_version_id: "draft-1",
        baseline_revision: 7,
        generated_at: "2026-07-14T00:00:00.000Z",
      },
      p_rows: [
        {
          row_type: "GROUP" as const,
          group_order: 1,
          group_name: "Yêu cầu chung",
          criterion_order: null,
          criterion_code: null,
          criterion_title: null,
          requirement_text: null,
        },
      ],
      p_expected_revision: 7,
    }

    await technicalConfigurationBaselineRpc.previewImport(args)
    await technicalConfigurationBaselineRpc.applyImport(args)

    expect(callTechnicalConfigurationRpc).toHaveBeenNthCalledWith(
      1,
      "technical_configuration_baseline_import_preview",
      args
    )
    expect(callTechnicalConfigurationRpc).toHaveBeenNthCalledWith(
      2,
      "technical_configuration_baseline_import_apply",
      args
    )
  })
})
