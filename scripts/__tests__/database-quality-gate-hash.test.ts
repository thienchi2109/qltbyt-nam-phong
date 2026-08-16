import { describe, expect, it } from "vitest"

import {
  canonicalTerminalNewline,
  loadDatabaseQualityGateModule,
  sha256,
} from "./database-quality-gate-test-support"

type MigrationSourceModule = {
  canonicalizeMigrationContent: (content: string) => string
  migrationContentSha256: (content: string) => string
}

describe("database quality gate migration content hashing", () => {
  it("removes exactly one optional terminal newline before hashing", async () => {
    const source = await loadDatabaseQualityGateModule<MigrationSourceModule>("migration-source")
    const withoutTerminalNewline = "SELECT 1;"
    const withTerminalNewline = `${withoutTerminalNewline}\n`

    expect(source.canonicalizeMigrationContent(withoutTerminalNewline)).toBe(
      canonicalTerminalNewline(withoutTerminalNewline)
    )
    expect(source.canonicalizeMigrationContent(withTerminalNewline)).toBe(
      canonicalTerminalNewline(withTerminalNewline)
    )
    expect(source.migrationContentSha256(withoutTerminalNewline)).toBe(
      sha256(canonicalTerminalNewline(withoutTerminalNewline))
    )
    expect(source.migrationContentSha256(withTerminalNewline)).toBe(
      source.migrationContentSha256(withoutTerminalNewline)
    )
  })

  it("preserves every byte beyond one terminal newline", async () => {
    const source = await loadDatabaseQualityGateModule<MigrationSourceModule>("migration-source")
    const canonical = "SELECT 1;"
    const twoTerminalNewlines = `${canonical}\n\n`
    const windowsTerminalNewline = `${canonical}\r\n`

    expect(source.canonicalizeMigrationContent(twoTerminalNewlines)).toBe(`${canonical}\n`)
    expect(source.migrationContentSha256(twoTerminalNewlines)).not.toBe(
      source.migrationContentSha256(canonical)
    )
    expect(source.migrationContentSha256(windowsTerminalNewline)).not.toBe(
      source.migrationContentSha256(`${canonical}\n`)
    )
  })

  it("changes the SHA-256 digest when SQL content changes", async () => {
    const source = await loadDatabaseQualityGateModule<MigrationSourceModule>("migration-source")
    const first = "CREATE TABLE public.example (id bigint PRIMARY KEY);"
    const second = "CREATE TABLE public.example (id bigint PRIMARY KEY, name text);"

    expect(source.migrationContentSha256(first)).toMatch(/^[a-f0-9]{64}$/)
    expect(source.migrationContentSha256(first)).not.toBe(source.migrationContentSha256(second))
  })
})
