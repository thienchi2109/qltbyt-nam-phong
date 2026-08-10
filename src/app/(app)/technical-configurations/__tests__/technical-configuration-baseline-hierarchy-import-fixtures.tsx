import { vi } from "vitest"

import { TechnicalConfigurationBaselineHierarchyImportDialog } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineHierarchyImportDialog"
import { useTechnicalConfigurationBaselineHierarchyImport } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineHierarchyImport"
import type { TechnicalConfigurationBaselineDecodedDraft } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse } from "@/app/(app)/technical-configurations/technical-configuration-baseline-hierarchy-import-types"
import type {
  TechnicalConfigurationBaselineWorkbookLegacyParseResult,
  TechnicalConfigurationBaselineWorkbookV2ParseResult,
} from "@/lib/technical-configuration-baseline-excel-v2-parse"

const timestamp = "2026-08-10T00:00:00.000Z"

export function createHierarchyDraft(
  overrides: Partial<TechnicalConfigurationBaselineDecodedDraft> = {}
): TechnicalConfigurationBaselineDecodedDraft {
  return {
    id: "draft-1",
    dossier_id: "dossier-1",
    version_number: 7,
    status: "draft",
    source_baseline_version_id: null,
    source_version_number: null,
    next_criterion_number: 3,
    revision: 11,
    locked_at: null,
    locked_by: null,
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
            subgroup_id: null,
            criterion_code: "TC-0001",
            title: "Nguồn điện",
            requirement_text: "Nguồn điện dự phòng",
            sort_order: 1,
            source_criterion_id: null,
            created_at: timestamp,
            created_by: 1,
            updated_at: timestamp,
            updated_by: 1,
          },
        ],
        subgroups: [
          {
            id: "subgroup-1",
            baseline_version_id: "draft-1",
            group_id: "group-1",
            name: "Điều kiện vận hành",
            sort_order: 1,
            created_at: timestamp,
            created_by: 1,
            updated_at: timestamp,
            updated_by: 1,
            criteria: [
              {
                id: "criterion-2",
                baseline_version_id: "draft-1",
                group_id: "group-1",
                subgroup_id: "subgroup-1",
                criterion_code: "TC-0002",
                title: "Nhiệt độ",
                requirement_text: "Hoạt động ổn định ở 18-30°C",
                sort_order: 2,
                source_criterion_id: null,
                created_at: timestamp,
                created_by: 1,
                updated_at: timestamp,
                updated_by: 1,
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  }
}

export function createV2ParseResult(): TechnicalConfigurationBaselineWorkbookV2ParseResult {
  return {
    format: "v2",
    metadata: {
      template_kind: "technical_configuration_baseline",
      template_version: 2,
      dossier_id: "dossier-1",
      baseline_version_id: "draft-1",
      baseline_revision: 11,
      generated_at: timestamp,
    },
    rows: [
      {
        row: 2,
        row_type: "GROUP",
        group_order: 1,
        group_id: "group-1",
        group_name: "Yêu cầu chung",
      },
      {
        row: 3,
        row_type: "SUBGROUP",
        group_order: 1,
        subgroup_order: 1,
        subgroup_id: "subgroup-1",
        subgroup_name: "Điều kiện vận hành",
      },
      {
        row: 4,
        row_type: "CRITERION",
        group_order: 1,
        subgroup_order: 1,
        criterion_order: 1,
        criterion_id: "criterion-2",
        criterion_code: "TC-0002",
        criterion_title: "Nhiệt độ",
        requirement_text: "Hoạt động ổn định ở 18-30°C",
      },
    ],
  }
}

export function createLegacyParseResult(): TechnicalConfigurationBaselineWorkbookLegacyParseResult {
  return {
    format: "legacy",
    row_numbers: [2, 4],
    metadata: {
      template_kind: "technical_configuration_baseline",
      template_version: 1,
      dossier_id: "dossier-1",
      baseline_version_id: "draft-1",
      baseline_revision: 11,
      generated_at: timestamp,
    },
    rows: [
      {
        row_type: "GROUP",
        group_order: 1,
        group_name: "Yêu cầu chung",
        criterion_order: null,
        criterion_code: null,
        criterion_title: null,
        requirement_text: null,
      },
      {
        row_type: "CRITERION",
        group_order: 1,
        group_name: null,
        criterion_order: 1,
        criterion_code: "TC-0002",
        criterion_title: "Nhiệt độ",
        requirement_text: "Chuyển thành tiêu chí trực tiếp",
      },
    ],
  }
}

export function createHierarchyPreview(
  overrides: Partial<TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse> = {}
): TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse {
  return {
    data: {
      metadata: createV2ParseResult().metadata,
      rows: [],
      counts: { groups: 1, subgroups: 1, criteria: 1 },
      effects: {
        groups: { create: 0, update: 0, move: 0, delete: 0 },
        subgroups: { create: 0, update: 0, move: 0, delete: 0 },
        criteria: { create: 0, update: 0, move: 0, delete: 1 },
      },
    },
    errors: [],
    ...overrides,
  }
}

export function createAuthoritativeHierarchyPreview(): TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse {
  return {
    data: {
      metadata: createV2ParseResult().metadata,
      rows: [
        {
          row: 20,
          row_type: "GROUP",
          group_id: "group-1",
          group_name: "Mục chính từ máy chủ",
          original_group_order: 2,
          target_group_order: 1,
          identity_fallback: false,
        },
        {
          row: 21,
          row_type: "SUBGROUP",
          subgroup_id: "subgroup-1",
          subgroup_name: "Nhóm con từ máy chủ",
          original_group_id: "group-1",
          original_subgroup_order: 2,
          target_group_id: "group-1",
          target_group_order: 1,
          target_subgroup_order: 1,
          identity_fallback: false,
        },
        {
          row: 22,
          row_type: "CRITERION",
          criterion_id: "criterion-2",
          criterion_code: "TC-0002",
          existing_title: "Tiêu đề authoritative",
          requirement_text: "Nội dung chuẩn hóa từ máy chủ",
          original_group_id: "group-1",
          original_subgroup_id: "subgroup-1",
          original_criterion_order: 2,
          target_group_id: "group-1",
          target_subgroup_id: "subgroup-1",
          target_group_order: 1,
          target_subgroup_order: 1,
          target_criterion_order: 1,
          identity_fallback: false,
        },
      ],
      counts: { groups: 1, subgroups: 1, criteria: 1 },
      effects: {
        groups: { create: 1, update: 2, move: 3, delete: 4 },
        subgroups: { create: 5, update: 6, move: 7, delete: 8 },
        criteria: { create: 9, update: 10, move: 11, delete: 12 },
      },
    },
    errors: [],
  }
}

export function createHierarchyImportFile(name = "baseline-v2.xlsx", sizeBytes?: number) {
  return new File([new Uint8Array(sizeBytes ?? 4)], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

type HierarchyImportHarnessProps = {
  version?: TechnicalConfigurationBaselineDecodedDraft
  isBlocked?: boolean
  onApplied?: (version: TechnicalConfigurationBaselineDecodedDraft) => Promise<void>
  onConflict?: (versionId: string) => Promise<void>
  onUnresolvedStateChange?: (unresolved: boolean) => void
}

export function HierarchyImportHarness({
  version = createHierarchyDraft(),
  isBlocked = false,
  onApplied = vi.fn(),
  onConflict = vi.fn(),
  onUnresolvedStateChange = vi.fn(),
}: Readonly<HierarchyImportHarnessProps>) {
  const workflow = useTechnicalConfigurationBaselineHierarchyImport({
    selectedVersion: version,
    isBlocked,
    onApplied,
    onConflict,
    onUnresolvedStateChange,
  })

  return (
    <>
      <button type="button" onClick={workflow.openDialog}>
        Nhập cấu hình phân cấp
      </button>
      <TechnicalConfigurationBaselineHierarchyImportDialog workflow={workflow} />
    </>
  )
}
