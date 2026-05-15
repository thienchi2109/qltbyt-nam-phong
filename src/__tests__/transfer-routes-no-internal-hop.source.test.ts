import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const projectRoot = process.cwd()
const sourceRoot = join(projectRoot, "src")
const legacyEndpoints = ["/api/transfers/list", "/api/transfers/counts"]
const legacyWrappers = [
  "fetchTransferList",
  "fetchTransferCounts",
  "useTransferList",
  "useTransferCounts",
  "usePrefetchTransferList",
  "usePrefetchTransferCounts",
]

const walkSourceFiles = (dir: string): string[] => {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    const stat = statSync(path)

    if (stat.isDirectory()) {
      return walkSourceFiles(path)
    }

    return /\.(ts|tsx)$/.test(entry) ? [path] : []
  })
}

describe("transfer data routes", () => {
  it("does not keep legacy routes that self-fetch through the RPC proxy", () => {
    expect(existsSync(join(projectRoot, "src/app/api/transfers/list/route.ts"))).toBe(false)
    expect(existsSync(join(projectRoot, "src/app/api/transfers/counts/route.ts"))).toBe(false)
  })

  it("does not fetch legacy transfer list/count endpoints from source code", () => {
    const offenders = walkSourceFiles(sourceRoot)
      .filter((path) => path !== __filename)
      .flatMap((path) => {
        const source = readFileSync(path, "utf8")
        return legacyEndpoints
          .filter((needle) => source.includes(needle))
          .map((needle) => `${relative(projectRoot, path)} contains ${needle}`)
      })

    expect(offenders).toEqual([])
  })

  it("does not keep legacy transfer list/count hook wrappers", () => {
    const offenders = walkSourceFiles(sourceRoot)
      .filter((path) => path !== __filename)
      .flatMap((path) => {
        const source = readFileSync(path, "utf8")
        return legacyWrappers
          .filter((needle) => source.includes(needle))
          .map((needle) => `${relative(projectRoot, path)} contains ${needle}`)
      })

    expect(offenders).toEqual([])
  })
})
