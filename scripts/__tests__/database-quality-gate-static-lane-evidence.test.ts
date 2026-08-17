import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import {
  canonicalTerminalNewline,
  cleanupFixtureRepositories,
  createFixtureRepository,
  fixtureJson,
  loadDatabaseQualityGateModule,
  sha256,
} from "./database-quality-gate-test-support"
import {
  appliedLock,
  BASELINE_PATH,
  commitFixtureRepository,
  commitWorkingTree,
  dangerousApproval,
  fixtureWithStaticMetadata,
  identityBaseline,
  migration,
  repositoryHead,
  runStatic,
  StaticLaneModule,
  WAIVERS_PATH,
} from "./database-quality-gate-static-test-support"

afterEach(cleanupFixtureRepositories)

describe("database quality gate static lane evidence binding", () => {
  it("does not bind a dirty gate harness to HEAD evidence", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)
    const harnessDirectory = repository.path("scripts", "db-quality-gate")
    mkdirSync(harnessDirectory, { recursive: true })
    writeFileSync(
      repository.path("scripts", "db-quality-gate", "uncommitted-static-rule.ts"),
      "export const changedRule = true\n"
    )

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "harness.subject-input" })
    )
  })

  it("does not bind a dirty changed-file discovery helper to HEAD evidence", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)
    writeFileSync(
      repository.path("scripts", "changed-files.js"),
      "module.exports = { collectChangedFiles: () => [] }\n"
    )

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "harness.subject-input" })
    )
  })

  it("does not bind an unrelated dirty waiver registry to HEAD evidence", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)
    writeFileSync(repository.path(WAIVERS_PATH), '{"schemaVersion":1,"approvals":[]}\n')

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "registry.waivers.evidence" })
    )
  })

  it("returns a deterministic incomplete report when changed-file discovery cannot resolve the base", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)

    const result = source.runStaticLane({
      baseRef: "missing-base",
      createdAt: "2026-08-16T15:00:00Z",
      repositoryRoot: repository.root,
      runId: "missing-base-discovery",
      subjectCommit: repositoryHead(repository.root),
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.changed-file-discovery" })
    )
  })

  it("requires the baseline evidence source commit to resolve in current ancestry", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)
    const baseline = JSON.parse(readFileSync(repository.path(BASELINE_PATH), "utf8")) as Record<
      string,
      unknown
    >
    baseline.sourceCommit = "f".repeat(40)
    writeFileSync(repository.path(BASELINE_PATH), fixtureJson(baseline))
    commitWorkingTree(repository.root, "commit untrusted baseline source")

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "baseline.identity.evidence" })
    )
  })

  it("blocks a changed lock that rewrites the history committed at the base ref", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const legacy = migration(
      "CREATE TABLE public.protected_legacy (id bigint PRIMARY KEY);\n",
      "supabase/migrations/20241220_protected_legacy.sql"
    )
    const lock = appliedLock()
    lock.legacy.push({
      path: legacy.path,
      sha256: sha256(canonicalTerminalNewline(legacy.sql)),
    })
    const repository = createFixtureRepository({
      "supabase/applied-migrations.lock.json": fixtureJson(lock),
      [BASELINE_PATH]: fixtureJson(identityBaseline()),
      [WAIVERS_PATH]: fixtureJson({ approvals: [], schemaVersion: 1 }),
      [legacy.path]: legacy.sql,
    })
    const baseRef = commitFixtureRepository(repository.root)
    writeFileSync(
      repository.path("supabase", "applied-migrations.lock.json"),
      fixtureJson(appliedLock())
    )

    const result = runStatic(
      source,
      repository.root,
      ["supabase/applied-migrations.lock.json"],
      baseRef
    )

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.lock-history",
      })
    )
  })

  it("blocks a waiver history that removes prior approval evidence from the base ref", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)
    writeFileSync(
      repository.path(WAIVERS_PATH),
      fixtureJson({ approvals: [dangerousApproval()], schemaVersion: 1 })
    )
    const baseRef = commitFixtureRepository(repository.root)
    writeFileSync(repository.path(WAIVERS_PATH), fixtureJson({ approvals: [], schemaVersion: 1 }))

    const result = runStatic(source, repository.root, [WAIVERS_PATH], baseRef)

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "registry.waivers.append-only",
      })
    )
  })
})
