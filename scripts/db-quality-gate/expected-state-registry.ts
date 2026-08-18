import { z } from "zod"

import { compareStrings } from "./serialization"
import type { RegistryValidation, ValidationFinding } from "./types"

const invariantExpectedSchema = z
  .object({
    allowedDirectAccess: z.array(
      z
        .object({
          operations: z.array(z.string().min(1)).min(1),
          role: z.string().min(1),
        })
        .strict()
    ),
    boundary: z.string().min(1),
    policyIdentities: z.array(z.string().min(1)),
    rls: z
      .object({
        enabled: z.boolean(),
        forced: z.boolean(),
      })
      .strict(),
  })
  .strict()

const resolvedInvariantSchema = z
  .object({
    classification: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1),
    expected: invariantExpectedSchema,
    id: z.string().min(1),
    objectIdentity: z.string().regex(/^public\.[a-z0-9_]+$/),
    owner: z.string().min(1),
    rule: z.literal("table-access-contract"),
    scope: z.literal("table-security"),
    status: z.enum(["active", "baseline-debt", "retired"]),
  })
  .strict()

const unresolvedInvariantSchema = z
  .object({
    evidence: z.array(z.string().min(1)).min(1),
    id: z.string().min(1),
    objectIdentity: z.string().regex(/^public\.[a-z0-9_]+$/),
    rule: z.literal("table-access-contract"),
    scope: z.literal("table-security"),
    status: z.literal("unresolved"),
  })
  .strict()

const invariantSchema = z.union([resolvedInvariantSchema, unresolvedInvariantSchema])

const invariantsSchema = z
  .object({
    invariants: z.array(invariantSchema),
    schemaVersion: z.literal(1),
  })
  .strict()

const sqlTestSchema = z
  .object({
    evidence: z.array(z.string().min(1)).min(1),
    fixtureContract: z.enum(["isolated-fixture", "dedicated-fixture", "external-fixture"]),
    path: z.string().regex(/^supabase\/tests\/.+\.sql$/),
    purpose: z.enum([
      "invariant",
      "phase-gate",
      "smoke",
      "performance",
      "concurrency",
      "live-acceptance",
    ]),
    runnerRequirements: z
      .array(z.enum(["psql", "psql-meta-commands", "dblink", "multi-session"]))
      .min(1),
    safety: z.enum(["default-safe", "opt-in", "live-only"]),
    timeoutSeconds: z.number().int().positive(),
    transactionContract: z.enum(["rollback-required", "isolated-database"]),
  })
  .strict()

const sqlTestsSchema = z
  .object({
    schemaVersion: z.literal(1),
    tests: z.array(sqlTestSchema),
  })
  .strict()

/** Enumerates table classifications that carry reviewed access-contract authority. */
export const TABLE_CLASSIFICATIONS = new Set([
  "app-facing",
  "intentionally-public",
  "rpc-only",
  "server-only",
])

export type InvariantRegistry = z.infer<typeof invariantsSchema>
export type ResolvedInvariant = z.infer<typeof resolvedInvariantSchema>
export type SqlTestRegistry = z.infer<typeof sqlTestsSchema>

function hasSchemaVersion(value: unknown, schemaVersion: number): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === schemaVersion
  )
}

function finding(
  ruleId: string,
  classification: ValidationFinding["classification"]
): ValidationFinding {
  return { classification, ruleId }
}

function hasUniqueValues(values: string[]): boolean {
  return new Set(values).size === values.length
}

function hasUniqueInvariantIdentities(registry: InvariantRegistry): boolean {
  return (
    hasUniqueValues(registry.invariants.map((invariant) => invariant.id)) &&
    hasUniqueValues(registry.invariants.map((invariant) => invariant.objectIdentity))
  )
}

function hasUniqueSqlTestPaths(registry: SqlTestRegistry): boolean {
  return hasUniqueValues(registry.tests.map((test) => test.path))
}

/** Parses deterministic table-security intent without inferring policy from a database snapshot. */
export function parseInvariantRegistry(value: unknown): InvariantRegistry | undefined {
  const result = invariantsSchema.safeParse(value)

  return result.success && hasUniqueInvariantIdentities(result.data) ? result.data : undefined
}

/** Parses the committed SQL-test inventory and its explicit execution metadata. */
export function parseSqlTestRegistry(value: unknown): SqlTestRegistry | undefined {
  const result = sqlTestsSchema.safeParse(value)

  return result.success && hasUniqueSqlTestPaths(result.data) ? result.data : undefined
}

/** Validates expected-state registry shape and default-lane safety without needing live catalog access. */
export function validateExpectedStateRegistries(input: {
  invariants: unknown
  sqlTests: unknown
}): RegistryValidation {
  const findings: ValidationFinding[] = []
  const invariants = parseInvariantRegistry(input.invariants)
  const sqlTests = parseSqlTestRegistry(input.sqlTests)

  if (invariants === undefined) {
    findings.push(
      finding(
        hasSchemaVersion(input.invariants, 1)
          ? "registry.invariants.schema"
          : "registry.invariants.schema-version",
        "INCOMPLETE"
      )
    )
  } else {
    for (const invariant of invariants.invariants) {
      if (
        invariant.status !== "unresolved" &&
        !TABLE_CLASSIFICATIONS.has(invariant.classification)
      ) {
        findings.push(finding("registry.invariants.table-intent", "INCOMPLETE"))
      }
    }
  }

  if (sqlTests === undefined) {
    findings.push(
      finding(
        hasSchemaVersion(input.sqlTests, 1)
          ? "registry.sql-tests.schema"
          : "registry.sql-tests.schema-version",
        "BLOCKING"
      )
    )
  } else if (
    sqlTests.tests.some(
      (test) =>
        test.safety === "default-safe" &&
        (test.fixtureContract !== "isolated-fixture" ||
          test.purpose === "performance" ||
          test.purpose === "concurrency" ||
          test.purpose === "live-acceptance" ||
          !test.runnerRequirements.includes("psql") ||
          test.transactionContract !== "rollback-required")
    )
  ) {
    findings.push(finding("registry.sql-tests.default-safe-contract", "BLOCKING"))
  }

  return {
    findings: findings.sort((left, right) => compareStrings(left.ruleId, right.ruleId)),
    valid: findings.length === 0,
  }
}
