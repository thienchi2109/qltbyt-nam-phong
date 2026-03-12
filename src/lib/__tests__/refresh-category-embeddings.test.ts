/**
 * Tests for refreshCategoryEmbeddings helper
 *
 * Verifies fire-and-forget behavior, correct API call shape,
 * and graceful error handling.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"

// Capture fetch calls
const fetchMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ refreshed: 1 })))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("refreshCategoryEmbeddings", () => {
  test("calls refresh API with correct category_ids", async () => {
    const { refreshCategoryEmbeddings } = await import(
      "@/lib/refresh-category-embeddings"
    )

    await refreshCategoryEmbeddings([42, 99])

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/embeddings/refresh-categories",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_ids: [42, 99] }),
      })
    )
  })

  test("does not call API when categoryIds is empty", async () => {
    const { refreshCategoryEmbeddings } = await import(
      "@/lib/refresh-category-embeddings"
    )

    await refreshCategoryEmbeddings([])

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("does not throw when fetch fails (fire-and-forget)", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"))

    const { refreshCategoryEmbeddings } = await import(
      "@/lib/refresh-category-embeddings"
    )

    // Must not throw
    await expect(refreshCategoryEmbeddings([1])).resolves.toBeUndefined()
  })

  test("does not throw when fetch returns non-ok status", async () => {
    fetchMock.mockResolvedValue(new Response("Server error", { status: 500 }))

    const { refreshCategoryEmbeddings } = await import(
      "@/lib/refresh-category-embeddings"
    )

    // Must not throw — fire-and-forget
    await expect(refreshCategoryEmbeddings([1])).resolves.toBeUndefined()
  })
})
