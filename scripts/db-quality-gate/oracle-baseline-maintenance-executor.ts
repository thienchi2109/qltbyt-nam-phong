import { parseDatabaseObservation, parsePersistedBaselineState } from "./baseline-state"
import type { DatabaseObservation, PersistedBaselineState } from "./baseline-state"
import type { BaselineMaintenanceExecutor, ConfirmedMigrationInput } from "./baseline-maintenance"
import { parseTechnicalConfigurationCatalog } from "./baseline-catalog"
import type { TechnicalConfigurationRoutine } from "./baseline-catalog"
import {
  metadataStatement,
  migrationMetadataStatusQuery,
  validMigrationInput,
} from "./oracle-baseline-metadata"
import {
  BASELINE_OBSERVATION_QUERY,
  BASELINE_ROLE_PREFLIGHT_QUERY,
  POSTGRES_CREATE_PRIVILEGE_QUERY,
} from "./oracle-baseline-sql"
import { createOracleRemoteClient, oracleStatePath } from "./oracle-remote-client"
import {
  defaultOracleRemoteCommand,
  oracleRemoteExecutorConfigFromEnvironment,
  quotedIdentifier,
  shellQuote,
} from "./oracle-remote-contract"
import type { OracleRemoteExecutorInput } from "./oracle-remote-contract"
import { createOracleRemoteExecutor } from "./oracle-remote-executor"
import { stableJsonStringify } from "./serialization"

const BASELINE_DATABASE = "qltbyt_test"
const DATABASE_ADMIN_ROLE = "supabase_admin"
const DATABASE_MIGRATION_ROLE = "postgres"

function validMaintenanceDatabase(databaseName: string): boolean {
  return (
    databaseName === BASELINE_DATABASE ||
    /^dq_baseline_(?:refresh|retired)_[a-z0-9_]+$/u.test(databaseName)
  )
}

function validDumpPath(dumpPath: string): boolean {
  return (
    dumpPath.startsWith("/opt/supabase-test/backups/") &&
    !dumpPath.split("/").includes("..") &&
    dumpPath.endsWith(".dump")
  )
}

function parseStateText(value: string): PersistedBaselineState | undefined {
  try {
    return parsePersistedBaselineState(JSON.parse(value) as unknown)
  } catch {
    return undefined
  }
}

function sqlStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function roleGrantTarget(role: string): string {
  return role === "PUBLIC" ? role : quotedIdentifier(role)
}

function technicalConfigurationCatalogAclStatement(
  catalog: TechnicalConfigurationRoutine[]
): string | undefined {
  const normalizedCatalog = parseTechnicalConfigurationCatalog(catalog)
  if (normalizedCatalog === undefined) {
    return undefined
  }

  const statements = normalizedCatalog.map((routine) => {
    const routineLiteral = sqlStringLiteral(routine.identity)
    const grants = routine.executeGrantees
      .filter((grantee) => grantee !== "postgres")
      .map(roleGrantTarget)
      .join(", ")
    return `DO $baseline_acl$
DECLARE
  routine_oid oid;
BEGIN
  SELECT p.oid
  INTO STRICT routine_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) = ${routineLiteral};
  EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', routine_oid::regprocedure);
${grants.length > 0 ? `  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO ${grants}', routine_oid::regprocedure);` : ""}
END
$baseline_acl$;`
  })

  return ["SET ROLE postgres;", ...statements, "RESET ROLE;"].join("\n")
}

/** Creates the Oracle-write adapter used only by explicit Phase 5 maintenance commands. */
export function createOracleBaselineMaintenanceExecutor(
  input: OracleRemoteExecutorInput
): BaselineMaintenanceExecutor {
  const dynamicExecutor = createOracleRemoteExecutor(input)
  const { config } = input
  const { readJson, remote, sql } = createOracleRemoteClient(input)

  function inspectDatabase(databaseName: string): DatabaseObservation | undefined {
    if (!validMaintenanceDatabase(databaseName)) {
      return undefined
    }
    const result = readJson(databaseName, BASELINE_OBSERVATION_QUERY)
    return result.status === "ok" ? parseDatabaseObservation(result.value) : undefined
  }

  function dropDatabase(databaseName: string): boolean {
    if (!/^dq_baseline_(?:refresh|retired)_[a-z0-9_]+$/u.test(databaseName)) {
      return false
    }
    const result = sql(
      "postgres",
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${quotedIdentifier(databaseName)};`,
      "cleanup",
      DATABASE_ADMIN_ROLE
    )
    return result.status === "ok"
  }

  function cleanupMigrationRole(databaseName: string): boolean {
    if (!validMaintenanceDatabase(databaseName)) {
      return false
    }
    const revoked = sql(
      databaseName,
      "REVOKE CREATE ON SCHEMA public FROM postgres;",
      "cleanup",
      DATABASE_ADMIN_ROLE
    )
    const verified = sql(
      databaseName,
      POSTGRES_CREATE_PRIVILEGE_QUERY,
      "cleanup",
      DATABASE_ADMIN_ROLE
    )
    return revoked.status === "ok" && verified.status === "ok" && verified.value.trim() === "false"
  }

  function applyMigration(databaseName: string, migration: ConfirmedMigrationInput): boolean {
    if (!validMaintenanceDatabase(databaseName) || !validMigrationInput(migration)) {
      return false
    }
    let applied = false
    let granted = false
    let cleaned = false
    try {
      granted =
        sql(
          databaseName,
          "GRANT CREATE ON SCHEMA public TO postgres;",
          "failed",
          DATABASE_ADMIN_ROLE
        ).status === "ok"
      if (granted) {
        applied = sql(databaseName, migration.content, "failed").status === "ok"
      }
    } finally {
      cleaned = cleanupMigrationRole(databaseName)
    }
    return granted && applied && cleaned
  }

  function inspectMigrationMetadata(databaseName: string, migration: ConfirmedMigrationInput) {
    if (!validMaintenanceDatabase(databaseName)) {
      return undefined
    }
    const query = migrationMetadataStatusQuery(migration)
    if (query === undefined) {
      return undefined
    }
    const result = readJson(databaseName, query, DATABASE_ADMIN_ROLE)
    if (
      result.status === "error" ||
      typeof result.value !== "object" ||
      result.value === null ||
      Array.isArray(result.value)
    ) {
      return undefined
    }
    const metadataStatus = (result.value as Record<string, unknown>).metadataStatus
    return metadataStatus === "conflict" ||
      metadataStatus === "exact" ||
      metadataStatus === "missing"
      ? metadataStatus
      : undefined
  }

  function recordMigrationMetadata(
    databaseName: string,
    migration: ConfirmedMigrationInput
  ): boolean {
    if (!validMaintenanceDatabase(databaseName)) {
      return false
    }
    const metadata = metadataStatement(migration)
    return (
      metadata !== undefined &&
      sql(databaseName, metadata, "failed", DATABASE_ADMIN_ROLE).status === "ok"
    )
  }

  return {
    acquireLock(runId) {
      return dynamicExecutor.acquireLock(runId).status === "ok"
    },

    releaseLock(runId) {
      return dynamicExecutor.releaseLock(runId).status === "ok"
    },

    readState() {
      const result = remote(`cat ${shellQuote(oracleStatePath(config))}`)
      return result.status === "ok" ? parseStateText(result.value) : undefined
    },

    publishState(state) {
      const statePath = oracleStatePath(config)
      const stateDirectory = statePath.slice(0, statePath.lastIndexOf("/"))
      const temporaryPath = `${stateDirectory}/.current.${state.generation}.tmp`
      const result = remote(
        `set -eu
umask 077
state_directory=${shellQuote(stateDirectory)}
state_path=${shellQuote(statePath)}
temporary_path=${shellQuote(temporaryPath)}
mkdir -p "$state_directory"
cat > "$temporary_path"
chmod 600 "$temporary_path"
mv -f "$temporary_path" "$state_path"
chmod 400 "$state_path"`,
        `${stableJsonStringify(state)}\n`,
        "unavailable"
      )
      return result.status === "ok"
    },

    inspectDatabase,

    preflightRoles(databaseName) {
      if (!validMaintenanceDatabase(databaseName)) {
        return false
      }
      const result = readJson(databaseName, BASELINE_ROLE_PREFLIGHT_QUERY, DATABASE_ADMIN_ROLE)
      if (
        result.status === "error" ||
        typeof result.value !== "object" ||
        result.value === null ||
        Array.isArray(result.value)
      ) {
        return false
      }
      const facts = result.value as Record<string, unknown>
      return (
        facts.adminCanManageSchema === true &&
        facts.adminCanSetRole === true &&
        facts.adminCanWriteMetadata === true &&
        facts.postgresHasCreateOnPublic === false &&
        facts.postgresHasUsageOnPublic === true
      )
    },

    cleanupMigrationRole,

    applyMigration,

    inspectMigrationMetadata,

    recordMigrationMetadata,

    applyMigrations(databaseName, migrations) {
      if (!validMaintenanceDatabase(databaseName)) {
        return false
      }
      for (const migration of migrations) {
        const metadataStatus = inspectMigrationMetadata(databaseName, migration)
        if (metadataStatus === undefined || metadataStatus === "conflict") {
          return false
        }
        if (metadataStatus === "missing") {
          if (
            !applyMigration(databaseName, migration) ||
            !recordMigrationMetadata(databaseName, migration) ||
            inspectMigrationMetadata(databaseName, migration) !== "exact"
          ) {
            return false
          }
        }
      }
      return true
    },

    createRefreshDatabase(databaseName) {
      if (!/^dq_baseline_refresh_[a-z0-9_]+$/u.test(databaseName)) {
        return false
      }
      return (
        sql(
          "postgres",
          `CREATE DATABASE ${quotedIdentifier(databaseName)} OWNER ${quotedIdentifier(
            DATABASE_MIGRATION_ROLE
          )} TEMPLATE template0;`,
          "unavailable",
          DATABASE_ADMIN_ROLE
        ).status === "ok"
      )
    },

    restoreDump(databaseName, dumpPath) {
      if (!/^dq_baseline_refresh_[a-z0-9_]+$/u.test(databaseName) || !validDumpPath(dumpPath)) {
        return false
      }
      const extensionSql = sql(
        BASELINE_DATABASE,
        `SELECT COALESCE(string_agg(
  format(
    'CREATE SCHEMA IF NOT EXISTS %I; CREATE EXTENSION IF NOT EXISTS %I WITH SCHEMA %I;',
    n.nspname,
    e.extname,
    n.nspname
  ),
  E'\\n'
), '')
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname <> 'plpgsql';`,
        "unavailable"
      )
      if (
        extensionSql.status === "error" ||
        sql(databaseName, extensionSql.value, "unavailable").status === "error" ||
        sql(databaseName, "DROP SCHEMA IF EXISTS public CASCADE;", "unavailable").status === "error"
      ) {
        return false
      }
      const restored = remote(
        `docker exec -i ${config.containerName} pg_restore --single-transaction --exit-on-error --no-owner --no-privileges -U postgres -d ${shellQuote(databaseName)} < ${shellQuote(dumpPath)}`,
        undefined,
        "failed"
      )
      return restored.status === "ok"
    },

    restoreTechnicalConfigurationCatalogAcls(databaseName, catalog) {
      if (!validMaintenanceDatabase(databaseName)) {
        return false
      }
      const statement = technicalConfigurationCatalogAclStatement(catalog)
      return (
        statement !== undefined &&
        sql(databaseName, statement, "failed", DATABASE_ADMIN_ROLE).status === "ok"
      )
    },

    swapBaseline(databaseName, retiredDatabaseName) {
      if (
        !/^dq_baseline_refresh_[a-z0-9_]+$/u.test(databaseName) ||
        !/^dq_baseline_retired_[a-z0-9_]+$/u.test(retiredDatabaseName)
      ) {
        return false
      }
      const result = sql(
        "postgres",
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('${BASELINE_DATABASE}', '${databaseName}') AND pid <> pg_backend_pid();
ALTER DATABASE ${quotedIdentifier(BASELINE_DATABASE)} RENAME TO ${quotedIdentifier(retiredDatabaseName)};
ALTER DATABASE ${quotedIdentifier(databaseName)} RENAME TO ${quotedIdentifier(BASELINE_DATABASE)};`,
        "interrupted",
        DATABASE_ADMIN_ROLE
      )
      return result.status === "ok"
    },

    dropDatabase,
  }
}

/** Loads the strict Oracle configuration without exposing credentials in arguments or output. */
export function oracleBaselineMaintenanceExecutorFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): BaselineMaintenanceExecutor | undefined {
  const config = oracleRemoteExecutorConfigFromEnvironment(environment)
  return config === undefined
    ? undefined
    : createOracleBaselineMaintenanceExecutor({
        command: defaultOracleRemoteCommand,
        config,
      })
}
