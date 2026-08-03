import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { expect, it } from "vitest"

it("uses commit-synchronous cleanup for keyed result-export identity remounts", () => {
  const hookSource = readFileSync(
    resolve(
      process.cwd(),
      "src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationResultExport.ts"
    ),
    "utf8"
  )

  expect(hookSource).toContain("React.useLayoutEffect(")
})
