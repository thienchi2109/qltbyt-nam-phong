import "@testing-library/jest-dom"
import { describe, expect, it } from "vitest"

describe("TransferTypeTabs module exports", () => {
  it("exposes only the transfer tabs API used by the page controller", async () => {
    const moduleExports = await import("@/components/transfers/TransferTypeTabs")

    expect(moduleExports).toHaveProperty("TransferTypeTabs")
    expect(moduleExports).toHaveProperty("useTransferTypeTab")
    expect(moduleExports).not.toHaveProperty("getTransferTypeConfig")
  })
})
