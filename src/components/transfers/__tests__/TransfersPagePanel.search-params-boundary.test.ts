import { describe, expect, it } from "vitest"
import * as fs from "fs"
import * as path from "path"

const panelSource = fs.readFileSync(
  path.resolve(__dirname, "../../../app/(app)/transfers/_components/TransfersPagePanel.tsx"),
  "utf-8",
)

describe("TransfersPagePanel source", () => {
  it("routes TransferTypeTabs through the dedicated search params suspense boundary", () => {
    expect(panelSource).toContain("TransfersSearchParamsBoundary")
    expect(panelSource).toContain("<TransfersSearchParamsBoundary>")
    expect(panelSource).toContain("</TransfersSearchParamsBoundary>")
  })
})
