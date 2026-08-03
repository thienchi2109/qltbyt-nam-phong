import type {
  TechnicalConfigurationResultWorkbookBuildInput,
  TechnicalConfigurationResultWorkbookCriterionSource,
  TechnicalConfigurationResultWorkbookMatrixSourceCell,
  TechnicalConfigurationResultWorkbookOptionSource,
  TechnicalConfigurationResultWorkbookRankingSourceRow,
} from "@/lib/technical-configuration-result-excel-contract-types"

export type * from "@/lib/technical-configuration-result-excel-contract-types"

/** Stable discriminator for final technical-configuration result workbooks. */
export const RESULT_WORKBOOK_TEMPLATE_KIND = "technical_configuration_result"

/** Supported final-result workbook contract version. */
export const RESULT_WORKBOOK_TEMPLATE_VERSION = 1

/** Physical column limit for an Excel worksheet. */
export const EXCEL_WORKSHEET_MAX_COLUMNS = 16_384

/** Exact frozen context columns at the start of every matrix worksheet. */
export const RESULT_WORKBOOK_MATRIX_CONTEXT_COLUMNS = [
  "STT",
  "Nhóm tiêu chí",
  "Mã tiêu chí",
  "Yêu cầu cấu hình cơ sở",
] as const

/** Exact ordered columns repeated for every option in a matrix worksheet. */
export const RESULT_WORKBOOK_OPTION_COLUMNS = [
  "Phản hồi nhà cung cấp",
  "Thông tin bổ sung / tài liệu",
  "Kết luận đánh giá",
] as const

/** Maximum complete option groups that fit on one matrix worksheet. */
export const RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET = Math.floor(
  (EXCEL_WORKSHEET_MAX_COLUMNS - RESULT_WORKBOOK_MATRIX_CONTEXT_COLUMNS.length) /
    RESULT_WORKBOOK_OPTION_COLUMNS.length
)

/** Exact ordered keys rendered on the hidden metadata worksheet. */
export const RESULT_WORKBOOK_META_KEYS = [
  "template_kind",
  "template_version",
  "dossier_id",
  "baseline_version_id",
  "snapshot_token",
  "ranking_snapshot_token",
  "content_mode",
  "option_scope",
  "criterion_scope",
  "ordered_option_ids",
  "ordered_criterion_ids",
  "generated_at",
  "generated_by",
] as const

function createScope(input: TechnicalConfigurationResultWorkbookBuildInput) {
  return {
    option_scope: input.option_ids === null ? "all" : "selected",
    criterion_scope: input.criterion_ids === null ? "all" : "selected",
    ordered_option_ids: input.option_ids === null ? [] : [...input.option_ids],
    ordered_criterion_ids: input.criterion_ids === null ? [] : [...input.criterion_ids],
  } as const
}

function createMetadata(input: TechnicalConfigurationResultWorkbookBuildInput) {
  return {
    template_kind: RESULT_WORKBOOK_TEMPLATE_KIND,
    template_version: RESULT_WORKBOOK_TEMPLATE_VERSION,
    dossier_id: input.manifest.dossier.id,
    baseline_version_id: input.manifest.baseline_version.id,
    snapshot_token: input.manifest.snapshot_token,
    ranking_snapshot_token: input.manifest.ranking_snapshot_token,
    content_mode: input.mode,
    ...createScope(input),
    generated_at: input.generated_at,
    generated_by: input.generated_by,
  } as const
}

type MetadataKeysMatchContract = keyof ReturnType<
  typeof createMetadata
> extends (typeof RESULT_WORKBOOK_META_KEYS)[number]
  ? (typeof RESULT_WORKBOOK_META_KEYS)[number] extends keyof ReturnType<typeof createMetadata>
    ? true
    : false
  : false

const METADATA_KEYS_MATCH_CONTRACT: MetadataKeysMatchContract = true
void METADATA_KEYS_MATCH_CONTRACT

function createOverviewSheet(input: TechnicalConfigurationResultWorkbookBuildInput) {
  const rankingSummary =
    input.ranking === null
      ? null
      : {
          eligible_total: input.ranking.filter((row) => row.eligibility === "eligible").length,
          incomplete_total: input.ranking.filter((row) => row.eligibility === "incomplete").length,
          reference_ranking_disclaimer: true as const,
          top_ten: input.ranking.slice(0, 10),
        }

  return {
    kind: "overview",
    name: "Tổng quan",
    state: "visible",
    summary: {
      dossier: input.manifest.dossier,
      baseline_version: input.manifest.baseline_version,
      option_total: input.manifest.option_total,
      criterion_total: input.manifest.criterion_total,
      generated_at: input.generated_at,
      generated_by: input.generated_by,
      scope: createScope(input),
      ranking_summary: rankingSummary,
    },
  } as const
}

function matrixCellKey(criterionId: string, optionId: string) {
  return `${criterionId}\u0000${optionId}`
}

function createMatrixSheets(
  optionAxis: readonly TechnicalConfigurationResultWorkbookOptionSource[],
  criterionAxis: readonly TechnicalConfigurationResultWorkbookCriterionSource[],
  matrix: readonly TechnicalConfigurationResultWorkbookMatrixSourceCell[]
) {
  const cells = new Map<string, TechnicalConfigurationResultWorkbookMatrixSourceCell>()

  for (const cell of matrix) {
    cells.set(matrixCellKey(cell.criterion_id, cell.option_id), cell)
  }

  const optionPartitions =
    optionAxis.length === 0
      ? [[]]
      : Array.from(
          {
            length: Math.ceil(optionAxis.length / RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET),
          },
          (_, index) =>
            optionAxis.slice(
              index * RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET,
              (index + 1) * RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET
            )
        )

  return optionPartitions.map((partition, partitionIndex) => ({
    kind: "matrix" as const,
    name: partitionIndex === 0 ? "Ma trận chi tiết" : `Ma trận chi tiết ${partitionIndex + 1}`,
    state: "visible" as const,
    context_columns: RESULT_WORKBOOK_MATRIX_CONTEXT_COLUMNS,
    option_columns: RESULT_WORKBOOK_OPTION_COLUMNS,
    option_groups: partition,
    rows: criterionAxis.map((criterion, criterionIndex) => ({
      stt: criterionIndex + 1,
      group_id: criterion.group_id,
      group_name: criterion.group_name,
      group_order: criterion.group_order,
      criterion_id: criterion.criterion_id,
      criterion_code: criterion.criterion_code,
      criterion_title: criterion.criterion_title,
      requirement_text: criterion.requirement_text,
      criterion_order: criterion.criterion_order,
      option_values: partition.map((option) => {
        const cell = cells.get(matrixCellKey(criterion.criterion_id, option.option_id))
        return {
          option_id: option.option_id,
          response_text: cell?.response_text ?? null,
          supplementary_information: cell?.supplementary_information ?? null,
          document_links: cell?.document_links ?? [],
          technical_axis: cell?.technical_axis ?? null,
          evidence_axis: cell?.evidence_axis ?? null,
          assessment_notes: cell?.assessment_notes ?? null,
          conclusion: cell?.conclusion ?? "not_evaluated",
        }
      }),
    })),
  }))
}

function createRankingSheet(
  ranking: readonly TechnicalConfigurationResultWorkbookRankingSourceRow[]
) {
  return {
    kind: "ranking",
    name: "Xếp hạng",
    state: "visible",
    rows: ranking,
  } as const
}

function createMetaSheet(input: TechnicalConfigurationResultWorkbookBuildInput) {
  return {
    kind: "meta",
    name: "_meta",
    state: "hidden",
    metadata: createMetadata(input),
  } as const
}

type ResultWorkbookSheet =
  | ReturnType<typeof createOverviewSheet>
  | ReturnType<typeof createRankingSheet>
  | ReturnType<typeof createMatrixSheets>[number]
  | ReturnType<typeof createMetaSheet>

/** Build the deterministic output-only workbook model without ExcelJS or side effects. */
export function createTechnicalConfigurationResultWorkbookModel(
  input: TechnicalConfigurationResultWorkbookBuildInput
): {
  readonly template_kind: typeof RESULT_WORKBOOK_TEMPLATE_KIND
  readonly template_version: typeof RESULT_WORKBOOK_TEMPLATE_VERSION
  readonly sheets: readonly ResultWorkbookSheet[]
} {
  const sheets: ResultWorkbookSheet[] = [createOverviewSheet(input)]

  if (input.ranking !== null) sheets.push(createRankingSheet(input.ranking))
  if (input.matrix !== null) {
    sheets.push(...createMatrixSheets(input.optionAxis, input.criterionAxis, input.matrix))
  }

  sheets.push(createMetaSheet(input))

  return {
    template_kind: RESULT_WORKBOOK_TEMPLATE_KIND,
    template_version: RESULT_WORKBOOK_TEMPLATE_VERSION,
    sheets,
  }
}

export type TechnicalConfigurationResultWorkbookModel = ReturnType<
  typeof createTechnicalConfigurationResultWorkbookModel
>

export type TechnicalConfigurationResultWorkbookSheetModel =
  TechnicalConfigurationResultWorkbookModel["sheets"][number]

export type TechnicalConfigurationResultWorkbookMetadata = Extract<
  TechnicalConfigurationResultWorkbookSheetModel,
  { kind: "meta" }
>["metadata"]
