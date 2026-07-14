import { describe, expect, it } from "vitest"

import {
  flattenTechnicalConfigurationBaselineVersionPages,
  getTechnicalConfigurationBaselineErrorMessage,
  getTechnicalConfigurationBaselineNextPage,
  replaceTechnicalConfigurationBaselineFirstPageInPages,
  replaceTechnicalConfigurationBaselineVersionInPages,
  validateTechnicalConfigurationBaselineVersionPage,
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
      validateTechnicalConfigurationBaselineVersionPage({
        data: [],
        total: 101,
        page: 2,
        page_size: 100,
      })
    ).toThrow("baseline_version_history_incomplete")
  })

  it("maps the pagination integrity sentinel to the caller fallback", () => {
    expect(
      getTechnicalConfigurationBaselineErrorMessage(
        new Error("baseline_version_history_incomplete"),
        "Không thể tải cấu hình cơ sở."
      )
    ).toBe("Không thể tải cấu hình cơ sở.")
  })

  it("rejects a terminal page when a concurrent insert leaves a duplicate boundary", () => {
    const createVersions = (highestVersion: number, count: number) =>
      Array.from({ length: count }, (_, index) =>
        createDraft({
          id: `version-${highestVersion - index}`,
          version_number: highestVersion - index,
          status: "locked",
        })
      )
    const firstPage = {
      data: createVersions(200, 100),
      total: 200,
      page: 1,
      page_size: 100,
    }
    const secondPage = {
      data: createVersions(101, 100),
      total: 201,
      page: 2,
      page_size: 100,
    }

    expect(() =>
      validateTechnicalConfigurationBaselineVersionPage(
        {
          data: createVersions(1, 1),
          total: 201,
          page: 3,
          page_size: 100,
        },
        [firstPage, secondPage]
      )
    ).toThrow("baseline_version_history_incomplete")
  })

  it("reconciles shifted loaded pages when a first-page refresh inserts a new version", () => {
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
    const refreshedFirstPageVersions = Array.from({ length: 100 }, (_, index) =>
      createDraft({
        id: `version-${201 - index}`,
        version_number: 201 - index,
        status: "locked",
      })
    )

    const pages = replaceTechnicalConfigurationBaselineFirstPageInPages(
      {
        pages: [
          { data: firstPageVersions, total: 200, page: 1, page_size: 100 },
          { data: secondPageVersions, total: 200, page: 2, page_size: 100 },
        ],
        pageParams: [1, 2],
      },
      {
        data: refreshedFirstPageVersions,
        total: 201,
        page: 1,
        page_size: 100,
      }
    )

    const versionIds = flattenTechnicalConfigurationBaselineVersionPages(pages).map(
      (version) => version.id
    )
    expect(versionIds).toHaveLength(200)
    expect(versionIds).toContain("version-101")
    expect(versionIds).not.toContain("version-1")
    expect(pages.pageParams).toEqual([1, 2])
    expect(getTechnicalConfigurationBaselineNextPage(pages.pages[1], pages.pages)).toBe(3)
  })
})
