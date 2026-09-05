import { createHash } from "node:crypto"

export type OracleDiagnosticCategory =
  | "permission-denied"
  | "duplicate-object"
  | "undefined-relation"
  | "undefined-function"
  | "undefined-column"
  | "syntax-error"
  | "transaction-aborted"
  | "unknown"

export type OracleDiagnostic = {
  category: OracleDiagnosticCategory
  sqlState?: string
  stderrSha256: string
}

const CATEGORY_PATTERNS: ReadonlyArray<readonly [OracleDiagnosticCategory, readonly RegExp[]]> = [
  [
    "permission-denied",
    [/\b42501\b/u, /\bpermission denied\b/iu, /\bmust be (?:owner|superuser)\b/iu],
  ],
  ["duplicate-object", [/\b(?:42P07|42710)\b/u, /\bERROR:[^\n]*\balready exists\b/iu]],
  [
    "undefined-relation",
    [
      /\b42P01\b/u,
      /\b(?:relation|table|view|materialized view|sequence)\b[^\n]*\bdoes not exist\b/iu,
    ],
  ],
  ["undefined-function", [/\b42883\b/u, /\b(?:function|procedure)\b[^\n]*\bdoes not exist\b/iu]],
  ["undefined-column", [/\b42703\b/u, /\bcolumn\b[^\n]*\bdoes not exist\b/iu]],
  [
    "syntax-error",
    [
      /\b42601\b/u,
      /\bsyntax error at or near\b/iu,
      /\bunterminated quoted (?:identifier|string)\b/iu,
    ],
  ],
  ["transaction-aborted", [/\b25P02\b/u, /\bcurrent transaction is aborted\b/iu]],
]

function categoryForStderr(stderr: string): OracleDiagnosticCategory {
  for (const [category, patterns] of CATEGORY_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(stderr))) {
      return category
    }
  }

  return "unknown"
}

/** Classifies Oracle stderr without retaining any raw diagnostic text. */
export function classifyOracleDiagnostic(stderr: string): OracleDiagnostic {
  const sqlState = /\b(?:ERROR|FATAL|PANIC):\s+([0-9A-Z]{5})(?=\s|:|$)/u.exec(stderr)?.[1]
  return {
    category: categoryForStderr(stderr),
    ...(sqlState === undefined ? {} : { sqlState }),
    stderrSha256: createHash("sha256").update(stderr).digest("hex"),
  }
}
