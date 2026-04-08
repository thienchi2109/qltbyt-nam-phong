import { describe, expect, it } from "vitest"
import * as fs from "fs"
import * as path from "path"

const tabsSource = fs.readFileSync(
  path.resolve(__dirname, "../TransferTypeTabs.tsx"),
  "utf-8",
)

describe("TransferTypeTabs source", () => {
  it("does not depend on next/navigation useSearchParams", () => {
    expect(tabsSource).not.toContain("useSearchParams")
  })
})
