import { describe, expect, it, vi } from "vitest"

import { collectStableTechnicalConfigurationPages } from "@/app/(app)/technical-configurations/technical-configuration-pagination"

interface PageItem {
  id: string
}

interface Page {
  data: PageItem[]
  total: number
}

const snapshotError = "Pagination snapshot changed during load."

function page(ids: string[], total: number): Page {
  return {
    data: ids.map((id) => ({ id })),
    total,
  }
}

describe("collectStableTechnicalConfigurationPages", () => {
  it.each([
    {
      caseName: "a page is empty before the reported total is reached",
      pages: [page(["item-1"], 2), page([], 2)],
    },
    {
      caseName: "an item overlaps between pages",
      pages: [page(["item-1"], 2), page(["item-1"], 2)],
    },
    {
      caseName: "a page pushes the aggregate past the reported total",
      pages: [page(["item-1"], 2), page(["item-2", "item-3"], 2)],
    },
  ])("rejects the aggregate when $caseName", async ({ pages }) => {
    const loadPage = vi.fn((pageNumber: number) => Promise.resolve(pages[pageNumber - 1]!))

    await expect(
      collectStableTechnicalConfigurationPages({
        loadPage,
        snapshotError,
        getItemKey: (item) => item.id,
      })
    ).rejects.toThrow(snapshotError)
  })
})
