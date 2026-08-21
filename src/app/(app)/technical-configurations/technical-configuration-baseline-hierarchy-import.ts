import type { TechnicalConfigurationBaselineDecodedDraft } from "./baseline-types"
import type {
  TechnicalConfigurationBaselineHierarchyImportPreviewError,
  TechnicalConfigurationBaselineHierarchyImportRawRow,
  TechnicalConfigurationBaselineHierarchyImportRpcArgs,
} from "./technical-configuration-baseline-hierarchy-import-types"
import {
  BASELINE_WORKBOOK_V2_TEMPLATE_KIND,
  BASELINE_WORKBOOK_V2_TEMPLATE_VERSION,
  toTechnicalConfigurationBaselineRomanOrdinal,
} from "@/lib/technical-configuration-baseline-excel-v2-contract"
import type {
  TechnicalConfigurationBaselineWorkbookCompatibleParseResult,
  TechnicalConfigurationBaselineWorkbookV2ExistingHierarchy,
} from "@/lib/technical-configuration-baseline-excel-v2-parse"

/** Formats one authoritative preview error with its physical workbook row. */
export function formatTechnicalConfigurationBaselineHierarchyImportPreviewError(
  error: TechnicalConfigurationBaselineHierarchyImportPreviewError
): string {
  const column = error.column ? ` · ${error.column}` : ""
  return `Dòng ${error.row}${column}: ${error.message}`
}

/** Flattens the decoded draft into the identity map required by the compatible parser. */
export function toTechnicalConfigurationBaselineExistingHierarchy(
  version: TechnicalConfigurationBaselineDecodedDraft
): TechnicalConfigurationBaselineWorkbookV2ExistingHierarchy {
  return {
    groups: version.groups.map((group) => ({ id: group.id })),
    subgroups: version.groups.flatMap((group) =>
      group.subgroups.map((subgroup) => ({
        id: subgroup.id,
        group_id: group.id,
      }))
    ),
    criteria: version.groups.flatMap((group) => [
      ...group.criteria.map((criterion) => ({
        id: criterion.id,
        criterion_code: criterion.criterion_code,
        title: criterion.title,
        group_id: group.id,
        subgroup_id: null,
      })),
      ...group.subgroups.flatMap((subgroup) =>
        subgroup.criteria.map((criterion) => ({
          id: criterion.id,
          criterion_code: criterion.criterion_code,
          title: criterion.title,
          group_id: group.id,
          subgroup_id: subgroup.id,
        }))
      ),
    ]),
  }
}

function toV2Rows(
  parsed: Extract<TechnicalConfigurationBaselineWorkbookCompatibleParseResult, { format: "v2" }>
): TechnicalConfigurationBaselineHierarchyImportRawRow[] {
  return parsed.rows.map((row) => {
    if (row.row_type === "GROUP") {
      return {
        row: row.row,
        stt: toTechnicalConfigurationBaselineRomanOrdinal(row.group_order),
        content: row.group_name,
        group_id: row.group_id,
        subgroup_id: null,
        criterion_id: null,
        criterion_code: null,
      }
    }
    if (row.row_type === "SUBGROUP") {
      return {
        row: row.row,
        stt: String(row.subgroup_order),
        content: row.subgroup_name,
        group_id: null,
        subgroup_id: row.subgroup_id,
        criterion_id: null,
        criterion_code: null,
      }
    }
    return {
      row: row.row,
      stt: null,
      content: row.requirement_text,
      group_id: null,
      subgroup_id: null,
      criterion_id: row.criterion_id,
      criterion_code: row.criterion_code,
    }
  })
}

function isPortableContentOnlyV2Workbook(
  parsed: Extract<TechnicalConfigurationBaselineWorkbookCompatibleParseResult, { format: "v2" }>
): boolean {
  return parsed.rows.every((row) => {
    if (row.row_type === "GROUP") {
      return row.group_id === null
    }
    if (row.row_type === "SUBGROUP") {
      return row.subgroup_id === null
    }
    return row.criterion_id === null && row.criterion_code === null
  })
}

function toHierarchyImportTemplateMetadata(
  parsed: TechnicalConfigurationBaselineWorkbookCompatibleParseResult,
  version: TechnicalConfigurationBaselineDecodedDraft
): TechnicalConfigurationBaselineHierarchyImportRpcArgs["p_template_metadata"] {
  if (parsed.format !== "v2") {
    return {
      template_kind: BASELINE_WORKBOOK_V2_TEMPLATE_KIND,
      template_version: BASELINE_WORKBOOK_V2_TEMPLATE_VERSION,
      dossier_id: parsed.metadata.dossier_id,
      baseline_version_id: parsed.metadata.baseline_version_id,
      baseline_revision: parsed.metadata.baseline_revision,
      generated_at: parsed.metadata.generated_at,
    }
  }
  if (!isPortableContentOnlyV2Workbook(parsed)) {
    return parsed.metadata
  }
  return {
    ...parsed.metadata,
    dossier_id: version.dossier_id,
    baseline_version_id: version.id,
    baseline_revision: version.revision,
  }
}

function toLegacyRows(
  parsed: Extract<
    TechnicalConfigurationBaselineWorkbookCompatibleParseResult,
    { format: "legacy" }
  >,
  version: TechnicalConfigurationBaselineDecodedDraft
): TechnicalConfigurationBaselineHierarchyImportRawRow[] {
  const groupsByOrder = new Map(version.groups.map((group) => [group.sort_order, group]))
  const criteriaByCode = new Map(
    toTechnicalConfigurationBaselineExistingHierarchy(version).criteria.map((criterion) => [
      criterion.criterion_code,
      criterion,
    ])
  )

  return parsed.rows.map((row, index) => {
    if (row.row_type === "GROUP") {
      return {
        row: parsed.row_numbers[index] ?? index + 2,
        stt: toTechnicalConfigurationBaselineRomanOrdinal(row.group_order),
        content: row.group_name,
        group_id: groupsByOrder.get(row.group_order)?.id ?? null,
        subgroup_id: null,
        criterion_id: null,
        criterion_code: null,
      }
    }
    const existingCriterion = row.criterion_code
      ? criteriaByCode.get(row.criterion_code)
      : undefined
    return {
      row: parsed.row_numbers[index] ?? index + 2,
      stt: null,
      content: row.requirement_text,
      group_id: null,
      subgroup_id: null,
      criterion_id: existingCriterion?.id ?? null,
      criterion_code: existingCriterion?.criterion_code ?? null,
    }
  })
}

/** Adapts either compatible workbook format to the authoritative hierarchy RPC contract. */
export function toTechnicalConfigurationBaselineHierarchyImportRpcArgs(
  parsed: TechnicalConfigurationBaselineWorkbookCompatibleParseResult,
  version: TechnicalConfigurationBaselineDecodedDraft
): TechnicalConfigurationBaselineHierarchyImportRpcArgs {
  return {
    p_baseline_version_id: version.id,
    p_template_metadata: toHierarchyImportTemplateMetadata(parsed, version),
    p_rows: parsed.format === "v2" ? toV2Rows(parsed) : toLegacyRows(parsed, version),
    p_expected_revision: version.revision,
  }
}
