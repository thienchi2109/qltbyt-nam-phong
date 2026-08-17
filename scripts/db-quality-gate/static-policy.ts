import { readFileSync } from "node:fs"
import path from "node:path"

import { createFindingFingerprint } from "./contract"
import {
  functionBlocks,
  functionGrantGrantees,
  functionNames,
  hasPublicFunctionRevoke,
  isCallablePublicRpc,
  isExplicitGrantContractPresent,
  tableNames,
  unqualifiedTableNames,
} from "./static-policy-objects"
import { dangerousFindings } from "./static-policy-dangerous"
import { compareStrings } from "./serialization"
import { topLevelStatements } from "./static-sql-statements"
import {
  hasFailClosedJwtGuards,
  hasRawLikePattern,
  maskSqlCommentsAndLiterals,
  tokenizeSqlSegment,
} from "./static-sql"
import type { GateFinding, MigrationIdentity } from "./types"

type StaticRuleFinding = Omit<GateFinding, "fingerprint"> & {
  subject: string
}

function sourceFilePath(repositoryRoot: string, migrationPath: string): string {
  return path.join(repositoryRoot, migrationPath)
}

function sourceLine(content: string, index: number): number {
  return content.slice(0, index).split("\n").length
}

function createFinding(finding: StaticRuleFinding): GateFinding {
  const evidence = finding.evidence ?? {}

  return {
    classification: finding.classification,
    evidence,
    fingerprint: createFindingFingerprint({
      evidence,
      ruleId: finding.ruleId,
      subject: finding.subject,
    }),
    ruleId: finding.ruleId,
  }
}

/** Creates a deterministic BLOCKING finding for repository-local static checks. */
export function staticBlockingFinding(
  ruleId: string,
  subject: string,
  evidence: Record<string, number | string>
): GateFinding {
  return createFinding({
    classification: "BLOCKING",
    evidence,
    ruleId,
    subject,
  })
}

function hasRequiredTransaction(content: string): boolean {
  const executableSql = maskSqlCommentsAndLiterals(content).trim()
  return /^BEGIN\s*;/iu.test(executableSql) && /COMMIT\s*;\s*$/iu.test(executableSql)
}

function hasSafeSecurityDefinerPath(declaration: string): boolean {
  return /\bSET\s+search_path\s*=\s*public\s*,\s*pg_temp\s*(?=\bAS\b|$)/iu.test(declaration)
}

function containsProceduralExecute(content: string): boolean {
  return tokenizeSqlSegment(content).some(
    (token) => token.type === "word" && token.value === "execute"
  )
}

function dynamicSqlFindings(migrationPath: string, content: string): GateFinding[] {
  const findings: GateFinding[] = []

  for (const functionBlock of functionBlocks(content)) {
    if (!containsProceduralExecute(functionBlock.body)) {
      continue
    }
    findings.push(
      staticBlockingFinding("migration.dynamic-sql", migrationPath, {
        line: sourceLine(content, functionBlock.bodyStart),
        migration: migrationPath,
        scope: `function:${functionBlock.name}`,
      })
    )
  }

  for (const statement of topLevelStatements(content)) {
    if (
      !/^\s*DO\b/iu.test(statement.sql) ||
      !containsProceduralExecute(content.slice(statement.start, statement.end))
    ) {
      continue
    }
    findings.push(
      staticBlockingFinding("migration.dynamic-sql", migrationPath, {
        line: sourceLine(content, statement.start),
        migration: migrationPath,
        scope: "do",
      })
    )
  }

  return findings
}

/** Evaluates static SQL policies only for migrations selected by the static lane. */
export function staticRuleFindings(
  repositoryRoot: string,
  migration: MigrationIdentity,
  allMigrations: MigrationIdentity[]
): GateFinding[] {
  const content = readFileSync(sourceFilePath(repositoryRoot, migration.path), "utf8")
  const findings: GateFinding[] = []

  if (!/^\s*--/u.test(content)) {
    findings.push(
      staticBlockingFinding("migration.header-comment", migration.path, {
        migration: migration.path,
      })
    )
  }

  if (!hasRequiredTransaction(content)) {
    findings.push(
      staticBlockingFinding("migration.transaction-wrapper", migration.path, {
        migration: migration.path,
      })
    )
  }

  const names = functionNames(content)
  if (names.length > 0) {
    const laterSources = allMigrations.filter(
      (entry) => compareStrings(entry.path, migration.path) > 0
    )
    for (const name of names) {
      if (
        laterSources.some((entry) =>
          functionNames(readFileSync(sourceFilePath(repositoryRoot, entry.path), "utf8")).includes(
            name
          )
        )
      ) {
        findings.push(
          staticBlockingFinding("migration.source-order-overwrite", migration.path, {
            function: name,
            migration: migration.path,
          })
        )
      }
    }
  }

  for (const functionBlock of functionBlocks(content)) {
    const declaration = maskSqlCommentsAndLiterals(functionBlock.declaration)
    const callablePublicRpc = isCallablePublicRpc(functionBlock)
    const securityDefiner = /\bSECURITY\s+DEFINER\b/iu.test(declaration)

    if (callablePublicRpc && !hasFailClosedJwtGuards(functionBlock.body)) {
      findings.push(
        staticBlockingFinding("migration.jwt-guards", migration.path, {
          function: functionBlock.name,
          migration: migration.path,
        })
      )
    }

    if (securityDefiner && !hasSafeSecurityDefinerPath(declaration)) {
      findings.push(
        staticBlockingFinding("migration.security-definer-search-path", migration.path, {
          function: functionBlock.name,
          migration: migration.path,
        })
      )
    }

    if (!callablePublicRpc || !securityDefiner) {
      continue
    }

    const grantGrantees = functionGrantGrantees(content, functionBlock.name)
    if (!grantGrantees.has("authenticated")) {
      findings.push(
        staticBlockingFinding("migration.security-definer-execute-grant", migration.path, {
          function: functionBlock.name,
          migration: migration.path,
        })
      )
    }

    if (!hasPublicFunctionRevoke(content, functionBlock.name)) {
      findings.push(
        staticBlockingFinding("migration.security-definer-execute-revoke", migration.path, {
          function: functionBlock.name,
          migration: migration.path,
        })
      )
    }

    if (grantGrantees.has("anon") || grantGrantees.has("public")) {
      findings.push(
        staticBlockingFinding("migration.security-definer-public-execute", migration.path, {
          function: functionBlock.name,
          migration: migration.path,
        })
      )
    }
  }

  const alteredDefiners = maskSqlCommentsAndLiterals(content).matchAll(
    /\bALTER\s+FUNCTION\s+[^;]*\bSECURITY\s+DEFINER\b[^;]*;/giu
  )
  for (const alteredDefiner of alteredDefiners) {
    findings.push(
      staticBlockingFinding("migration.security-definer-search-path", migration.path, {
        function: "alter-function",
        migration: migration.path,
      })
    )
  }

  for (const tableName of tableNames(content)) {
    if (!isExplicitGrantContractPresent(content, tableName)) {
      findings.push(
        staticBlockingFinding("migration.explicit-grants", migration.path, {
          migration: migration.path,
          table: tableName,
        })
      )
    }
  }

  for (const tableName of unqualifiedTableNames(content)) {
    findings.push(
      staticBlockingFinding("migration.unqualified-create-table", migration.path, {
        migration: migration.path,
        table: tableName,
      })
    )
  }

  if (hasRawLikePattern(content)) {
    findings.push(
      staticBlockingFinding("migration.ilike-sanitization", migration.path, {
        migration: migration.path,
      })
    )
  }

  return [
    ...findings,
    ...dynamicSqlFindings(migration.path, content),
    ...dangerousFindings(migration.path, content),
  ]
}

/** Reclassifies unmodified legacy hygiene debt as identity-baseline warnings. */
export function staticLegacyHygieneWarnings(
  repositoryRoot: string,
  migration: MigrationIdentity,
  allMigrations: MigrationIdentity[]
): GateFinding[] {
  return staticRuleFindings(repositoryRoot, migration, allMigrations)
    .filter((finding) => finding.classification === "BLOCKING")
    .map((finding) => ({
      ...finding,
      classification: "WARNING" as const,
    }))
}
