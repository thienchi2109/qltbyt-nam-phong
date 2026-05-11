import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("InteractiveEquipmentChart file size", () => {
  it("stays below the repo extraction threshold", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/interactive-equipment-chart.tsx"),
      "utf8",
    )
    const lineCount = source.split(/\r?\n/).length

    expect(lineCount).toBeLessThan(350)
  })
})
