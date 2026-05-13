import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("assistant list keys", () => {
  it("does not key assistant lists by array index", () => {
    const files = [
      "src/components/assistant/AssistantDraftCard.tsx",
      "src/components/assistant/AssistantThinkingIndicator.tsx",
    ]

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8")

      expect(source).not.toMatch(/key=\{i\}/)
      expect(source).not.toMatch(/key=\{index\}/)
    }
  })
})
