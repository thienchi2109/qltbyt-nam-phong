import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const sourcePath = join(process.cwd(), "src/app/(app)/_components/AppLayoutShell.tsx")

function readSource() {
  return readFileSync(sourcePath, "utf8")
}

describe("AppLayoutShell React Doctor source contract", () => {
  it("uses size utilities for matching width and height utility pairs", () => {
    const source = readSource()
    const redundantSizePairPattern =
      /\b(?:(h)-([0-9]+|\[[^\]]+\])\s+(w)-\2|(w)-([0-9]+|\[[^\]]+\])\s+(h)-\5)\b/g

    expect(source.match(redundantSizePairPattern) ?? []).toEqual([])
  })

  it("uses project color tokens instead of the default slate palette", () => {
    const source = readSource()

    expect(source.match(/\bslate-\d{2,3}\b/g) ?? []).toEqual([])
  })

  it("groups related app shell UI state in a reducer", () => {
    const source = readSource()

    expect(source).toContain("React.useReducer")
    expect(source).not.toContain("React.useState")
  })
})
