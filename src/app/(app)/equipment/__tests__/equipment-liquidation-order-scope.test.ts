import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const MAIN_EQUIPMENT_HOOK = "src/app/(app)/equipment/_hooks/useEquipmentData.ts"
const NON_MAIN_CALLERS = [
  "src/app/(app)/equipment/_hooks/useEquipmentExport.ts",
  "src/components/transfer-dialog.data.ts",
  "src/hooks/useAddTasksEquipment.ts",
  "src/hooks/use-cached-equipment.ts",
] as const

function readSource(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8")
}

describe("equipment liquidation-last caller scope", () => {
  it("enables liquidation-last ordering exactly once in the main Equipments hook", () => {
    const mainSource = readSource(MAIN_EQUIPMENT_HOOK)

    expect(mainSource.match(/p_liquidation_last:\s*true/g)).toHaveLength(1)
    expect(mainSource.match(/liquidationLast:\s*true/g)).toHaveLength(1)
  })

  it.each(NON_MAIN_CALLERS)("does not enable liquidation-last ordering in %s", (caller) => {
    const source = readSource(caller)

    expect(source).not.toMatch(/p_liquidation_last:\s*true/)
    expect(source).not.toMatch(/liquidationLast:\s*true/)
  })
})
