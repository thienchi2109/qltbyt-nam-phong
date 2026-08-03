import { describe, expect, it } from "vitest"

import {
  createTechnicalConfigurationResultWorkbookModel,
  type TechnicalConfigurationResultWorkbookModel,
} from "@/lib/technical-configuration-result-excel-contract"
import {
  createMissingDataResultWorkbookFixture,
  createNarrowedResultWorkbookFixture,
  createResultWorkbookFixture,
} from "@/lib/__tests__/technical-configuration-result-excel-fixtures"

function getOverviewSheet(model: TechnicalConfigurationResultWorkbookModel) {
  const sheet = model.sheets.find((candidate) => candidate.kind === "overview")
  if (sheet?.kind !== "overview") throw new Error("Expected overview sheet.")
  return sheet
}

function getRankingSheet(model: TechnicalConfigurationResultWorkbookModel) {
  const sheet = model.sheets.find((candidate) => candidate.kind === "ranking")
  if (sheet?.kind !== "ranking") throw new Error("Expected ranking sheet.")
  return sheet
}

describe("technical configuration result ranking workbook contract", () => {
  it("preserves model and criterion total for ranking-only output", () => {
    const input = createResultWorkbookFixture({
      mode: "ranking_only",
      optionCount: 2,
      criterionCount: 3,
    })
    if (input.ranking === null) throw new Error("Expected ranking fixture.")

    const model = createTechnicalConfigurationResultWorkbookModel(input)
    const ranking = getRankingSheet(model)
    const overview = getOverviewSheet(model)
    const expectedRows = input.ranking.map((row) => ({
      ...row,
      model: input.optionAxis.find((option) => option.option_id === row.option_id)?.model,
    }))

    expect(ranking.criterion_total).toBe(3)
    expect(ranking.rows).toEqual(expectedRows)
    expect(overview.summary.ranking_summary?.top_ten).toEqual(expectedRows)
  })

  it("preserves nullable model values without inventing fallback text", () => {
    const input = createMissingDataResultWorkbookFixture()
    const model = createTechnicalConfigurationResultWorkbookModel(input)
    const ranking = getRankingSheet(model)
    const overview = getOverviewSheet(model)

    expect(ranking.rows[0]).toMatchObject({ model: null })
    expect(overview.summary.ranking_summary?.top_ten[0]).toMatchObject({ model: null })
  })

  it("preserves selected ranking order while enriching the same rows", () => {
    const input = createNarrowedResultWorkbookFixture()
    const model = createTechnicalConfigurationResultWorkbookModel(input)
    const ranking = getRankingSheet(model)
    const overview = getOverviewSheet(model)

    expect(ranking.rows.map((row) => [row.option_id, row.model])).toEqual(
      input.ranking.map((row) => [
        row.option_id,
        input.optionAxis.find((option) => option.option_id === row.option_id)?.model,
      ])
    )
    expect(overview.summary.ranking_summary?.top_ten).toEqual(ranking.rows)
  })

  it("fails closed when a ranking row has no option descriptor", () => {
    const input = createResultWorkbookFixture({
      mode: "ranking_only",
      optionCount: 1,
      criterionCount: 1,
    })
    if (input.ranking === null) throw new Error("Expected ranking fixture.")

    expect(() =>
      createTechnicalConfigurationResultWorkbookModel({
        ...input,
        optionAxis: [],
      })
    ).toThrow(`Missing option descriptor for ranking option ${input.ranking[0].option_id}.`)
  })
})
