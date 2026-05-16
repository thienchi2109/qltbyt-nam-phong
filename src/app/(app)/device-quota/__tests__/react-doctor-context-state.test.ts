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

  let parenDepth = 0
  let sawOpenParen = false
  let bodyStart = -1
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (char === "(") {
      sawOpenParen = true
      parenDepth += 1
      continue
    }
    if (char === ")" && parenDepth > 0) {
      parenDepth -= 1
      continue
    }
    if (char === "{" && sawOpenParen && parenDepth === 0) {
      bodyStart = index
      break
    }
  }
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
  const effectPattern = /(?:React\.)?useEffect\s*\(/g

  for (const match of source.matchAll(effectPattern)) {
    const effectStart = match.index
    expect(effectStart).toBeGreaterThanOrEqual(0)

    const arrowStart = source.indexOf("=>", effectStart)
    expect(arrowStart).toBeGreaterThan(effectStart)
    const bodyStart = source.indexOf("{", arrowStart)
    expect(bodyStart).toBeGreaterThan(arrowStart)
    let depth = 0
    for (let index = bodyStart; index < source.length; index += 1) {
      const char = source[index]
      if (char === "{") depth += 1
      if (char === "}") depth -= 1
      if (depth === 0) {
        bodies.push(source.slice(bodyStart + 1, index))
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

    expect(providerSource).toMatch(/\b(?:React\.)?useReducer\s*\(/)
    expect(providerSource.match(/\b(?:React\.)?useState\s*\(/g) ?? []).toHaveLength(0)
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
