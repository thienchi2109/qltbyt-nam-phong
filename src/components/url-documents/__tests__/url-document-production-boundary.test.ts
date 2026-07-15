import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { extractModuleReferences } from "./url-document-module-reference-helpers"
import {
  assertExactSet,
  assertNoForbiddenSourcePatterns,
  collectProductionModules,
  expectedModuleReferences,
  expectedProductionModules,
  sourceRoot,
} from "./url-document-source-contract-fixtures"

describe("URL document production source boundary", () => {
  it("contains exactly the three approved production modules", () => {
    assertExactSet(
      collectProductionModules(sourceRoot),
      expectedProductionModules,
      "URL document production inventory"
    )
  })

  it.each(expectedProductionModules)(
    "keeps %s on its exact approved module-reference set",
    (fileName) => {
      const source = readFileSync(join(sourceRoot, fileName), "utf8")
      assertExactSet(
        extractModuleReferences(source, fileName),
        expectedModuleReferences[fileName],
        `${fileName} module references`
      )
    }
  )

  it.each(expectedProductionModules)(
    "keeps %s free of Equipment and persistence-specific symbols",
    (fileName) => {
      const source = readFileSync(join(sourceRoot, fileName), "utf8")
      expect(() => assertNoForbiddenSourcePatterns(source, fileName, fileName)).not.toThrow()
    }
  )
})
