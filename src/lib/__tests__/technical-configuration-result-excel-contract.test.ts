import { describe, expect, expectTypeOf, it } from "vitest"

import {
  EXCEL_WORKSHEET_MAX_COLUMNS,
  RESULT_WORKBOOK_MATRIX_CONTEXT_COLUMNS,
  RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET,
  RESULT_WORKBOOK_META_KEYS,
  RESULT_WORKBOOK_OPTION_COLUMNS,
  RESULT_WORKBOOK_TEMPLATE_KIND,
  RESULT_WORKBOOK_TEMPLATE_VERSION,
  createTechnicalConfigurationResultWorkbookModel,
  type TechnicalConfigurationResultWorkbookModel,
  type TechnicalConfigurationResultWorkbookBuildInput,
  type TechnicalConfigurationResultWorkbookSheetModel,
} from "@/lib/technical-configuration-result-excel-contract"

import type { TechnicalConfigurationResultExportDataset } from "@/app/(app)/technical-configurations/technical-configuration-result-export-types"

import {
  createContinuationResultWorkbookFixture,
  createEmptyResultWorkbookFixture,
  createEmptyOptionsSingleCriterionResultWorkbookFixture,
  createHierarchicalResultWorkbookFixture,
  createMatrixBoundaryResultWorkbookFixture,
  createMissingDataResultWorkbookFixture,
  createNarrowedResultWorkbookFixture,
  createRepresentativeLargeResultWorkbookFixture,
  createResultWorkbookFixture,
  createSingleOptionEmptyCriteriaResultWorkbookFixture,
  createSparseResultWorkbookFixture,
  createTiedRankingResultWorkbookFixture,
} from "./technical-configuration-result-excel-fixtures"

type ResultWorkbookSheetKind = TechnicalConfigurationResultWorkbookSheetModel["kind"]

type WorkbookBuildContextKey = "option_ids" | "criterion_ids" | "generated_at" | "generated_by"

type WorkbookDatasetSource<T> = T extends unknown ? Omit<T, WorkbookBuildContextKey> : never

function getSheet<K extends ResultWorkbookSheetKind>(
  workbook: TechnicalConfigurationResultWorkbookModel,
  kind: K
): Extract<TechnicalConfigurationResultWorkbookSheetModel, { kind: K }> {
  const sheet = workbook.sheets.find((candidate) => candidate.kind === kind)
  expect(sheet).toBeDefined()
  return sheet as Extract<TechnicalConfigurationResultWorkbookSheetModel, { kind: K }>
}

describe("technical configuration result workbook contract", () => {
  it("accepts the P14A4 stable dataset shape without a production app dependency", () => {
    expectTypeOf<TechnicalConfigurationResultExportDataset>().toMatchTypeOf<
      WorkbookDatasetSource<TechnicalConfigurationResultWorkbookBuildInput>
    >()
    expectTypeOf<TechnicalConfigurationResultWorkbookBuildInput["optionAxis"]>().toEqualTypeOf<
      TechnicalConfigurationResultExportDataset["optionAxis"]
    >()
    expectTypeOf<TechnicalConfigurationResultWorkbookBuildInput["criterionAxis"]>().toEqualTypeOf<
      TechnicalConfigurationResultExportDataset["criterionAxis"]
    >()
  })

  it("locks the versioned output-only constants and exact column groups", () => {
    expect(RESULT_WORKBOOK_TEMPLATE_KIND).toBe("technical_configuration_result")
    expect(RESULT_WORKBOOK_TEMPLATE_VERSION).toBe(1)
    expect(EXCEL_WORKSHEET_MAX_COLUMNS).toBe(16_384)
    expect(RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET).toBe(5_460)
    expect(RESULT_WORKBOOK_MATRIX_CONTEXT_COLUMNS).toEqual([
      "STT",
      "Nhóm tiêu chí",
      "Mã tiêu chí",
      "Yêu cầu cấu hình cơ sở",
    ])
    expect(RESULT_WORKBOOK_OPTION_COLUMNS).toEqual([
      "Phản hồi nhà cung cấp",
      "Thông tin bổ sung / tài liệu",
      "Kết luận đánh giá",
    ])
    expect(RESULT_WORKBOOK_META_KEYS).toEqual([
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
    ])
  })

  it.each([
    ["full", ["Tổng quan", "Xếp hạng", "Ma trận chi tiết", "_meta"]],
    ["ranking_only", ["Tổng quan", "Xếp hạng", "_meta"]],
    ["detailed_matrix_only", ["Tổng quan", "Ma trận chi tiết", "_meta"]],
  ] as const)("locks %s sheet order and keeps exactly one hidden _meta", (mode, names) => {
    const workbook = createTechnicalConfigurationResultWorkbookModel(
      createResultWorkbookFixture({
        mode,
        optionCount: 2,
        criterionCount: 2,
      })
    )

    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(names)
    expect(workbook.sheets.map((sheet) => sheet.state)).toEqual(
      names.map((name) => (name === "_meta" ? "hidden" : "visible"))
    )
    expect(workbook.sheets.filter((sheet) => sheet.kind === "meta")).toHaveLength(1)
  })

  it("locks metadata identity, selected scopes and stable narrowed ordering", () => {
    const fixture = createNarrowedResultWorkbookFixture()
    const optionIds = fixture.optionAxis.map((option) => option.option_id)
    const criterionIds = fixture.criterionAxis.map((criterion) => criterion.criterion_id)
    const workbook = createTechnicalConfigurationResultWorkbookModel(fixture)
    const meta = getSheet(workbook, "meta")
    const overview = getSheet(workbook, "overview")
    const ranking = getSheet(workbook, "ranking")
    const matrix = getSheet(workbook, "matrix")

    expect(overview.summary).toMatchObject({
      option_total: optionIds.length,
      criterion_total: criterionIds.length,
    })
    expect(ranking.rows).toHaveLength(optionIds.length)
    // Ranking preserves its caller-supplied order independently of the option axis.
    expect(ranking.rows.map((row) => row.option_id)).toEqual(
      fixture.ranking.map((row) => row.option_id)
    )
    expect(fixture.matrix).toHaveLength(optionIds.length * criterionIds.length)
    expect(meta.metadata).toEqual({
      template_kind: "technical_configuration_result",
      template_version: 1,
      dossier_id: fixture.manifest.dossier.id,
      baseline_version_id: fixture.manifest.baseline_version.id,
      snapshot_token: "snapshot-v1",
      ranking_snapshot_token: "ranking-v1",
      content_mode: "full",
      option_scope: "selected",
      criterion_scope: "selected",
      ordered_option_ids: optionIds,
      ordered_criterion_ids: criterionIds,
      generated_at: "2026-08-02T12:34:56.000Z",
      generated_by: "Nguyen Van A",
    })
    expect(Object.keys(meta.metadata)).toEqual([...RESULT_WORKBOOK_META_KEYS])
    expect(matrix.option_groups.map((option) => option.option_id)).toEqual(optionIds)
    expect(
      matrix.rows
        .filter((row) => row.kind === "criterion")
        .map((criterion) => criterion.criterion_id)
    ).toEqual(
      fixture.hierarchyRows
        .filter((row) => row.kind === "criterion")
        .map((row) => row.criterion.criterion_id)
    )
  })

  it("builds overview, ranking and matrix row models without rendering", () => {
    const workbook = createTechnicalConfigurationResultWorkbookModel(
      createSparseResultWorkbookFixture()
    )
    const overview = getSheet(workbook, "overview")
    const ranking = getSheet(workbook, "ranking")
    const matrix = getSheet(workbook, "matrix")

    expect(overview.summary).toMatchObject({
      option_total: 2,
      criterion_total: 2,
      scope: {
        option_scope: "all",
        criterion_scope: "all",
        ordered_option_ids: [],
        ordered_criterion_ids: [],
      },
      ranking_summary: {
        eligible_total: 2,
        incomplete_total: 0,
        reference_ranking_disclaimer: true,
      },
    })
    expect(ranking.rows).toHaveLength(2)
    expect(ranking.rows[0]).toMatchObject({
      option_id: matrix.option_groups[0].option_id,
      rank: 1,
    })
    expect(matrix.context_columns).toEqual(RESULT_WORKBOOK_MATRIX_CONTEXT_COLUMNS)
    expect(matrix.option_columns).toEqual(RESULT_WORKBOOK_OPTION_COLUMNS)
    const criterionRows = matrix.rows.filter((row) => row.kind === "criterion")
    expect(matrix.rows).toHaveLength(3)
    expect(criterionRows[0]).toMatchObject({
      kind: "criterion",
      stt: 1,
      criterion_code: "TC-001",
      requirement_text: "Yeu cau cau hinh 1",
    })
    expect(criterionRows.every((row) => row.option_values.length === 2)).toBe(true)
    expect(
      criterionRows
        .flatMap((row) => row.option_values)
        .filter((value) => value.conclusion === "not_evaluated")
    ).toHaveLength(1)
  })

  it("models canonical section, subgroup and criterion rows without synthetic cells", () => {
    const workbook = createTechnicalConfigurationResultWorkbookModel(
      createHierarchicalResultWorkbookFixture()
    )
    const matrix = getSheet(workbook, "matrix")

    expect(
      matrix.rows.map((row) =>
        row.kind === "criterion" ? [row.kind, row.criterion_id] : [row.kind, row.id]
      )
    ).toEqual([
      ["section", "00000060-0000-4000-8000-000000000001"],
      ["criterion", "00000050-0000-4000-8000-000000000001"],
      ["subgroup", "00000065-0000-4000-8000-000000000001"],
      ["criterion", "00000050-0000-4000-8000-000000000002"],
    ])
    expect(matrix.rows[0]).toMatchObject({
      kind: "section",
      name: "Nhom tieu chi 1",
      option_aggregates: [
        {
          status: "passed",
          descendant_count: 2,
          status_counts: { meets: 2 },
        },
      ],
    })
    expect(matrix.rows[0]).not.toHaveProperty("option_values")
    expect(matrix.rows[1]).toHaveProperty("option_values")
    expect(matrix.rows[1]).not.toHaveProperty("option_aggregates")
  })

  it("keeps an empty requested matrix sheet and omits unrequested ranking summary", () => {
    const empty = createTechnicalConfigurationResultWorkbookModel(
      createEmptyResultWorkbookFixture()
    )
    const matrixOnly = createTechnicalConfigurationResultWorkbookModel(
      createResultWorkbookFixture({
        mode: "detailed_matrix_only",
        optionCount: 1,
        criterionCount: 1,
      })
    )

    expect(getSheet(empty, "matrix")).toMatchObject({
      name: "Ma trận chi tiết",
      option_groups: [],
      rows: [],
    })
    expect(getSheet(matrixOnly, "overview").summary.ranking_summary).toBeNull()
    expect(matrixOnly.sheets.some((sheet) => sheet.kind === "ranking")).toBe(false)
  })

  it("preserves independent ordered axes for asymmetric empty matrices", () => {
    const singleOption = createTechnicalConfigurationResultWorkbookModel(
      createSingleOptionEmptyCriteriaResultWorkbookFixture()
    )
    const singleCriterion = createTechnicalConfigurationResultWorkbookModel(
      createEmptyOptionsSingleCriterionResultWorkbookFixture()
    )

    expect(getSheet(singleOption, "matrix")).toMatchObject({
      option_groups: [{ display_label: "Phuong an 1" }],
      rows: [],
    })
    expect(getSheet(singleCriterion, "matrix")).toMatchObject({
      option_groups: [],
      rows: [
        { kind: "section", option_aggregates: [] },
        { kind: "criterion", criterion_code: "TC-001", option_values: [] },
      ],
    })
  })

  it("preserves tied dense ranks and explicit missing data", () => {
    const tied = createTechnicalConfigurationResultWorkbookModel(
      createTiedRankingResultWorkbookFixture()
    )
    const missing = createTechnicalConfigurationResultWorkbookModel(
      createMissingDataResultWorkbookFixture()
    )

    expect(getSheet(tied, "ranking").rows.map((row) => row.rank)).toEqual([1, 1])
    expect(
      getSheet(tied, "overview").summary.ranking_summary?.top_ten.map((row) => row.rank)
    ).toEqual([1, 1])
    expect(getSheet(missing, "overview").summary.ranking_summary).toMatchObject({
      eligible_total: 0,
      incomplete_total: 1,
    })
    const missingMatrix = getSheet(missing, "matrix")
    expect(missingMatrix.option_groups[0]).toMatchObject({
      model: null,
      manufacturer: null,
      option_name: null,
    })
    const missingCriterion = missingMatrix.rows.find((row) => row.kind === "criterion")
    expect(missingCriterion?.option_values[0]).toMatchObject({
      response_text: null,
      supplementary_information: null,
      technical_axis: null,
      evidence_axis: null,
      assessment_notes: null,
      conclusion: "not_evaluated",
    })
  })

  it("partitions only after the Excel physical column boundary without truncation", () => {
    const boundary = createTechnicalConfigurationResultWorkbookModel(
      createMatrixBoundaryResultWorkbookFixture()
    )
    const workbook = createTechnicalConfigurationResultWorkbookModel(
      createContinuationResultWorkbookFixture()
    )
    const boundaryMatrix = getSheet(boundary, "matrix")
    const matrices = workbook.sheets.filter(
      (
        sheet
      ): sheet is Extract<TechnicalConfigurationResultWorkbookSheetModel, { kind: "matrix" }> =>
        sheet.kind === "matrix"
    )

    expect(boundaryMatrix.option_groups).toHaveLength(RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET)
    expect(
      boundaryMatrix.context_columns.length +
        boundaryMatrix.option_groups.length * RESULT_WORKBOOK_OPTION_COLUMNS.length
    ).toBe(EXCEL_WORKSHEET_MAX_COLUMNS)
    expect(boundary.sheets.filter((sheet) => sheet.kind === "matrix")).toHaveLength(1)
    expect(matrices.map((sheet) => sheet.name)).toEqual(["Ma trận chi tiết", "Ma trận chi tiết 2"])
    expect(matrices.map((sheet) => sheet.option_groups.length)).toEqual([5_460, 1])
    expect(matrices.flatMap((sheet) => sheet.option_groups)).toHaveLength(5_461)
    expect(
      matrices.map((sheet) =>
        sheet.rows.map((row) =>
          row.kind === "criterion" ? [row.kind, row.criterion_id] : [row.kind, row.id]
        )
      )
    ).toEqual([expect.any(Array), expect.any(Array)])
    expect(
      matrices[0]?.rows.map((row) =>
        row.kind === "criterion" ? [row.kind, row.criterion_id] : [row.kind, row.id]
      )
    ).toEqual(
      matrices[1]?.rows.map((row) =>
        row.kind === "criterion" ? [row.kind, row.criterion_id] : [row.kind, row.id]
      )
    )
    expect(matrices.every((sheet) => sheet.context_columns.length === 4)).toBe(true)
    expect(
      matrices.every(
        (sheet) =>
          sheet.context_columns.length +
            sheet.option_groups.length * RESULT_WORKBOOK_OPTION_COLUMNS.length <=
          EXCEL_WORKSHEET_MAX_COLUMNS
      )
    ).toBe(true)
  })

  it("builds the deterministic representative fixture above 100 options x 102 criteria", () => {
    const firstFixture = createRepresentativeLargeResultWorkbookFixture()
    const secondFixture = createRepresentativeLargeResultWorkbookFixture()
    const first = createTechnicalConfigurationResultWorkbookModel(firstFixture)
    const second = createTechnicalConfigurationResultWorkbookModel(secondFixture)
    const matrix = getSheet(first, "matrix")

    expect(firstFixture).not.toBe(secondFixture)
    expect(firstFixture.manifest.option_total).toBe(101)
    expect(firstFixture.manifest.criterion_total).toBe(102)
    expect(firstFixture.matrix).toHaveLength(101 * 102)
    expect(matrix.option_groups).toHaveLength(101)
    const criterionRows = matrix.rows.filter((row) => row.kind === "criterion")
    expect(matrix.rows).toHaveLength(113)
    expect(criterionRows).toHaveLength(102)
    expect(criterionRows.every((row) => row.option_values.length === 101)).toBe(true)
    expect(first).toEqual(second)
  })
})
