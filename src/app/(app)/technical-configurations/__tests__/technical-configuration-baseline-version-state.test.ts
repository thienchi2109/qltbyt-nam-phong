import { describe, expect, it } from "vitest"

import {
  flattenTechnicalConfigurationBaselineVersionPages,
  getTechnicalConfigurationBaselineNextPage,
  replaceTechnicalConfigurationBaselineVersionInPages,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"

import { createDraft } from "./technical-configuration-baseline-tab-fixtures"

describe("technical configuration baseline version state", () => {
  it("does not expose another page when the loaded cache already reaches the new total", () => {
    const firstPageVersions = Array.from({ length: 100 }, (_, index) =>
      createDraft({
        id: `version-${200 - index}`,
        version_number: 200 - index,
        status: "locked",
      })
    )
    const secondPageVersions = Array.from({ length: 100 }, (_, index) =>
      createDraft({
        id: `version-${100 - index}`,
        version_number: 100 - index,
        status: "locked",
      })
    )
    const pages = replaceTechnicalConfigurationBaselineVersionInPages(
      {
        pages: [
          { data: firstPageVersions, total: 200, page: 1, page_size: 100 },
          { data: secondPageVersions, total: 200, page: 2, page_size: 100 },
        ],
        pageParams: [1, 2],
      },
      createDraft({ id: "version-201", version_number: 201 })
    )

    expect(flattenTechnicalConfigurationBaselineVersionPages(pages)).toHaveLength(201)
    expect(pages.pages.map((page) => page.total)).toEqual([201, 201])
    expect(getTechnicalConfigurationBaselineNextPage(pages.pages[1], pages.pages)).toBeUndefined()
  })

  it("rejects an empty page whose starting offset is still below the reported total", () => {
    expect(() =>
      getTechnicalConfigurationBaselineNextPage({
        data: [],
        total: 101,
        page: 2,
        page_size: 100,
      })
    ).toThrow("baseline_version_history_incomplete")
  })
})
