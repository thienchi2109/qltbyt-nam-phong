import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const HANDOVER_PREVIEW_PATH = "src/components/handover-preview-dialog.tsx"

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

describe("React Doctor P6 handover preview size guard", () => {
  it("keeps the dialog shell under the repo extraction threshold", () => {
    const source = readSource(HANDOVER_PREVIEW_PATH)
    const lineCount = source.split(/\r?\n/).length

    expect(lineCount).toBeLessThanOrEqual(350)
  })

  it("keeps generated document markup outside the dialog shell", () => {
    const source = readSource(HANDOVER_PREVIEW_PATH)

    expect(source).not.toContain("<!DOCTYPE html>")
    expect(source).not.toContain("<style>")
    expect(source).toContain("generateHandoverHTML")
  })
})
