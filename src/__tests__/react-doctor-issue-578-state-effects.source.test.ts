import { readFileSync } from "node:fs"
import { join } from "node:path"

const repoRoot = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8")
}

describe("React Doctor Issue #578 state/effect source guards", () => {
  it.each([
    "src/components/transfers/ReturnLocationDialog.tsx",
    "src/app/(app)/transfers/_components/useTransfersRowActions.tsx",
    "src/app/(app)/equipment/_components/EquipmentBulkDeleteBar.tsx",
  ])("does not use effects to reset dialog state in %s", (relativePath) => {
    expect(readSource(relativePath)).not.toContain("React.useEffect")
  })

  it("keeps TransfersKanbanView mobile status valid without effect-driven reset", () => {
    const source = readSource("src/components/transfers/TransfersKanbanView.tsx")

    expect(source).not.toContain("setMobileSelectedStatus(allColumns[0])")
    expect(source).not.toContain("[allColumns, mobileSelectedStatus]")
  })

  it("builds return location suggestions in one pass", () => {
    const source = readSource("src/components/transfers/ReturnLocationDialog.tsx")

    expect(source).not.toMatch(/\.map\([\s\S]*?\.filter\([\s\S]*?\.filter\(/)
  })
})
