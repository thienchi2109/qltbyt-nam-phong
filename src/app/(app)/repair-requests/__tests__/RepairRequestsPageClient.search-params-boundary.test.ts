import { describe, expect, it } from "vitest"
import * as fs from "fs"
import * as path from "path"

const componentSources = [
  "../_components/RepairRequestsPageClient.tsx",
  "../_components/RepairRequestsDeepLinkHandler.tsx",
].map((relativePath) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf-8"),
)

describe("RepairRequestsPageClient source", () => {
  it("routes search params through the dedicated deep-link Suspense boundary", () => {
    for (const source of componentSources) {
      expect(source).not.toContain("useSearchParams")
    }

    const pageClientSource = componentSources[0]
    expect(pageClientSource).toContain("RepairRequestsDeepLinkBoundary")
    expect(pageClientSource).toContain("<RepairRequestsDeepLinkBoundary")
    expect(pageClientSource).toContain("</RepairRequestsDeepLinkBoundary>")
  })
})
