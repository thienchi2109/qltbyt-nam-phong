import {
  accessCatalogSchema,
  applicationCatalogSchema,
  environmentCatalogSchema,
} from "./expected-state-catalog"
import { compareStrings, stableJsonSha256 } from "./serialization"

function sortedStrings(values: string[]): string[] {
  return [...values].sort(compareStrings)
}

function normalizedGrants(
  grants: Array<{
    operations: string[]
    role: string
  }>
) {
  return [...grants]
    .map((grant) => ({
      operations: sortedStrings(grant.operations),
      role: grant.role,
    }))
    .sort((left, right) => compareStrings(left.role, right.role))
}

function normalizedPolicies(
  policies: Array<{
    command: "ALL" | "DELETE" | "INSERT" | "SELECT" | "UPDATE"
    identity: string
    permissive: boolean
    roles: string[]
    using: string | null
    withCheck: string | null
  }>
) {
  return [...policies]
    .map((policy) => ({
      ...policy,
      roles: sortedStrings(policy.roles),
    }))
    .sort((left, right) => compareStrings(left.identity, right.identity))
}

/** Hashes logical application metadata without physical order, ACLs, or extension-owned objects. */
export function collectApplicationFingerprint(input: unknown): string {
  const catalog = applicationCatalogSchema.parse(input)
  const relations = catalog.relations
    .filter((relation) => !relation.extensionOwned)
    .map((relation) => ({
      columns: [...relation.columns]
        .map(({ ordinal: _ordinal, ...column }) => column)
        .sort((left, right) => compareStrings(left.name, right.name)),
      constraints: [...relation.constraints].sort((left, right) =>
        compareStrings(left.name, right.name)
      ),
      identity: relation.identity,
      indexes: [...relation.indexes].sort((left, right) => compareStrings(left.name, right.name)),
      kind: relation.kind,
      triggers: [...relation.triggers].sort((left, right) => compareStrings(left.name, right.name)),
    }))
    .sort((left, right) => compareStrings(left.identity, right.identity))
  const routines = catalog.routines
    .filter((routine) => !routine.extensionOwned)
    .map(({ definition, identity, kind }) => ({ definition, identity, kind }))
    .sort((left, right) => compareStrings(left.identity, right.identity))

  return stableJsonSha256({ relations, routines })
}

/** Hashes security-significant catalog state separately from application structure. */
export function collectAccessFingerprint(input: unknown): string {
  const catalog = accessCatalogSchema.parse(input)
  const routines = [...catalog.routines]
    .map((routine) => ({
      executionMode: routine.executionMode,
      grants: normalizedGrants(routine.grants),
      identity: routine.identity,
      owner: routine.owner,
      searchPath: routine.searchPath,
    }))
    .sort((left, right) => compareStrings(left.identity, right.identity))
  const tables = [...catalog.tables]
    .map((table) => ({
      grants: normalizedGrants(table.grants),
      identity: table.identity,
      owner: table.owner,
      policies: normalizedPolicies(table.policies),
      rls: table.rls,
    }))
    .sort((left, right) => compareStrings(left.identity, right.identity))

  return stableJsonSha256({ routines, tables })
}

/** Hashes PostgreSQL, Supabase, and extension compatibility inputs deterministically. */
export function collectEnvironmentFingerprint(input: unknown): string {
  const catalog = environmentCatalogSchema.parse(input)
  const extensions = [...catalog.extensions].sort((left, right) =>
    compareStrings(`${left.schema}.${left.name}`, `${right.schema}.${right.name}`)
  )

  return stableJsonSha256({
    extensions,
    postgresqlVersion: catalog.postgresqlVersion,
    supabaseVersion: catalog.supabaseVersion,
  })
}
