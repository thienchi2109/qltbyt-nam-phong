import "@testing-library/jest-dom"
import { describe, expect, it } from "vitest"

describe("page-transition-wrapper module exports", () => {
  it("keeps only the public page transition surface needed by app layout", async () => {
    const moduleExports = await import("@/components/page-transition-wrapper")

    expect(moduleExports).toHaveProperty("MainContentTransition")
    expect(moduleExports).not.toHaveProperty("PageTransitionWrapper")
    expect(moduleExports).not.toHaveProperty("ModalTransition")
    expect(moduleExports).not.toHaveProperty("LoadingTransition")
  })
})
