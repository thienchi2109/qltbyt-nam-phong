import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

interface KnipTypeFinding {
  file: string
  symbol: string
}

interface IntentionalPublicType {
  file: string
  symbol: string
  reason: string
}

const intentionalPublicTypes = [
  {
    file: "src/app/(app)/reports/hooks/use-maintenance-data.types.ts",
    symbol: "RepairUsageCostCorrelationScope",
    reason:
      "Imported by use-maintenance-data.types.assert.ts to lock the report chart contract.",
  },
] as const satisfies readonly IntentionalPublicType[]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const getTypeName = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value
  }

  if (isRecord(value) && typeof value.name === "string") {
    return value.name
  }

  return null
}

const getKnipTypeFindings = (): KnipTypeFinding[] => {
  const knipBin = join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "knip.cmd" : "knip",
  )
  const result = spawnSync(
    knipBin,
    ["--reporter", "json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      maxBuffer: 1024 * 1024 * 20,
    },
  )

  if (!result.stdout) {
    throw new Error(result.stderr || "knip did not emit JSON output")
  }

  const parsed: unknown = JSON.parse(result.stdout)
  const issues = isRecord(parsed) && Array.isArray(parsed.issues) ? parsed.issues : []

  return issues.flatMap((issue) => {
    if (!isRecord(issue) || typeof issue.file !== "string" || !Array.isArray(issue.types)) {
      return []
    }

    return issue.types.flatMap((typeIssue) => {
      const symbol = getTypeName(typeIssue)
      return symbol === null ? [] : [{ file: issue.file, symbol }]
    })
  })
}

const findingKey = (finding: Pick<KnipTypeFinding, "file" | "symbol">): string =>
  `${finding.file}#${finding.symbol}`

describe("React Doctor P4 knip/types cleanup", () => {
  it("has no actionable unused exported type findings", () => {
    const intentionalTypeKeys = new Set(intentionalPublicTypes.map(findingKey))
    const actionableFindings = getKnipTypeFindings().filter(
      (finding) => !intentionalTypeKeys.has(findingKey(finding)),
    )

    expect(actionableFindings).toEqual([])
  }, 30_000)

  it("documents every intentionally retained public type", () => {
    for (const finding of intentionalPublicTypes) {
      expect(finding.reason.trim().length).toBeGreaterThan(0)
    }
  })
})
