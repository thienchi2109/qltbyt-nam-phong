import { readFileSync } from "node:fs"
import { join } from "node:path"

const repoRoot = process.cwd()
const EQUIPMENT_DETAIL_DIALOG_PATH =
  "src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx"

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8")
}

describe("React Doctor P1 EquipmentDetailDialog state boundary", () => {
  it("does not reset dialog state from an open prop change effect", () => {
    const source = readSource(EQUIPMENT_DETAIL_DIALOG_PATH)

    expect(source).not.toMatch(
      /React\.useEffect\(\(\) => \{\s*if \(!open\) \{[\s\S]*?setSavedValues\(null\)[\s\S]*?\}, \[open\]\)/
    )
  })

  it("uses a keyed state component so parent-controlled close remounts local state", () => {
    const source = readSource(EQUIPMENT_DETAIL_DIALOG_PATH)

    expect(source).toContain("function EquipmentDetailDialogState")
    expect(source).toContain("key={dialogStateKey}")
  })
})
