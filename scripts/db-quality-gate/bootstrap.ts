import { z } from "zod"

import { sha256Text, stableJsonSha256 } from "./serialization"

const SHA1_PATTERN = /^[a-f0-9]{40}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

const lockEntrySchema = z
  .object({
    path: z.string().regex(/^supabase\/migrations\/[^/]+\.sql$/),
    sha256: z.string().regex(SHA256_PATTERN),
  })
  .strict()

const bootstrapManifestSchema = z
  .object({
    attestation: z.union([
      z
        .object({
          status: z.literal("pending"),
        })
        .strict(),
      z
        .object({
          live: z
            .object({
              accessSha256: z.string().regex(SHA256_PATTERN),
              applicationSha256: z.string().regex(SHA256_PATTERN),
              environmentSha256: z.string().regex(SHA256_PATTERN),
            })
            .strict(),
          oracleBaseline: z
            .object({
              accessSha256: z.string().regex(SHA256_PATTERN),
              applicationSha256: z.string().regex(SHA256_PATTERN),
              environmentSha256: z.string().regex(SHA256_PATTERN),
            })
            .strict(),
          status: z.literal("complete"),
        })
        .strict(),
    ]),
    artifact: z
      .object({
        path: z.literal("supabase/db-quality-gate-bootstrap.sql"),
        sha256: z.string().regex(SHA256_PATTERN),
      })
      .strict(),
    cutover: z
      .object({
        commit: z.string().regex(SHA1_PATTERN),
        legacyInventorySha256: z.string().regex(SHA256_PATTERN),
        migrationRoot: z.literal("supabase/migrations"),
      })
      .strict(),
    schemaVersion: z.literal(1),
    scope: z
      .object({
        deterministicSeeds: z.tuple([]),
        excludedData: z.tuple([
          z.literal("application-data"),
          z.literal("roles"),
          z.literal("secrets"),
          z.literal("users"),
        ]),
        includedObjects: z.tuple([
          z.literal("supabase-base-template"),
          z.literal("application-owned-schema"),
        ]),
      })
      .strict(),
    source: z
      .object({
        database: z.literal("qltbyt_test"),
        dumpCommand: z.literal("pg_dump --schema-only"),
        pgDumpVersion: z.string().regex(/^\d+\.\d+(?:\.\d+)?$/),
        restrictKey: z.string().regex(/^[A-Za-z0-9]{64}$/),
      })
      .strict(),
  })
  .strict()

export type BootstrapManifest = z.infer<typeof bootstrapManifestSchema>
export type BootstrapArtifact = {
  content: string
  manifest: BootstrapManifest
}
export type BootstrapStructuralFingerprints = {
  accessSha256: string
  applicationSha256: string
  environmentSha256: string
}

type BootstrapArtifactInspection = {
  artifact?: BootstrapArtifact
  findings: Array<{
    ruleId: string
  }>
  outcome: "INCOMPLETE" | "PASS"
}

type BootstrapAttestationEvaluation = {
  findings: Array<{
    classification: "BLOCKING" | "INCOMPLETE"
    ruleId: string
  }>
  outcome: "FAILED" | "INCOMPLETE" | "PASS"
}

function fingerprintsMatch(
  left: BootstrapStructuralFingerprints,
  right: BootstrapStructuralFingerprints
): boolean {
  return (
    left.accessSha256 === right.accessSha256 &&
    left.applicationSha256 === right.applicationSha256 &&
    left.environmentSha256 === right.environmentSha256
  )
}

/** Canonicalizes bootstrap SQL without transforming its schema statements. */
export function canonicalizeBootstrapSql(content: string): string {
  return `${content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/\n+$/, "")}\n`
}

/** Hashes the constrained bootstrap SQL canonical form. */
export function bootstrapSqlSha256(content: string): string {
  return sha256Text(canonicalizeBootstrapSql(content))
}

/** Returns the order-sensitive digest for the immutable legacy path-and-SHA inventory. */
export function legacyInventoryDigest(entries: Array<{ path: string; sha256: string }>): string {
  return stableJsonSha256(entries)
}

/** Parses the committed bootstrap manifest without treating malformed metadata as evidence. */
export function parseBootstrapManifest(value: unknown): BootstrapManifest | undefined {
  const result = bootstrapManifestSchema.safeParse(value)

  return result.success ? result.data : undefined
}

/** Compares immutable live evidence with read-only baseline and disposable restored fingerprints. */
export function evaluateBootstrapAttestation(input: {
  manifest: unknown
  oracleBaseline?: BootstrapStructuralFingerprints
  requireRestored?: boolean
  restored?: BootstrapStructuralFingerprints
}): BootstrapAttestationEvaluation {
  const manifest = parseBootstrapManifest(input.manifest)
  if (manifest === undefined) {
    return {
      findings: [{ classification: "INCOMPLETE", ruleId: "bootstrap.manifest" }],
      outcome: "INCOMPLETE",
    }
  }
  if (manifest.attestation.status !== "complete") {
    return {
      findings: [{ classification: "INCOMPLETE", ruleId: "bootstrap.attestation" }],
      outcome: "INCOMPLETE",
    }
  }

  const findings: BootstrapAttestationEvaluation["findings"] = []
  if (input.oracleBaseline === undefined) {
    findings.push({
      classification: "INCOMPLETE",
      ruleId: "bootstrap.attestation.oracle-baseline",
    })
  } else {
    if (!fingerprintsMatch(input.oracleBaseline, manifest.attestation.oracleBaseline)) {
      findings.push({
        classification: "BLOCKING",
        ruleId: "bootstrap.attestation.oracle-baseline",
      })
    }
    if (!fingerprintsMatch(input.oracleBaseline, manifest.attestation.live)) {
      findings.push({
        classification: "BLOCKING",
        ruleId: "bootstrap.attestation.oracle-baseline-live",
      })
    }
  }

  if (input.restored === undefined && (input.requireRestored ?? true)) {
    findings.push({
      classification: "INCOMPLETE",
      ruleId: "bootstrap.attestation.restored",
    })
  } else if (
    input.restored !== undefined &&
    input.oracleBaseline !== undefined &&
    !fingerprintsMatch(input.restored, input.oracleBaseline)
  ) {
    findings.push({
      classification: "BLOCKING",
      ruleId: "bootstrap.attestation.restored-oracle-baseline",
    })
  } else if (
    input.restored !== undefined &&
    !fingerprintsMatch(input.restored, manifest.attestation.live)
  ) {
    findings.push({
      classification: "BLOCKING",
      ruleId: "bootstrap.attestation.restored-live",
    })
  }

  if (findings.some((finding) => finding.classification === "INCOMPLETE")) {
    return { findings, outcome: "INCOMPLETE" }
  }

  return {
    findings,
    outcome: findings.length === 0 ? "PASS" : "FAILED",
  }
}

/** Validates one immutable bootstrap artifact against the subject commit and legacy inventory. */
export function inspectBootstrapArtifact(input: {
  cutoverCommit: string
  legacy: Array<{ path: string; sha256: string }>
  manifest: unknown
  schemaSql: string | undefined
}): BootstrapArtifactInspection {
  const manifest = parseBootstrapManifest(input.manifest)
  if (manifest === undefined) {
    return {
      findings: [{ ruleId: "bootstrap.manifest" }],
      outcome: "INCOMPLETE",
    }
  }

  if (manifest.cutover.commit !== input.cutoverCommit) {
    return {
      findings: [{ ruleId: "bootstrap.cutover" }],
      outcome: "INCOMPLETE",
    }
  }

  if (manifest.attestation.status !== "complete") {
    return {
      findings: [{ ruleId: "bootstrap.attestation" }],
      outcome: "INCOMPLETE",
    }
  }

  const legacy = z.array(lockEntrySchema).safeParse(input.legacy)
  if (
    !legacy.success ||
    manifest.cutover.legacyInventorySha256 !== legacyInventoryDigest(legacy.data)
  ) {
    return {
      findings: [{ ruleId: "bootstrap.legacy-inventory" }],
      outcome: "INCOMPLETE",
    }
  }

  if (
    input.schemaSql === undefined ||
    manifest.artifact.sha256 !== bootstrapSqlSha256(input.schemaSql)
  ) {
    return {
      findings: [{ ruleId: "bootstrap.schema-sql" }],
      outcome: "INCOMPLETE",
    }
  }

  return {
    artifact: {
      content: canonicalizeBootstrapSql(input.schemaSql),
      manifest,
    },
    findings: [],
    outcome: "PASS",
  }
}
