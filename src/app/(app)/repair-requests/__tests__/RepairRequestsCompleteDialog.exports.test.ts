import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("RepairRequestsCompleteDialog exports", () => {
  it("keeps RepairRequestsCompleteDialog as the single complete-dialog export", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/(app)/repair-requests/_components/RepairRequestsCompleteDialog.tsx"
      ),
      "utf8"
    )

    expect(source).toContain("export function RepairRequestsCompleteDialog")
    expect(source).not.toContain("CompleteRequestDialog")
  })
})
