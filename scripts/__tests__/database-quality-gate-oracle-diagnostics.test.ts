import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type OracleDiagnosticCategory =
  | "permission-denied"
  | "duplicate-object"
  | "undefined-relation"
  | "undefined-function"
  | "undefined-column"
  | "syntax-error"
  | "transaction-aborted"
  | "unknown"

type OracleDiagnosticsModule = {
  classifyOracleDiagnostic: (stderr: string) => {
    category: OracleDiagnosticCategory
    stderrSha256: string
  }
}

describe("database quality gate Oracle diagnostics", () => {
  it("binds assertion identity while excluding generated SQL arguments and diagnostic JSON", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleDiagnosticsModule>("oracle-diagnostics")
    const diagnostic = (payload: string, argument: string) =>
      source.classifyOracleDiagnostic(
        `ERROR:  P0001: Expected report keys, got ${payload}\nCONTEXT: SQL statement "SELECT helper('${argument}')"\nPL/pgSQL function pg_temp_${argument === "first-argument" ? "69" : "83"}.assert_true(text,boolean) line 3 at RAISE\nPL/pgSQL function inline_code_block line 42 at PERFORM\nLOCATION: exec_stmt_raise, pl_exec.c:3921`
      ) as { failureSignature?: string; stderrSha256: string }
    const first = diagnostic('{"generatedAt":"first"}', "first-argument")
    const second = diagnostic('{"generatedAt":"second"}', "second-argument")
    expect(first.failureSignature).toBeDefined()
    expect(first.failureSignature).toBe(second.failureSignature)
    expect(first.stderrSha256).not.toBe(second.stderrSha256)
    const changed = source.classifyOracleDiagnostic(
      "ERROR:  P0001: Different assertion\nCONTEXT: PL/pgSQL function inline_code_block line 42 at RAISE"
    )
    expect(changed).not.toHaveProperty("failureSignature", first.failureSignature)
  })
  it("distinguishes assertions sharing SQLSTATE without storing diagnostic text", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleDiagnosticsModule>("oracle-diagnostics")
    const first = source.classifyOracleDiagnostic(
      "ERROR:  P0001: assertion alpha\nCONTEXT: SQL statement"
    )
    const second = source.classifyOracleDiagnostic(
      "ERROR:  P0001: assertion beta\nCONTEXT: SQL statement"
    )
    expect(first).toHaveProperty("failureSignature")
    expect(first).not.toEqual(second)
    expect(JSON.stringify(first)).not.toContain("assertion alpha")
    expect(source.classifyOracleDiagnostic("ERROR:  P0001")).not.toHaveProperty("failureSignature")
  })
  it.each(["42501", "P0001", "42P01"])(
    "retains only the structured SQLSTATE %s",
    async (sqlState) => {
      const source =
        await loadDatabaseQualityGateModule<OracleDiagnosticsModule>("oracle-diagnostics")
      const stderr = `psql:<stdin>:42: ERROR:  ${sqlState}`
      expect(source.classifyOracleDiagnostic(stderr)).toEqual(expect.objectContaining({ sqlState }))
      expect(
        source.classifyOracleDiagnostic(`ERROR:  user supplied ${sqlState}`)
      ).not.toHaveProperty("sqlState")
    }
  )
  it.each([
    ["permission-denied", "ERROR:  permission denied for schema auth"],
    ["permission-denied", "ubuntu@oracle.test: Permission denied (publickey)."],
    ["duplicate-object", 'ERROR:  relation "samples" already exists'],
    ["duplicate-object", 'ERROR:  type "sample_status" already exists'],
    ["undefined-relation", 'ERROR:  relation "missing_samples" does not exist'],
    ["undefined-function", "ERROR:  function public.missing_function() does not exist"],
    ["undefined-column", 'ERROR:  column "missing_column" does not exist'],
    ["syntax-error", 'ERROR:  syntax error at or near "FORM"'],
    [
      "transaction-aborted",
      "ERROR:  current transaction is aborted, commands ignored until end of transaction block",
    ],
    [
      "unknown",
      "ssh: Could not resolve hostname oracle.test: Temporary failure in name resolution",
    ],
  ] satisfies Array<[OracleDiagnosticCategory, string]>)(
    "classifies %s without returning raw stderr",
    async (category, stderr) => {
      const source =
        await loadDatabaseQualityGateModule<OracleDiagnosticsModule>("oracle-diagnostics")

      const diagnostic = source.classifyOracleDiagnostic(stderr)

      expect(diagnostic).toEqual({
        category,
        stderrSha256: createHash("sha256").update(stderr).digest("hex"),
      })
      expect(JSON.stringify(diagnostic)).not.toContain(stderr)
    }
  )
})
