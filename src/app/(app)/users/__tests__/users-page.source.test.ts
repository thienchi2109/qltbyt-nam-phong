import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const usersRouteDir = path.resolve(__dirname, "..")
const pagePath = path.join(usersRouteDir, "page.tsx")

function readSource(filePath: string) {
  return fs.readFileSync(filePath, "utf8")
}

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return collectSourceFiles(fullPath)
      return fullPath.endsWith(".ts") || fullPath.endsWith(".tsx") ? [fullPath] : []
    })
}

describe("users page source structure", () => {
  it("keeps the route file below the repository hard ceiling", () => {
    const lineCount = readSource(pagePath).split(/\r?\n/).length

    expect(lineCount).toBeLessThan(450)
  })

  it("uses the shared authenticated page boundary instead of redirecting locally", () => {
    const source = readSource(pagePath)

    expect(source).toContain("AuthenticatedPageBoundary")
    expect(source).not.toContain("window.location.href")
  })

  it("does not reintroduce direct nhan_vien table access in users route modules", () => {
    const routeSource = collectSourceFiles(usersRouteDir)
      .filter((filePath) => !filePath.includes(`${path.sep}__tests__${path.sep}`))
      .map(readSource)
      .join("\n")

    expect(routeSource).not.toContain('.from("nhan_vien")')
    expect(routeSource).not.toContain(".from('nhan_vien')")
  })
})
