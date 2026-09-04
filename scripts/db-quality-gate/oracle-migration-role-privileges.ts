import { POSTGRES_CREATE_PRIVILEGE_QUERY } from "./oracle-baseline-sql"
import { oracleErrorResult as errorResult } from "./oracle-remote-client"
import type { OracleRemoteClient } from "./oracle-remote-client"
import type { OracleExecutorResult } from "./dynamic-lane-types"

const DATABASE_ADMIN_ROLE = "supabase_admin"

/** Removes temporary schema CREATE from the migration role and verifies the cleanup. */
export function cleanupPostgresCreatePrivilege(
  sql: OracleRemoteClient["sql"],
  databaseName: string
): OracleExecutorResult<undefined> {
  const revoked = sql(
    databaseName,
    "REVOKE CREATE ON SCHEMA public FROM postgres;",
    "cleanup",
    DATABASE_ADMIN_ROLE
  )
  if (revoked.status === "error") {
    return errorResult(revoked.kind, revoked.error, revoked.diagnostic)
  }
  const verified = sql(
    databaseName,
    POSTGRES_CREATE_PRIVILEGE_QUERY,
    "cleanup",
    DATABASE_ADMIN_ROLE
  )
  if (verified.status === "error") {
    return errorResult(verified.kind, verified.error, verified.diagnostic)
  }
  return verified.value.trim() === "false"
    ? { status: "ok", value: undefined }
    : errorResult("cleanup", "Oracle database retained CREATE on public")
}

/** Grants schema CREATE only for one migration operation and always removes it afterward. */
export function withTemporaryPostgresCreatePrivilege<T>(
  sql: OracleRemoteClient["sql"],
  databaseName: string,
  operation: () => OracleExecutorResult<T>
): OracleExecutorResult<T> {
  let operationResult: OracleExecutorResult<T> | undefined
  let cleanupResult: OracleExecutorResult<undefined>
  try {
    const granted = sql(
      databaseName,
      "GRANT CREATE ON SCHEMA public TO postgres;",
      "failed",
      DATABASE_ADMIN_ROLE
    )
    operationResult =
      granted.status === "error"
        ? errorResult(granted.kind, granted.error, granted.diagnostic)
        : operation()
  } finally {
    cleanupResult = cleanupPostgresCreatePrivilege(sql, databaseName)
  }
  return cleanupResult.status === "error"
    ? errorResult(cleanupResult.kind, cleanupResult.error, cleanupResult.diagnostic)
    : (operationResult ?? errorResult("failed", "Oracle migration execution did not complete"))
}
