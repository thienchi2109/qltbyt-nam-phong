import path from "node:path"

import { readFileSync } from "node:fs"

import { compareStrings } from "./serialization"
import {
  ambiguousFunctionNames,
  functionBlocks,
  functionGrantGrantees,
  functionRevokeGrantees,
  isInternalPublicHelper,
} from "./static-policy-objects"
import type { SqlFunctionBlock } from "./static-policy-objects"
import type { MigrationIdentity } from "./types"

export type StaticFunctionDefinition = {
  content: string
  functionBlock: SqlFunctionBlock
}

function sourceFilePath(repositoryRoot: string, migrationPath: string): string {
  return path.join(repositoryRoot, migrationPath)
}

/** Builds the latest committed definitions available before and within a candidate migration. */
export function historicalFunctionDefinitions(
  repositoryRoot: string,
  migration: MigrationIdentity,
  allMigrations: MigrationIdentity[],
  currentContent: string
): StaticFunctionDefinition[] {
  const definitions = new Map<string, StaticFunctionDefinition>()
  const priorMigrations = allMigrations
    .filter((entry) => compareStrings(entry.path, migration.path) < 0)
    .sort((left, right) => compareStrings(left.path, right.path))

  for (const entry of priorMigrations) {
    const content = readFileSync(sourceFilePath(repositoryRoot, entry.path), "utf8")
    for (const functionBlock of functionBlocks(content)) {
      definitions.set(functionBlock.identity, { content, functionBlock })
    }
  }
  for (const functionBlock of functionBlocks(currentContent)) {
    definitions.set(functionBlock.identity, { content: currentContent, functionBlock })
  }

  return [...definitions.values()]
}

/** Keeps only unambiguous internal helpers whose ACL proves non-callability. */
export function safeInternalFunctionTargets(
  definitions: StaticFunctionDefinition[]
): Set<SqlFunctionBlock> {
  const overloadedFunctionNames = ambiguousFunctionNames(
    definitions.map((definition) => definition.functionBlock)
  )

  return new Set(
    definitions
      .filter(({ functionBlock }) => !overloadedFunctionNames.has(functionBlock.name))
      .filter(({ content, functionBlock }) => {
        const grantees = functionGrantGrantees(content, functionBlock)
        const revokeGrantees = functionRevokeGrantees(content, functionBlock)

        return (
          isInternalPublicHelper(functionBlock) &&
          ["anon", "authenticated", "public"].every((grantee) => revokeGrantees.has(grantee)) &&
          !["anon", "authenticated", "public"].some((grantee) => grantees.has(grantee))
        )
      })
      .map(({ functionBlock }) => functionBlock)
  )
}
