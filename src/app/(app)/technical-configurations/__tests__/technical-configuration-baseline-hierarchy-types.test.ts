import { describe, expect, expectTypeOf, it } from "vitest"

import {
  decodeTechnicalConfigurationBaselineDraftWireResponse,
  decodeTechnicalConfigurationBaselineVersionsListWireResponse,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-decoders"
import type { TechnicalConfigurationBaselineGeneratedTables } from "@/app/(app)/technical-configurations/technical-configuration-baseline-database.generated"
import { toTechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { toTechnicalConfigurationBaselineVersionPages } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"

const timestamp = "2026-08-07T00:00:00.000Z"

function criterion(overrides: Record<string, unknown> = {}) {
  return {
    id: "criterion-direct",
    baseline_version_id: "version-1",
    group_id: "group-1",
    criterion_code: "TC-001",
    title: null,
    requirement_text: "Direct criterion",
    sort_order: 1,
    source_criterion_id: null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    ...overrides,
  }
}

function group(overrides: Record<string, unknown> = {}) {
  return {
    id: "group-1",
    baseline_version_id: "version-1",
    name: "Main section",
    sort_order: 1,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    criteria: [criterion()],
    ...overrides,
  }
}

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-1",
    dossier_id: "dossier-1",
    version_number: 1,
    status: "draft",
    source_baseline_version_id: null,
    source_version_number: null,
    next_criterion_number: 3,
    revision: 4,
    locked_at: null,
    locked_by: null,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    groups: [group()],
    ...overrides,
  }
}

function subgroup(overrides: Record<string, unknown> = {}) {
  return {
    id: "subgroup-1",
    baseline_version_id: "version-1",
    group_id: "group-1",
    name: "Subgroup",
    sort_order: 1,
    created_at: timestamp,
    created_by: 1,
    updated_at: timestamp,
    updated_by: 1,
    criteria: [
      criterion({
        id: "criterion-subgroup",
        criterion_code: "TC-002",
        requirement_text: "Subgroup criterion",
        sort_order: 2,
        subgroup_id: "subgroup-1",
      }),
    ],
    ...overrides,
  }
}

describe("technical configuration baseline hierarchy decoders", () => {
  it("represents the live P1A subgroup schema in focused generated types", () => {
    type CriterionRow =
      TechnicalConfigurationBaselineGeneratedTables["technical_configuration_baseline_criteria"]["Row"]
    type SubgroupRow =
      TechnicalConfigurationBaselineGeneratedTables["technical_configuration_baseline_subgroups"]["Row"]
    type SubgroupInsert =
      TechnicalConfigurationBaselineGeneratedTables["technical_configuration_baseline_subgroups"]["Insert"]

    expectTypeOf<CriterionRow["subgroup_id"]>().toEqualTypeOf<string | null>()
    expectTypeOf<SubgroupRow["group_id"]>().toEqualTypeOf<string>()
    expectTypeOf<SubgroupInsert["id"]>().toEqualTypeOf<string | undefined>()
  })

  it("normalizes legacy two-level responses without requiring subgroup fields", () => {
    const response = decodeTechnicalConfigurationBaselineDraftWireResponse({
      data: draft(),
    })

    expect(response.data.groups[0].subgroups).toEqual([])
    expect(response.data.groups[0].criteria[0].subgroup_id).toBeNull()
    expect(toTechnicalConfigurationBaselineEditorDraft(response.data).groups[0].criteria).toEqual([
      expect.objectContaining({
        id: "criterion-direct",
        requirementText: "Direct criterion",
      }),
    ])
  })

  it("preserves direct criteria and future subgroup arrays in normalized cache responses", () => {
    const futureDraft = draft({
      groups: [
        group({
          criteria: [criterion({ subgroup_id: null })],
          subgroups: [subgroup()],
        }),
      ],
    })

    const response = decodeTechnicalConfigurationBaselineVersionsListWireResponse({
      data: [futureDraft],
      total: 1,
      page: 1,
      page_size: 100,
    })

    expect(response.data[0].groups[0].criteria[0].subgroup_id).toBeNull()
    expect(response.data[0].groups[0].subgroups[0]).toMatchObject({
      id: "subgroup-1",
      group_id: "group-1",
      baseline_version_id: "version-1",
    })
    expect(response.data[0].groups[0].subgroups[0].criteria[0]).toMatchObject({
      id: "criterion-subgroup",
      subgroup_id: "subgroup-1",
      group_id: "group-1",
      baseline_version_id: "version-1",
    })

    const cached = toTechnicalConfigurationBaselineVersionPages(response)
    expect(cached.pages[0].data[0].groups[0].subgroups).toHaveLength(1)

    const editorDraft = toTechnicalConfigurationBaselineEditorDraft(response.data[0])
    expect(editorDraft.groups[0].criteria).toHaveLength(1)
    expect(editorDraft.groups[0].criteria[0].id).toBe("criterion-direct")
  })

  it("rejects a direct criterion that claims subgroup ownership", () => {
    expect(() =>
      decodeTechnicalConfigurationBaselineDraftWireResponse({
        data: draft({
          groups: [
            group({
              criteria: [criterion({ subgroup_id: "subgroup-1" })],
              subgroups: [subgroup()],
            }),
          ],
        }),
      })
    ).toThrow("invalid_response")
  })

  it.each([
    {
      name: "subgroup belongs to another group",
      invalidSubgroup: subgroup({ group_id: "group-2" }),
    },
    {
      name: "subgroup belongs to another baseline version",
      invalidSubgroup: subgroup({ baseline_version_id: "version-2" }),
    },
    {
      name: "criterion points at another subgroup",
      invalidSubgroup: subgroup({
        criteria: [
          criterion({
            subgroup_id: "subgroup-2",
            id: "criterion-subgroup",
          }),
        ],
      }),
    },
    {
      name: "criterion belongs to another group",
      invalidSubgroup: subgroup({
        criteria: [
          criterion({
            subgroup_id: "subgroup-1",
            group_id: "group-2",
            id: "criterion-subgroup",
          }),
        ],
      }),
    },
  ])("rejects invalid cross-scope ownership: $name", ({ invalidSubgroup }) => {
    expect(() =>
      decodeTechnicalConfigurationBaselineDraftWireResponse({
        data: draft({
          groups: [
            group({
              subgroups: [invalidSubgroup],
            }),
          ],
        }),
      })
    ).toThrow("invalid_response")
  })
})
