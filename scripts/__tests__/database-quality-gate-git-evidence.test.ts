import { execFileSync } from "node:child_process"

import { describe, expect, it } from "vitest"

import {
  createFixtureRepository,
  loadDatabaseQualityGateModule,
} from "./database-quality-gate-test-support"

type GitEvidenceModule = {
  readFileAtCommit: (
    repositoryRoot: string,
    commit: string,
    relativePath: string
  ) => string | undefined
}

describe("database quality gate Git evidence", () => {
  it("reads committed migration evidence above the Node default exec buffer", async () => {
    const repository = createFixtureRepository({
      "supabase/migrations/20270101000000_large_evidence.sql": `${"x".repeat(1_100_000)}\n`,
    })

    execFileSync("git", ["init", "--quiet"], { cwd: repository.root })
    execFileSync("git", ["add", "supabase/migrations/20270101000000_large_evidence.sql"], {
      cwd: repository.root,
    })
    execFileSync(
      "git",
      [
        "-c",
        "user.email=database-quality-gate@example.test",
        "-c",
        "user.name=Database Quality Gate",
        "commit",
        "--quiet",
        "-m",
        "add migration evidence",
      ],
      { cwd: repository.root }
    )

    const evidence = await loadDatabaseQualityGateModule<GitEvidenceModule>("git-evidence")

    expect(
      evidence.readFileAtCommit(
        repository.root,
        "HEAD",
        "supabase/migrations/20270101000000_large_evidence.sql"
      )
    ).toHaveLength(1_100_001)
  })
})
