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

describe("database quality gate static lane orchestration", () => {
  it("remains incomplete before a cutover lock exists without writing bootstrap metadata", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = createFixtureRepository({
      [BASELINE_PATH]: fixtureJson(identityBaseline()),
      [WAIVERS_PATH]: fixtureJson({ approvals: [], schemaVersion: 1 }),
      [candidate.path]: candidate.sql,
    })

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(existsSync(repository.path("supabase", "applied-migrations.lock.json"))).toBe(false)
  })

  it("pins unchanged legacy hygiene debt to an identity baseline without blocking an unrelated migration", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const legacy = migration(
      "CREATE TABLE public.legacy_debt (id bigint);\n",
      "supabase/migrations/20241220_legacy.sql"
    )
    const candidate = migration(
      "-- migration\nBEGIN;\nCREATE TABLE public.ready (id bigint);\nREVOKE ALL ON TABLE public.ready FROM anon, authenticated, public;\nCOMMIT;\n"
    )
    const repository = fixtureWithStaticMetadata(legacy, candidate)

    const unbaselined = runStatic(source, repository.root, [candidate.path])

    expect(unbaselined.outcome).toBe("FAILED")
    expect(unbaselined.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "baseline.identity.new-findings",
      })
    )

    const historicalWarningIdentities = unbaselined.findings
      .filter((finding) => finding.classification === "WARNING")
      .map(({ classification, fingerprint, ruleId }) => ({ classification, fingerprint, ruleId }))

    expect(historicalWarningIdentities).not.toEqual([])
    writeFileSync(
      repository.path(BASELINE_PATH),
      fixtureJson({
        evidence: "Reviewed legacy hygiene baseline.",
        findings: historicalWarningIdentities,
        schemaVersion: 1,
        sourceCommit: repositoryHead(repository.root),
      })
    )
    commitWorkingTree(repository.root, "pin legacy hygiene baseline")

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("PASS")
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "WARNING",
        }),
      ])
    )
  })

  it("maps protected migration-content failures into blocking static findings", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const legacy = migration(
      "CREATE TABLE public.protected_legacy (id bigint PRIMARY KEY, note text);\n",
      "supabase/migrations/20241220_protected_legacy.sql"
    )
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const lock = appliedLock()
    lock.legacy.push({
      path: legacy.path,
      sha256: sha256("CREATE TABLE public.protected_legacy (id bigint PRIMARY KEY);\n"),
    })
    const repository = createFixtureRepository({
      "supabase/applied-migrations.lock.json": fixtureJson(lock),
      [BASELINE_PATH]: fixtureJson(identityBaseline()),
      [WAIVERS_PATH]: fixtureJson({ approvals: [], schemaVersion: 1 }),
      [candidate.path]: candidate.sql,
      [legacy.path]: legacy.sql,
    })

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.legacy-content",
      })
    )
  })

  it("is incomplete when changed lock history cannot be read from the base ref", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)

    const result = runStatic(
      source,
      repository.root,
      [candidate.path, "supabase/applied-migrations.lock.json"],
      "missing-base"
    )

    expect(result.outcome).toBe("INCOMPLETE")
  })

  it("is incomplete when a valid base ref lacks a changed protection artifact", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = createFixtureRepository({
      [BASELINE_PATH]: fixtureJson(identityBaseline()),
      [candidate.path]: candidate.sql,
    })
    const baseRef = commitFixtureRepository(repository.root)
    writeFileSync(
      repository.path("supabase", "applied-migrations.lock.json"),
      fixtureJson(appliedLock())
    )
    writeFileSync(repository.path(WAIVERS_PATH), fixtureJson({ approvals: [], schemaVersion: 1 }))

    const result = runStatic(
      source,
      repository.root,
      ["supabase/applied-migrations.lock.json", WAIVERS_PATH],
      baseRef
    )

    expect(result.outcome).toBe("INCOMPLETE")
  })

  it("is incomplete when the committed identity baseline is absent", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = createFixtureRepository({
      "supabase/applied-migrations.lock.json": fixtureJson(appliedLock()),
      [WAIVERS_PATH]: fixtureJson({ approvals: [], schemaVersion: 1 }),
      [candidate.path]: candidate.sql,
    })

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
  })

  it("does not trust a worktree-only identity baseline mutation", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)
    const mutatedBaseline = JSON.parse(
      readFileSync(repository.path(BASELINE_PATH), "utf8")
    ) as Record<string, unknown>
    mutatedBaseline.evidence = "Unreviewed working tree mutation."
    writeFileSync(repository.path(BASELINE_PATH), fixtureJson(mutatedBaseline))

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "baseline.identity.evidence" })
    )
  })

  it("does not bind a dirty canonical migration worktree to HEAD evidence", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)
    writeFileSync(repository.path(candidate.path), "-- migration\nBEGIN;\nSELECT 2;\nCOMMIT;\n")

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.subject-input" })
    )
  })

  it("does not bind a dirty applied lock to HEAD evidence", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration("-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)
    const lockPath = repository.path("supabase", "applied-migrations.lock.json")
    writeFileSync(lockPath, `${readFileSync(lockPath, "utf8")}\n`)

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.applied-lock-evidence" })
    )
  })
})
