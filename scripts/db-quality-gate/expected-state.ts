import { createFindingFingerprint } from "./contract"
import {
  accessCatalogSchema,
  applicationCatalogSchema,
  environmentCatalogSchema,
  type AccessCatalog,
} from "./expected-state-catalog"
import {
  collectAccessFingerprint,
  collectApplicationFingerprint,
  collectEnvironmentFingerprint,
} from "./expected-state-fingerprints"
import {
  parseInvariantRegistry,
  parseSqlTestRegistry,
  TABLE_CLASSIFICATIONS,
  type ResolvedInvariant,
} from "./registries"
import { compareStrings } from "./serialization"
import type { ValidationFinding } from "./types"

export {
  collectAccessFingerprint,
  collectApplicationFingerprint,
  collectEnvironmentFingerprint,
} from "./expected-state-fingerprints"

type CatalogFinding = ValidationFinding & {
  fingerprint: string
}

type CatalogCheckResult = {
  findings: CatalogFinding[]
}

type CatalogContractInput = {
  access?: unknown
  application?: unknown
  environment?: unknown
  invariants: unknown
}

function sortedStrings(values: string[]): string[] {
  return [...values].sort(compareStrings)
}

function catalogFinding(
  classification: ValidationFinding["classification"],
  ruleId: string,
  subject: string,
  evidence: Record<string, unknown>
): CatalogFinding {
  return {
    classification,
    fingerprint: createFindingFingerprint({ evidence, ruleId, subject }),
    ruleId,
  }
}

function catalogUnavailable(
  findings: CatalogFinding[],
  layer: "access" | "application" | "environment"
): void {
  findings.push(
    catalogFinding("INCOMPLETE", `catalog.${layer}.unavailable`, layer, {
      layer,
    })
  )
}

function validateLayer(
  findings: CatalogFinding[],
  layer: "access" | "application" | "environment",
  value: unknown,
  parser: (input: unknown) => { success: boolean }
): boolean {
  if (value === undefined) {
    catalogUnavailable(findings, layer)
    return false
  }

  if (!parser(value).success) {
    findings.push(
      catalogFinding("INCOMPLETE", `catalog.${layer}.invalid`, layer, {
        layer,
      })
    )
    return false
  }

  return true
}

function directOperationsByRole(
  grants: Array<{
    operations: string[]
    role: string
  }>
): Map<string, string[]> {
  const operationsByRole = new Map<string, Set<string>>()

  for (const grant of grants) {
    const role = grant.role.toLowerCase()
    const clientRoles = role === "public" ? ["anon", "authenticated"] : [role]

    for (const clientRole of clientRoles) {
      if (clientRole !== "anon" && clientRole !== "authenticated") {
        continue
      }

      const operations = operationsByRole.get(clientRole) ?? new Set<string>()
      for (const operation of grant.operations) {
        operations.add(operation)
      }
      operationsByRole.set(clientRole, operations)
    }
  }

  return new Map(
    [...operationsByRole].map(([role, operations]) => [role, sortedStrings([...operations])])
  )
}

function expectedOperationsByRole(invariant: ResolvedInvariant) {
  return new Map(
    invariant.expected.allowedDirectAccess.map((access) => [
      access.role,
      sortedStrings(access.operations),
    ])
  )
}

function safeDefinerSearchPath(searchPath: string | null): boolean {
  return searchPath?.replaceAll(/\s+/g, "").toLowerCase() === "public,pg_temp"
}

function evaluateTableAccess(
  findings: CatalogFinding[],
  invariant: ResolvedInvariant,
  table: AccessCatalog["tables"][number]
): void {
  if (table.owner !== invariant.owner) {
    findings.push(
      catalogFinding("BLOCKING", "catalog.access.owner", table.identity, {
        expectedOwner: invariant.owner,
        observedOwner: table.owner,
      })
    )
  }

  const expectedOperations = expectedOperationsByRole(invariant)
  const publicGrantOperations = sortedStrings(
    table.grants
      .filter((grant) => grant.role.toLowerCase() === "public")
      .flatMap((grant) => grant.operations)
  )
  if (publicGrantOperations.length > 0) {
    findings.push(
      catalogFinding("BLOCKING", "catalog.access.public-grant", table.identity, {
        operations: publicGrantOperations,
      })
    )
  }

  for (const [role, observedOperations] of directOperationsByRole(table.grants)) {
    const allowedOperations = expectedOperations.get(role) ?? []
    const extraOperations = observedOperations.filter(
      (operation) => !allowedOperations.includes(operation)
    )

    if (extraOperations.length > 0) {
      findings.push(
        catalogFinding("BLOCKING", "catalog.access.operations", table.identity, {
          allowedOperations,
          extraOperations,
          role,
        })
      )
    }
  }

  if (
    table.rls.enabled !== invariant.expected.rls.enabled ||
    table.rls.forced !== invariant.expected.rls.forced
  ) {
    findings.push(
      catalogFinding("BLOCKING", "catalog.access.rls", table.identity, {
        expected: invariant.expected.rls,
        observed: table.rls,
      })
    )
  }

  const observedPolicyIdentities = table.policies.map((policy) => policy.identity)
  const missingPolicies = invariant.expected.policyIdentities.filter(
    (identity) => !observedPolicyIdentities.includes(identity)
  )
  const extraPolicies = observedPolicyIdentities.filter(
    (identity) => !invariant.expected.policyIdentities.includes(identity)
  )
  if (missingPolicies.length > 0 || extraPolicies.length > 0) {
    findings.push(
      catalogFinding("BLOCKING", "catalog.access.policies", table.identity, {
        extraPolicies: sortedStrings(extraPolicies),
        missingPolicies: sortedStrings(missingPolicies),
      })
    )
  }
}

/**
 * Performs mandatory pure catalog checks. Database collection/execution remains
 * the responsibility of the disposable Oracle lanes introduced in Phase 4.
 */
export function evaluateCatalogContracts(input: CatalogContractInput): CatalogCheckResult {
  const findings: CatalogFinding[] = []
  validateLayer(findings, "application", input.application, applicationCatalogSchema.safeParse)
  const accessAvailable = validateLayer(
    findings,
    "access",
    input.access,
    accessCatalogSchema.safeParse
  )
  validateLayer(findings, "environment", input.environment, environmentCatalogSchema.safeParse)
  const invariants = parseInvariantRegistry(input.invariants)

  if (invariants === undefined) {
    findings.push(
      catalogFinding("INCOMPLETE", "catalog.invariants.unavailable", "invariants", {
        registry: "supabase/db-quality-gate-invariants.json",
      })
    )
  }

  if (accessAvailable && invariants !== undefined) {
    const accessCatalog = accessCatalogSchema.parse(input.access)
    const invariantsByIdentity = new Map(
      invariants.invariants.map((invariant) => [invariant.objectIdentity, invariant])
    )
    const observedTableIdentities = new Set(accessCatalog.tables.map((table) => table.identity))

    for (const table of accessCatalog.tables) {
      const invariant = invariantsByIdentity.get(table.identity)
      if (invariant === undefined || invariant.status === "retired") {
        findings.push(
          catalogFinding("INCOMPLETE", "catalog.table-intent.missing", table.identity, {
            table: table.identity,
          })
        )
        continue
      }

      if (invariant.status === "unresolved") {
        findings.push(
          catalogFinding("INCOMPLETE", "catalog.table-intent.unresolved", table.identity, {
            evidence: invariant.evidence,
            invariantId: invariant.id,
          })
        )
        continue
      }

      if (!TABLE_CLASSIFICATIONS.has(invariant.classification)) {
        findings.push(
          catalogFinding("INCOMPLETE", "catalog.table-intent.unknown", table.identity, {
            classification: invariant.classification,
            invariantId: invariant.id,
          })
        )
        continue
      }

      evaluateTableAccess(findings, invariant, table)
    }

    for (const invariant of invariants.invariants) {
      if (invariant.status === "active" && !observedTableIdentities.has(invariant.objectIdentity)) {
        findings.push(
          catalogFinding("BLOCKING", "catalog.table.missing", invariant.objectIdentity, {
            invariantId: invariant.id,
          })
        )
      }
    }

    for (const routine of accessCatalog.routines) {
      if (routine.executionMode === "definer" && !safeDefinerSearchPath(routine.searchPath)) {
        findings.push(
          catalogFinding("BLOCKING", "catalog.routine.search-path", routine.identity, {
            executionMode: routine.executionMode,
            searchPath: routine.searchPath,
          })
        )
      }
    }
  }

  return {
    findings: findings.sort(
      (left, right) =>
        compareStrings(left.ruleId, right.ruleId) ||
        compareStrings(left.fingerprint, right.fingerprint)
    ),
  }
}

/** Returns only fully classified custom SQL tests permitted in the default lane. */
export function selectDefaultSafeSqlTests(input: unknown) {
  const registry = parseSqlTestRegistry(input)
  if (registry === undefined) {
    throw new Error("SQL-test registry is invalid or incomplete")
  }

  return registry.tests
    .filter(
      (test) =>
        test.safety === "default-safe" &&
        test.fixtureContract === "isolated-fixture" &&
        test.purpose !== "performance" &&
        test.purpose !== "concurrency" &&
        test.purpose !== "live-acceptance" &&
        test.runnerRequirements.length === 1 &&
        test.runnerRequirements[0] === "psql" &&
        test.transactionContract === "rollback-required"
    )
    .sort((left, right) => compareStrings(left.path, right.path))
}
