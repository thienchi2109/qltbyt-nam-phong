import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const obsoleteMappingFiles = [
  "page.tsx",
  "_components/DeviceQuotaCategoryTree.tsx",
  "_components/DeviceQuotaMappingActions.tsx",
  "_components/DeviceQuotaMappingContext.tsx",
  "_components/DeviceQuotaMappingGuide.tsx",
  "_components/DeviceQuotaMappingTypes.ts",
  "_components/DeviceQuotaUnassignedList.tsx",
  "_hooks/useDeviceQuotaMappingContext.ts",
] as const
const mappingRoot = join(process.cwd(), "src/app/(app)/device-quota/mapping")
const removedMappingRoutePattern = /["'`]\/device-quota\/mapping(?=["'`/?#])/

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) return listSourceFiles(entryPath)
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) return []

    return [entryPath]
  })
}

describe("Device Quota Mapping route removal", () => {
  it.each([
    '"/device-quota/mapping"',
    '"/device-quota/mapping/"',
    '"/device-quota/mapping?facility=123"',
    '"/device-quota/mapping#unassigned"',
  ])("detects removed route variants in source: %s", (source) => {
    expect(source).toMatch(removedMappingRoutePattern)
  })

  it("leaves /device-quota/mapping without a page or compatibility redirect", () => {
    for (const relativePath of obsoleteMappingFiles) {
      expect(existsSync(join(mappingRoot, relativePath)), relativePath).toBe(false)
    }

    const unexpectedRouteFiles = listSourceFiles(mappingRoot).filter(
      (file) => !file.includes("/_components/") && !file.includes("/__tests__/")
    )

    expect(unexpectedRouteFiles).toEqual([])
  })

  it("removes the legacy route-only mutation hook while retaining shared helpers", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingMutations.ts"
      ),
      "utf8"
    )

    expect(source).not.toContain("useLinkEquipmentMutation")
    expect(source).toContain("linkDeviceQuotaEquipment")
    expect(source).toContain("invalidateDeviceQuotaLinkQueries")
  })

  it("leaves no source or focused test expecting the removed Mapping page", () => {
    const currentTestPath = join(
      process.cwd(),
      "src/app/(app)/device-quota/__tests__/DeviceQuotaMappingRouteRemoval.test.ts"
    )
    const references = listSourceFiles(join(process.cwd(), "src"))
      .filter((file) => file !== currentTestPath)
      .filter((file) => removedMappingRoutePattern.test(readFileSync(file, "utf8")))

    expect(references).toEqual([])

    for (const routingConfigPath of ["next.config.ts", "src/middleware.ts"]) {
      expect(readFileSync(join(process.cwd(), routingConfigPath), "utf8")).not.toMatch(
        removedMappingRoutePattern
      )
    }
  })
})
