import { createFindingFingerprint } from "./contract"
import { doBlocks, functionBlocks } from "./static-policy-objects"
import { topLevelStatements } from "./static-sql-statements"
import { maskSqlCommentsAndLiterals } from "./static-sql"
import type { GateFinding } from "./types"

const DANGEROUS_PATTERNS = [
  { pattern: /\bDROP\s+TABLE\b/gi, reason: "drop-table" },
  { pattern: /\bDROP\s+(?:SCHEMA|DATABASE|TYPE|FUNCTION|POLICY)\b/gi, reason: "drop-object" },
  { pattern: /\bTRUNCATE\b/gi, reason: "truncate" },
  { pattern: /\bDELETE\s+FROM\b/gi, reason: "delete" },
  {
    pattern: /\bALTER\s+TABLE\b[\s\S]*?\bSET\s+NOT\s+NULL\b/gi,
    reason: "set-not-null",
  },
  {
    pattern:
      /\bGRANT\s+(?:ALL(?:\s+PRIVILEGES)?|SELECT|INSERT|UPDATE|DELETE|EXECUTE)\b[\s\S]*?\bTO\s+(?:anon|authenticated|public)\b/gi,
    reason: "privilege-expansion",
  },
] as const

function sourceLine(content: string, index: number): number {
  return content.slice(0, index).split("\n").length
}

function dangerous(subject: string, line: number, reason: string, statement: string): GateFinding {
  const evidence = { line, migration: subject, reason, statement }

  return {
    classification: "DANGEROUS",
    evidence,
    fingerprint: createFindingFingerprint({
      evidence,
      ruleId: "migration.dangerous-statement",
      subject,
    }),
    ruleId: "migration.dangerous-statement",
  }
}

/** Finds DANGEROUS statements in top-level SQL and inspectable procedural bodies. */
export function dangerousFindings(migrationPath: string, content: string): GateFinding[] {
  const findings: GateFinding[] = []

  for (const statement of topLevelStatements(content)) {
    for (const { pattern, reason } of DANGEROUS_PATTERNS) {
      for (const match of statement.sql.matchAll(pattern)) {
        const index = statement.start + (match.index ?? 0)
        findings.push(
          dangerous(
            migrationPath,
            sourceLine(content, index),
            reason,
            content.slice(statement.start, statement.end).trim()
          )
        )
      }
    }
  }

  for (const block of [...functionBlocks(content), ...doBlocks(content)]) {
    const executableBody = maskSqlCommentsAndLiterals(block.body)
    for (const { pattern, reason } of DANGEROUS_PATTERNS) {
      for (const match of executableBody.matchAll(pattern)) {
        const bodyIndex = match.index ?? 0
        const index = block.bodyStart + bodyIndex
        const statementEnd = content.indexOf(";", index)
        findings.push(
          dangerous(
            migrationPath,
            sourceLine(content, index),
            reason,
            content.slice(index, statementEnd === -1 ? content.length : statementEnd + 1).trim()
          )
        )
      }
    }
  }

  return findings
}
