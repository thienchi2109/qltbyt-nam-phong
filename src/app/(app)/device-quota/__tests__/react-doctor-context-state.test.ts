import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

function extractFunctionSource(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)

  const signatureEnd = source.indexOf(") {", start)
  expect(signatureEnd).toBeGreaterThan(start)

  const bodyStart = signatureEnd + 2
  expect(bodyStart).toBeGreaterThan(start)

  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index]
    if (char === "{") depth += 1
    if (char === "}") depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }

  throw new Error(`Could not extract ${functionName}`)
}

function extractEffectBodies(source: string): string[] {
  const bodies: string[] = []
  let searchStart = 0

  while (searchStart < source.length) {
    const effectStart = source.indexOf("React.useEffect(() => {", searchStart)
    if (effectStart === -1) return bodies

    const bodyStart = source.indexOf("{", effectStart)
    let depth = 0
    for (let index = bodyStart; index < source.length; index += 1) {
      const char = source[index]
      if (char === "{") depth += 1
      if (char === "}") depth -= 1
      if (depth === 0) {
        bodies.push(source.slice(bodyStart + 1, index))
        searchStart = index + 1
        break
      }
    }
  }

  return bodies
}

describe("device quota context React Doctor state guards", () => {
  it("keeps category provider UI state in a reducer instead of scattered useState calls", () => {
    const source = readSource(
      "src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext.tsx"
    )
    const providerSource = extractFunctionSource(source, "DeviceQuotaCategoryProvider")

    expect(providerSource).toContain("React.useReducer")
    expect(providerSource.match(/React\.useState/g) ?? []).toHaveLength(0)
  })

  it("keeps mapping effects to at most one state mutation per effect", () => {
    const source = readSource(
      "src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingContext.tsx"
    )
    const effectBodies = extractEffectBodies(source)

    expect(effectBodies.length).toBeGreaterThan(0)
    for (const body of effectBodies) {
      const stateMutationCount =
        (body.match(/\bset[A-Z][A-Za-z0-9_]*\(/g) ?? []).length +
        (body.match(/resetToFirstPage\(/g) ?? []).length

      expect(stateMutationCount).toBeLessThanOrEqual(1)
    }
  })
})
