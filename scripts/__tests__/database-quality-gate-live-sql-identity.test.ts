import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseBaselineManifest } from "../db-quality-gate/baseline-manifest"
import { validConfirmation } from "../db-quality-gate/baseline-state"
import {
  metadataStatement,
  migrationMetadataStatusQuery,
} from "../db-quality-gate/oracle-baseline-metadata"
import { observationMatches } from "../db-quality-gate/baseline-observation"
import { stableJsonSha256 } from "../db-quality-gate/serialization"
import { readManifestMigrationInputs } from "../db-quality-gate/baseline-maintenance-operations"
import * as gitEvidence from "../db-quality-gate/git-evidence"
import { migrationContentSha256 } from "../db-quality-gate/migration-source"
import {
  confirmedLiveSqlSha256,
  reviewedLiveSqlIdentity,
} from "../db-quality-gate/live-sql-identity"

const identity = {
  liveName: "20260831120000_device_quota_regulatory_catalog_foundation",
  liveVersion: "20260831141415",
  path: "supabase/migrations/20260831120000_device_quota_regulatory_catalog_foundation.sql",
  sha256: "eba9dad8b8ec092405ed6beb2ff2e8c6e32123f1a7e541c205798c721fcba780",
}

const phase45Mappings = [
  {
    liveName: "20260913020000_web_push_recipient_config_phase45",
    liveVersion: "20260913094624",
    path: "supabase/migrations/20260913020000_web_push_recipient_config_phase45.sql",
    sha256: "6466cfc8cc29bf88c389c9c7884b03cd263b9db7f549d4f79e1658e350151ef9",
    liveSqlSha256: "6466cfc8cc29bf88c389c9c7884b03cd263b9db7f549d4f79e1658e350151ef9",
  },
  {
    liveName: "20260913020100_web_push_enqueue_recipient_eligibility",
    liveVersion: "20260913094625",
    path: "supabase/migrations/20260913020100_web_push_enqueue_recipient_eligibility.sql",
    sha256: "2460048b13ceceb7dae2b7b51dc6deb5bafe6269b1632f31f8ba478fa18cb396",
    liveSqlSha256: "2460048b13ceceb7dae2b7b51dc6deb5bafe6269b1632f31f8ba478fa18cb396",
  },
  {
    liveName: "web_push_claim_recipient_eligibility_retry_20260913",
    liveVersion: "20260913094634",
    path: "supabase/migrations/20260913020200_web_push_claim_recipient_eligibility.sql",
    sha256: "1113905a63d5f45e4fb8c2ecb5a8f29c19260e934326a4527afb4d6498d57585",
    liveSqlSha256: "1113905a63d5f45e4fb8c2ecb5a8f29c19260e934326a4527afb4d6498d57585",
  },
] as const

const phase45Manifest = {
  catalogSha256: stableJsonSha256([]),
  migrations: phase45Mappings.map(({ liveName, liveVersion, path, sha256 }) => ({
    liveName,
    liveVersion,
    path,
    sha256,
  })),
  schemaVersion: 1 as const,
  sourceCommit: "a".repeat(40),
  targetMigrationHighWater: "20260913094634",
  technicalConfigurationCatalog: [],
}

describe("reviewed live SQL identity", () => {
  afterEach(() => vi.restoreAllMocks())

  it("accepts the exact reviewed Web Push Phase 4.5 identities", () => {
    for (const { liveSqlSha256, ...migration } of phase45Mappings) {
      expect(validConfirmation(migration)).toBe(true)
      expect(reviewedLiveSqlIdentity(migration)).toMatchObject({
        ...migration,
        liveSqlPath: migration.path,
        liveSqlSha256,
      })
      expect(confirmedLiveSqlSha256(migration)).toBe(liveSqlSha256)
      expect(
        reviewedLiveSqlIdentity({
          ...migration,
          liveVersion: migration.liveVersion.replace(/.$/u, "0"),
        })
      ).toBeUndefined()
    }
  })

  it("parses Phase 4.5 source identities and rejects raw live SQL hashes", () => {
    expect(parseBaselineManifest(phase45Manifest)).toMatchObject({
      migrations: phase45Manifest.migrations,
      targetMigrationHighWater: phase45Manifest.targetMigrationHighWater,
    })

    const rawHashes = [
      "7b1c69ce233a515c0aaccfe36c3399a543a890ca4eff0fe0530ce7e65e32450b",
      "5adad8e20598c941e3031cc489fe11520ca1a04bdb98f5f1f257f9b34621b8bb",
      "3a808bf63be911fb71d96db0c4ddcbf5c96fe3759edd2d4395039dafc11783ae",
    ]
    for (const [index, rawHash] of rawHashes.entries()) {
      expect(
        parseBaselineManifest({
          ...phase45Manifest,
          migrations: phase45Manifest.migrations.map((migration, migrationIndex) =>
            migrationIndex === index ? { ...migration, sha256: rawHash } : migration
          ),
        })
      ).toBeUndefined()
    }
  })

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

  it("reads Phase 4.5 source content using its canonical hash contract", () => {
    vi.spyOn(gitEvidence, "readFileAtCommit").mockImplementation((_root, _commit, file) =>
      readFileSync(file, "utf8")
    )

    const result = readManifestMigrationInputs({
      repositoryRoot: process.cwd(),
      manifest: phase45Manifest,
    })

    expect(
      result?.map(({ liveName, liveVersion, path, sha256, content }) => ({
        liveName,
        liveVersion,
        path,
        sha256,
        content,
      }))
    ).toEqual(
      phase45Manifest.migrations.map((migration) => ({
        ...migration,
        content: readFileSync(migration.path, "utf8").replace(/\n$/u, ""),
      }))
    )
    for (const migration of phase45Manifest.migrations) {
      expect(migrationContentSha256(readFileSync(migration.path, "utf8"))).toBe(migration.sha256)
    }
  })
})
