import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const temporaryRepositories: string[] = []
const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, "../..")

export const DATABASE_QUALITY_GATE_MODULE_ROOT = path.join(
  REPOSITORY_ROOT,
  "scripts",
  "db-quality-gate"
)

export type FixtureRepository = {
  root: string
  path: (...segments: string[]) => string
}

export function canonicalTerminalNewline(content: string) {
  return content.endsWith("\n") ? content.slice(0, -1) : content
}

export function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex")
}

export function createFixtureRepository(files: Record<string, string>): FixtureRepository {
  const root = mkdtempSync(path.join(tmpdir(), "database-quality-gate-"))
  temporaryRepositories.push(root)

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.resolve(root, relativePath)
    const fixtureRoot = `${root}${path.sep}`

    if (!filePath.startsWith(fixtureRoot)) {
      throw new Error(`Fixture path escapes temporary repository: ${relativePath}`)
    }

    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, content)
  }

  return {
    root,
    path: (...segments) => path.join(root, ...segments),
  }
}

export function fixtureJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function cleanupFixtureRepositories() {
  for (const repository of temporaryRepositories.splice(0)) {
    rmSync(repository, { force: true, recursive: true })
  }
}

export function loadDatabaseQualityGateModule<T>(moduleName: string): Promise<T> {
  const modulePath = pathToFileURL(
    path.join(DATABASE_QUALITY_GATE_MODULE_ROOT, `${moduleName}.ts`)
  ).href
  return import(modulePath) as Promise<T>
}
