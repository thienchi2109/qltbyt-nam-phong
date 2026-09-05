import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { validConfirmation } from "../db-quality-gate/baseline-state"
import {
  metadataStatement,
  migrationMetadataStatusQuery,
} from "../db-quality-gate/oracle-baseline-metadata"
import { observationMatches } from "../db-quality-gate/baseline-observation"
import { stableJsonSha256 } from "../db-quality-gate/serialization"
import { readManifestMigrationInputs } from "../db-quality-gate/baseline-maintenance-operations"
import * as gitEvidence from "../db-quality-gate/git-evidence"

const identity = {
  liveName: "20260831120000_device_quota_regulatory_catalog_foundation",
  liveVersion: "20260831141415",
  path: "supabase/migrations/20260831120000_device_quota_regulatory_catalog_foundation.sql",
  sha256: "eba9dad8b8ec092405ed6beb2ff2e8c6e32123f1a7e541c205798c721fcba780",
}

describe("reviewed live SQL identity", () => {
  afterEach(() => vi.restoreAllMocks())
  it("accepts the exact reviewed identity without accepting arbitrary name or source changes", () => {
    expect(validConfirmation(identity)).toBe(true)
    expect(validConfirmation({ ...identity, sha256: "a".repeat(64) })).toBe(false)
    expect(validConfirmation({ ...identity, liveVersion: "20260831141416" })).toBe(false)
  })

  it("requires original live SQL for metadata instead of relabelling canonical SQL", () => {
    const content = readFileSync("supabase/db-quality-gate-live-sql/20260831141415.sql", "utf8")
    const migration = { ...identity, content }
    expect(metadataStatement(migration)).toContain(identity.liveName)
    expect(migrationMetadataStatusQuery(migration)).toContain(
      "da4ebe2c8b596c8078adbb6e80bf674349dcc6b1d88370989ab46281f392c746"
    )
    expect(
      metadataStatement({ ...migration, content: readFileSync(identity.path, "utf8") })
    ).toBeUndefined()
    expect(metadataStatement({ ...migration, content: content + "-- tampered" })).toBeUndefined()
  })

  it("matches observed live SQL rather than the source hash", () => {
    const expected = {
      confirmedMigrations: [identity],
      catalogSha256: stableJsonSha256([]),
      technicalConfigurationCatalog: [],
    }
    const observed = {
      ...expected,
      healthy: true as const,
      invalidIndexCount: 0,
      unvalidatedConstraintCount: 0,
      postgresHasCreateOnPublic: false,
      migrationHighWater: identity.liveVersion,
      migrationRecords: [
        {
          liveName: identity.liveName,
          liveVersion: identity.liveVersion,
          sqlSha256: "da4ebe2c8b596c8078adbb6e80bf674349dcc6b1d88370989ab46281f392c746",
        },
      ],
    }
    expect(observationMatches(observed, expected)).toBe(true)
    observed.migrationRecords[0].sqlSha256 = identity.sha256
    expect(observationMatches(observed, expected)).toBe(false)
  })

  it("verifies both immutable source and archived live SQL before maintenance", () => {
    const read = vi
      .spyOn(gitEvidence, "readFileAtCommit")
      .mockImplementation((_root, _commit, file) => readFileSync(file, "utf8"))
    const input = {
      repositoryRoot: process.cwd(),
      manifest: {
        schemaVersion: 1 as const,
        sourceCommit: "a".repeat(40),
        targetMigrationHighWater: identity.liveVersion,
        migrations: [identity],
        catalogSha256: stableJsonSha256([]),
        technicalConfigurationCatalog: [],
      },
    }
    const result = readManifestMigrationInputs(input)
    expect(result?.[0].sha256).toBe(identity.sha256)
    expect(result?.[0].content).toBe(
      readFileSync("supabase/db-quality-gate-live-sql/20260831141415.sql", "utf8").replace(
        /\n$/,
        ""
      )
    )
    read.mockImplementation((_root, _commit, file) =>
      file === identity.path ? "SELECT 1;" : readFileSync(file, "utf8")
    )
    expect(readManifestMigrationInputs(input)).toBeUndefined()
    read.mockImplementation((_root, _commit, file) =>
      file === identity.path ? readFileSync(file, "utf8") : undefined
    )
    expect(readManifestMigrationInputs(input)).toBeUndefined()
  })
})
