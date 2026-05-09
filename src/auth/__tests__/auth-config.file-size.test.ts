import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("auth config file size", () => {
  it("keeps src/auth/config.ts below the proactive 350-line threshold", () => {
    const source = readFileSync(join(process.cwd(), "src/auth/config.ts"), "utf8")
    const lines = source.split("\n")
    if (lines.at(-1) === "") {
      lines.pop()
    }
    const lineCount = lines.length

    expect(lineCount).toBeLessThan(350)
  })
})
