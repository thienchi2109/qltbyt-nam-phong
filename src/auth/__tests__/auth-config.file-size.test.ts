import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("auth config file size", () => {
  it("keeps src/auth/config.ts below the repo hard ceiling", () => {
    const source = readFileSync(join(process.cwd(), "src/auth/config.ts"), "utf8")
    const lineCount = source.split(/\r?\n/).length

    expect(lineCount).toBeLessThan(350)
  })
})
