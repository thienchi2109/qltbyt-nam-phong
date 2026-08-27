import { compareStrings, stableJsonSha256 } from "./serialization"

export type TechnicalConfigurationRoutine = {
  definitionSha256: string
  executeGrantees: string[]
  executionMode: "definer" | "invoker"
  identity: string
  owner: string
  searchPath: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseRoutine(value: unknown): TechnicalConfigurationRoutine | undefined {
  if (
    !isRecord(value) ||
    typeof value.definitionSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.definitionSha256) ||
    !Array.isArray(value.executeGrantees) ||
    (value.executionMode !== "definer" && value.executionMode !== "invoker") ||
    typeof value.identity !== "string" ||
    !/^public\.technical_configuration_[a-z0-9_]+\(.*\)$/u.test(value.identity) ||
    typeof value.owner !== "string" ||
    !/^[A-Za-z_][A-Za-z0-9_$-]*$/u.test(value.owner) ||
    (value.searchPath !== null &&
      (typeof value.searchPath !== "string" || value.searchPath.length === 0))
  ) {
    return undefined
  }

  const executeGrantees = value.executeGrantees
  if (
    executeGrantees.some(
      (grantee) =>
        typeof grantee !== "string" || !/^(?:PUBLIC|[A-Za-z_][A-Za-z0-9_$-]*)$/u.test(grantee)
    )
  ) {
    return undefined
  }
  const sortedGrantees = [...executeGrantees].sort(compareStrings) as string[]
  if (new Set(sortedGrantees).size !== sortedGrantees.length) {
    return undefined
  }

  return {
    definitionSha256: value.definitionSha256,
    executeGrantees: sortedGrantees,
    executionMode: value.executionMode,
    identity: value.identity,
    owner: value.owner,
    searchPath: value.searchPath,
  }
}

/** Parses and deterministically orders the live-bound Technical Configurations RPC catalog. */
export function parseTechnicalConfigurationCatalog(
  value: unknown
): TechnicalConfigurationRoutine[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const catalog: TechnicalConfigurationRoutine[] = []
  for (const item of value) {
    const routine = parseRoutine(item)
    if (routine === undefined) {
      return undefined
    }
    catalog.push(routine)
  }
  catalog.sort((left, right) => compareStrings(left.identity, right.identity))
  if (new Set(catalog.map((routine) => routine.identity)).size !== catalog.length) {
    return undefined
  }
  return catalog
}

/** Hashes the normalized catalog that is shared by the manifest, state, and Oracle observation. */
export function technicalConfigurationCatalogSha256(
  catalog: TechnicalConfigurationRoutine[]
): string {
  const normalized = parseTechnicalConfigurationCatalog(catalog)
  return stableJsonSha256(normalized ?? [])
}
