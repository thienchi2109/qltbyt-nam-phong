import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"

const repositoryRoot = resolve(__dirname, "../..")

function repositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8")
}

describe("database quality gate local repository wiring", () => {
  it("exposes one package command for the local migration gate", () => {
    const packageJson = JSON.parse(repositoryFile("package.json")) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.["db:quality-gate:local"]).toBe(
      "node scripts/db-quality-gate/run-local-migration-gate.cjs"
    )
  })

  it("runs after commit for immediate feedback and before push for enforcement", () => {
    const lefthook = repositoryFile("lefthook.yml")
    const commandNameCount = lefthook.match(/db-quality-gate-local:/g)?.length ?? 0
    const commandCount =
      lefthook.match(/node scripts\/npm-run\.js run db:quality-gate:local/g)?.length ?? 0
    const preCommit = lefthook.slice(
      lefthook.indexOf("pre-commit:"),
      lefthook.indexOf("post-commit:")
    )

    expect(commandNameCount).toBe(2)
    expect(commandCount).toBe(2)
    expect(preCommit).not.toContain("db-quality-gate-local")
    expect(lefthook).toMatch(/post-commit:[\s\S]*db-quality-gate-local:/)
    expect(lefthook).toMatch(/pre-push:[\s\S]*db-quality-gate-local:/)
  })

  it("hard-codes a static-only command with no live DB write surface", () => {
    const wrapper = repositoryFile("scripts/db-quality-gate/local-migration-gate.ts")
    const bootstrap = repositoryFile("scripts/db-quality-gate/run-local-migration-gate.cjs")
    const localCommand = `${wrapper}\n${bootstrap}`

    expect(wrapper).toContain('runDatabaseQualityGateCommand(["--lane", "static"])')
    expect(bootstrap).not.toContain("process.argv")
    expect(localCommand).not.toMatch(
      /apply_migration|execute_sql|supabase db|ORACLE_DATABASE_QUALITY_GATE|live write/i
    )
  })

  it("returns concise INCOMPLETE output when the launcher cannot bootstrap", () => {
    const fixtureRoot = mkdtempSync(resolve(tmpdir(), "db-quality-gate-launcher-"))
    const fixtureLauncher = resolve(fixtureRoot, "run-local-migration-gate.cjs")
    copyFileSync(
      resolve(repositoryRoot, "scripts/db-quality-gate/run-local-migration-gate.cjs"),
      fixtureLauncher
    )

    try {
      const result = spawnSync(process.execPath, [fixtureLauncher], {
        encoding: "utf8",
      })

      expect(result.status).toBe(2)
      expect(result.stdout).toContain("[db-quality-gate] INCOMPLETE")
      expect(result.stdout).toContain("local gate bootstrap failed")
      expect(result.stderr).toBe("")
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  })

  it("documents local static enforcement and the manual Oracle boundary", () => {
    const agents = repositoryFile("AGENTS.md")
    const claude = repositoryFile("CLAUDE.md")
    const oracleRunbook = repositoryFile("docs/runbooks/db-quality-gate-oracle.md")

    for (const instructions of [agents, claude]) {
      expect(instructions).toContain("db:quality-gate:local")
      expect(instructions).toContain("Lefthook")
      expect(instructions).toContain("manual Oracle")
      expect(instructions).not.toContain("GitHub-hosted CI runs secret-free static checks")
    }
    expect(oracleRunbook).toContain("## Local static gate")
    expect(oracleRunbook).toContain("node scripts/npm-run.js run db:quality-gate:local")
    expect(oracleRunbook).toContain("does not run baseline-forward")
  })
})
