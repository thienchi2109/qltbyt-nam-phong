import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule, sha256 } from "./database-quality-gate-test-support"

type BootstrapModule = {
  bootstrapSqlSha256: (content: string) => string
  canonicalizeBootstrapSql: (content: string) => string
  evaluateBootstrapAttestation: (input: {
    manifest: unknown
    oracleBaseline?: {
      accessSha256: string
      applicationSha256: string
      environmentSha256: string
    }
    restored?: {
      accessSha256: string
      applicationSha256: string
      environmentSha256: string
    }
  }) => {
    findings: Array<{
      classification: "BLOCKING" | "INCOMPLETE"
      ruleId: string
    }>
    outcome: "FAILED" | "INCOMPLETE" | "PASS"
  }
  inspectBootstrapArtifact: (input: {
    cutoverCommit: string
    legacy: Array<{ path: string; sha256: string }>
    manifest: unknown
    schemaSql: string | undefined
  }) => {
    artifact?: {
      content: string
      manifest: {
        artifact: {
          sha256: string
        }
      }
    }
    findings: Array<{
      ruleId: string
    }>
    outcome: "INCOMPLETE" | "PASS"
  }
  legacyInventoryDigest: (entries: Array<{ path: string; sha256: string }>) => string
  parseBootstrapManifest: (value: unknown) => unknown | undefined
}

const SUBJECT_COMMIT = "a".repeat(40)
const LEGACY = [
  {
    path: "supabase/migrations/20241220_add_completion_tracking.sql",
    sha256: sha256("CREATE TABLE public.completion_tracking (id bigint PRIMARY KEY);\n"),
  },
]

function bootstrapManifest(source: BootstrapModule, schemaSql: string) {
  const attestationFingerprints = {
    accessSha256: "a".repeat(64),
    applicationSha256: "b".repeat(64),
    environmentSha256: "c".repeat(64),
  }

  return {
    attestation: {
      live: attestationFingerprints,
      oracleBaseline: attestationFingerprints,
      status: "complete",
    },
    artifact: {
      path: "supabase/db-quality-gate-bootstrap.sql",
      sha256: source.bootstrapSqlSha256(schemaSql),
    },
    cutover: {
      commit: SUBJECT_COMMIT,
      legacyInventorySha256: source.legacyInventoryDigest(LEGACY),
      migrationRoot: "supabase/migrations",
    },
    schemaVersion: 1,
    scope: {
      deterministicSeeds: [],
      excludedData: ["application-data", "roles", "secrets", "users"],
      includedObjects: ["supabase-base-template", "application-owned-schema"],
    },
    source: {
      database: "qltbyt_test",
      dumpCommand: "pg_dump --schema-only",
      pgDumpVersion: "17.6",
      restrictKey: "a".repeat(64),
    },
  }
}

describe("database quality gate immutable bootstrap artifact", () => {
  it("canonicalizes only line endings and terminal line feeds before hashing", async () => {
    const source = await loadDatabaseQualityGateModule<BootstrapModule>("bootstrap")

    expect(source.canonicalizeBootstrapSql("CREATE TABLE public.example (); \r\n\r\n")).toBe(
      "CREATE TABLE public.example (); \n"
    )
    expect(source.bootstrapSqlSha256("CREATE TABLE public.example (); \r\n\r\n")).toBe(
      source.bootstrapSqlSha256("CREATE TABLE public.example (); \n")
    )
  })

  it("accepts a schema-only artifact bound to the exact cutover and legacy inventory", async () => {
    const source = await loadDatabaseQualityGateModule<BootstrapModule>("bootstrap")
    const schemaSql = "CREATE TABLE public.bootstrap_contract (id bigint PRIMARY KEY);\n"

    const result = source.inspectBootstrapArtifact({
      legacy: LEGACY,
      manifest: bootstrapManifest(source, schemaSql),
      schemaSql,
      cutoverCommit: SUBJECT_COMMIT,
    })

    expect(result).toMatchObject({
      artifact: {
        content: schemaSql,
      },
      findings: [],
      outcome: "PASS",
    })
  })

  it("fails closed when the manifest has a stale cutover, inventory, or SQL hash", async () => {
    const source = await loadDatabaseQualityGateModule<BootstrapModule>("bootstrap")
    const schemaSql = "CREATE TABLE public.bootstrap_contract (id bigint PRIMARY KEY);\n"

    const staleCutover = bootstrapManifest(source, schemaSql)
    staleCutover.cutover.commit = "b".repeat(40)
    const staleInventory = bootstrapManifest(source, schemaSql)
    staleInventory.cutover.legacyInventorySha256 = sha256("wrong inventory")
    const staleSql = bootstrapManifest(source, schemaSql)
    staleSql.artifact.sha256 = sha256("wrong SQL")

    for (const manifest of [staleCutover, staleInventory, staleSql]) {
      const result = source.inspectBootstrapArtifact({
        legacy: LEGACY,
        manifest,
        schemaSql,
        cutoverCommit: SUBJECT_COMMIT,
      })

      expect(result.outcome).toBe("INCOMPLETE")
      expect(result.artifact).toBeUndefined()
      expect(result.findings).toHaveLength(1)
    }
  })

  it("rejects malformed or scope-widened manifest metadata", async () => {
    const source = await loadDatabaseQualityGateModule<BootstrapModule>("bootstrap")
    const schemaSql = "CREATE TABLE public.bootstrap_contract (id bigint PRIMARY KEY);\n"
    const manifest = bootstrapManifest(source, schemaSql)

    expect(source.parseBootstrapManifest({ ...manifest, unexpected: true })).toBeUndefined()
    expect(
      source.parseBootstrapManifest({
        ...manifest,
        scope: {
          ...manifest.scope,
          excludedData: ["application-data"],
        },
      })
    ).toBeUndefined()
  })

  it("keeps the artifact incomplete until read-only reference attestation is complete", async () => {
    const source = await loadDatabaseQualityGateModule<BootstrapModule>("bootstrap")
    const schemaSql = "CREATE TABLE public.bootstrap_contract (id bigint PRIMARY KEY);\n"
    const manifest = bootstrapManifest(source, schemaSql)
    manifest.attestation = { status: "pending" }

    const result = source.inspectBootstrapArtifact({
      cutoverCommit: SUBJECT_COMMIT,
      legacy: LEGACY,
      manifest,
      schemaSql,
    })

    expect(result).toEqual({
      findings: [{ ruleId: "bootstrap.attestation" }],
      outcome: "INCOMPLETE",
    })
  })

  it("fails closed when required three-way attestation evidence is absent", async () => {
    const source = await loadDatabaseQualityGateModule<BootstrapModule>("bootstrap")
    const schemaSql = "CREATE TABLE public.bootstrap_contract (id bigint PRIMARY KEY);\n"

    const result = source.evaluateBootstrapAttestation({
      manifest: bootstrapManifest(source, schemaSql),
    })

    expect(result).toEqual({
      findings: [
        {
          classification: "INCOMPLETE",
          ruleId: "bootstrap.attestation.oracle-baseline",
        },
        {
          classification: "INCOMPLETE",
          ruleId: "bootstrap.attestation.restored",
        },
      ],
      outcome: "INCOMPLETE",
    })
  })

  it("blocks unexplained three-way structural fingerprint differences", async () => {
    const source = await loadDatabaseQualityGateModule<BootstrapModule>("bootstrap")
    const schemaSql = "CREATE TABLE public.bootstrap_contract (id bigint PRIMARY KEY);\n"
    const manifest = bootstrapManifest(source, schemaSql)
    const expected = manifest.attestation.oracleBaseline

    const result = source.evaluateBootstrapAttestation({
      manifest,
      oracleBaseline: expected,
      restored: {
        ...expected,
        applicationSha256: "f".repeat(64),
      },
    })

    expect(result).toEqual({
      findings: [
        {
          classification: "BLOCKING",
          ruleId: "bootstrap.attestation.restored-oracle-baseline",
        },
      ],
      outcome: "FAILED",
    })
  })
})
