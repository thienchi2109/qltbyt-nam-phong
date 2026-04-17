import * as fs from "fs"
import * as path from "path"

import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")
const srcRoot = path.join(repoRoot, "src")

const legacyFirebaseFiles = [
  "src/lib/firebase-utils.tsx",
  "src/lib/firebase.ts",
  "src/app/api/firebase/config/route.ts",
  "public/firebase-messaging-sw.js",
] as const

function collectRuntimeSourceFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  return entries.flatMap((entry) => {
    const absolutePath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === "__tests__") {
        return []
      }

      return collectRuntimeSourceFiles(absolutePath)
    }

    if (!absolutePath.endsWith(".ts") && !absolutePath.endsWith(".tsx")) {
      return []
    }

    return [absolutePath]
  })
}

function readRuntimeSources() {
  return collectRuntimeSourceFiles(srcRoot).map((filePath) => ({
    filePath,
    relativePath: path.relative(repoRoot, filePath),
    source: fs.readFileSync(filePath, "utf-8"),
  }))
}

describe("legacy firebase runtime audit", () => {
  it("does not import the legacy firebase helper modules from runtime source", () => {
    const offenders = readRuntimeSources()
      .filter(({ source }) => source.includes("firebase-utils") || source.includes("@/lib/firebase"))
      .map(({ relativePath }) => relativePath)

    expect(offenders).toEqual([])
  })

  it("does not register the legacy firebase messaging service worker", () => {
    const offenders = readRuntimeSources()
      .filter(({ source }) => source.includes("/firebase-messaging-sw.js"))
      .map(({ relativePath }) => relativePath)

    expect(offenders).toEqual([])
  })

  it("removes the legacy firebase client scaffold files from the shipped app", () => {
    const existingFiles = legacyFirebaseFiles.filter((relativePath) =>
      fs.existsSync(path.join(repoRoot, relativePath)),
    )

    expect(existingFiles).toEqual([])
  })
})
