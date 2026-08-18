import {
  ACCESS_CATALOG_QUERY,
  APPLICATION_CATALOG_QUERY,
  ENVIRONMENT_CATALOG_QUERY,
} from "./oracle-catalog-queries"
import {
  defaultOracleRemoteCommand,
  oracleRemoteExecutorConfigFromEnvironment,
  quotedIdentifier,
  shellQuote,
  validDisposableDatabase,
  validRunId,
} from "./oracle-remote-contract"
import { hasPsqlMetaCommand, rollbackRequiredSqlTestBody } from "./oracle-remote-sql"
import type {
  DynamicFailureKind,
  OracleDynamicExecutor,
  OracleExecutorResult,
} from "./dynamic-lane-types"
import type { OracleRemoteExecutorInput } from "./oracle-remote-contract"

export type {
  OracleRemoteCommandInput,
  OracleRemoteCommandResult,
  OracleRemoteExecutorConfig,
  OracleRemoteExecutorInput,
} from "./oracle-remote-contract"

const BASELINE_DATABASE = "qltbyt_test"
const DATABASE_ADMIN_ROLE = "supabase_admin"
const DEFAULT_TIMEOUT_MS = 120_000
const GLOBAL_LOCK_NAME = "dynamic-lane.lock"
const LOCK_LEASE_SECONDS = 30 * 60

function errorResult<T>(kind: DynamicFailureKind, error: string): OracleExecutorResult<T> {
  return {
    error,
    kind,
    status: "error",
  }
}

function parseJsonOutput(value: string): unknown | undefined {
  try {
    return JSON.parse(value.trim()) as unknown
  } catch {
    return undefined
  }
}

/** Creates the production SSH/Docker executor only when strict Oracle-only configuration exists. */
export function oracleRemoteExecutorFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): OracleDynamicExecutor | undefined {
  const config = oracleRemoteExecutorConfigFromEnvironment(environment)
  return config === undefined
    ? undefined
    : createOracleRemoteExecutor({
        command: defaultOracleRemoteCommand,
        config,
      })
}

/** Creates an executor that reaches only the loopback-bound PostgreSQL container on the Oracle VM. */
export function createOracleRemoteExecutor(
  input: OracleRemoteExecutorInput
): OracleDynamicExecutor {
  const { command, config } = input

  function remote(
    remoteCommand: string,
    inputText?: string,
    failureKind: DynamicFailureKind = "unavailable"
  ): OracleExecutorResult<string> {
    const result = command({
      arguments: [
        "-i",
        config.sshKeyPath,
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=15",
        "-o",
        "GlobalKnownHostsFile=/dev/null",
        "-o",
        "StrictHostKeyChecking=yes",
        "-o",
        `UserKnownHostsFile=${config.sshKnownHostsPath}`,
        `${config.sshUser}@${config.host}`,
        remoteCommand,
      ],
      input: inputText,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    })
    if (result.timedOut) {
      return errorResult("timeout", "Oracle SSH command timed out")
    }
    if (result.exitCode !== 0) {
      return errorResult(failureKind, result.stderr.trim() || "Oracle SSH command failed")
    }

    return {
      status: "ok",
      value: result.stdout,
    }
  }

  function sql(
    databaseName: string,
    statement: string,
    failureKind: DynamicFailureKind,
    role = "postgres"
  ): OracleExecutorResult<string> {
    const remoteCommand = `docker exec -i ${config.containerName} psql -X -v ON_ERROR_STOP=1 -U ${role} -d ${shellQuote(databaseName)} -tA`
    const result = remote(remoteCommand, statement)
    if (result.status === "ok" || failureKind !== "failed" || result.kind !== "unavailable") {
      return result
    }

    const health = remote(remoteCommand, "SELECT 1;")
    return health.status === "ok" ? errorResult("failed", result.error) : health
  }

  function readJson(databaseName: string, statement: string): OracleExecutorResult<unknown> {
    const result = sql(databaseName, statement, "unavailable")
    if (result.status === "error") {
      return result
    }
    const value = parseJsonOutput(result.value)
    return value === undefined
      ? errorResult("unavailable", "Oracle catalog query returned invalid JSON")
      : { status: "ok", value }
  }

  return {
    preflight() {
      const container = remote(
        `docker inspect -f '{{.State.Running}}' ${config.containerName}`,
        undefined,
        "unavailable"
      )
      if (container.status === "error") {
        return container
      }
      if (container.value.trim() !== "true") {
        return errorResult("unavailable", "Oracle Supabase database container is not running")
      }

      const disk = remote(`df -Pk /opt/supabase-test`, undefined, "disk-pressure")
      if (disk.status === "error") {
        return disk
      }
      const availableDisk = Number.parseInt(disk.value.trim().split(/\s+/).at(-3) ?? "", 10)
      if (!Number.isSafeInteger(availableDisk) || availableDisk < config.minimumFreeDiskKilobytes) {
        return errorResult(
          "disk-pressure",
          "Oracle disk headroom is insufficient for a disposable run"
        )
      }

      const baselineExists = sql(
        "postgres",
        `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${BASELINE_DATABASE}')::text AS baseline_exists;`,
        "stale-environment"
      )
      if (baselineExists.status === "error") {
        return baselineExists
      }
      if (baselineExists.value.trim() !== "true") {
        return errorResult("stale-environment", "Restored Oracle baseline is missing")
      }

      const versions = readJson(
        BASELINE_DATABASE,
        "SELECT COALESCE(json_agg(version ORDER BY version), '[]'::json)::text FROM supabase_migrations.schema_migrations;"
      )
      if (versions.status === "error") {
        return versions
      }
      if (
        !Array.isArray(versions.value) ||
        versions.value.some((version) => typeof version !== "string")
      ) {
        return errorResult("stale-environment", "Oracle baseline migration evidence is invalid")
      }

      return {
        status: "ok",
        value: {
          baseline: {
            healthy: true,
            migrationVersions: versions.value,
          },
          executorEnvironment: {
            execution: "oracle-disposable",
            transport: "ssh-docker",
          },
        },
      }
    },

    acquireLock(runId) {
      if (!validRunId(runId)) {
        return errorResult("interrupted", "Invalid Oracle dynamic-lane run ID")
      }
      const lockRoot = `${config.evidenceDirectory}/../locks`
      const lockPath = `${lockRoot}/${GLOBAL_LOCK_NAME}`
      return remote(
        `set -eu
umask 077
lock_root=${shellQuote(lockRoot)}
lock_path=${shellQuote(lockPath)}
run_id=${shellQuote(runId)}
mkdir -p "$lock_root"
if mkdir "$lock_path" 2>/dev/null; then
  now=$(date -u +%s)
  lease_expires_at=$((now + ${LOCK_LEASE_SECONDS}))
  printf '%s %s\n' "$run_id" "$lease_expires_at" > "$lock_path/owner"
  exit 0
fi
owner_file="$lock_path/owner"
[ -f "$owner_file" ] || exit 1
owner_run_id=
owner_lease_expires_at=
IFS=' ' read -r owner_run_id owner_lease_expires_at < "$owner_file" || exit 1
case "$owner_run_id" in ""|*[!A-Za-z0-9._-]*) exit 1 ;; esac
case "$owner_lease_expires_at" in ""|*[!0-9]*) exit 1 ;; esac
now=$(date -u +%s)
[ "$owner_lease_expires_at" -lt "$now" ] || exit 1
stale_path="$lock_root/${GLOBAL_LOCK_NAME}.stale.\${owner_lease_expires_at}.$$"
mv "$lock_path" "$stale_path" || exit 1
mkdir "$lock_path" || exit 1
now=$(date -u +%s)
lease_expires_at=$((now + ${LOCK_LEASE_SECONDS}))
printf '%s %s\n' "$run_id" "$lease_expires_at" > "$lock_path/owner"`,
        undefined,
        "interrupted"
      ).status === "ok"
        ? { status: "ok", value: undefined }
        : errorResult("interrupted", "Oracle dynamic-lane lock is unavailable")
    },

    releaseLock(runId) {
      if (!validRunId(runId)) {
        return errorResult("cleanup", "Invalid Oracle dynamic-lane run ID")
      }
      const lockPath = `${config.evidenceDirectory}/../locks/${GLOBAL_LOCK_NAME}`
      const result = remote(
        `set -eu
lock_path=${shellQuote(lockPath)}
run_id=${shellQuote(runId)}
owner_file="$lock_path/owner"
[ -f "$owner_file" ] || exit 1
owner_run_id=
owner_lease_expires_at=
IFS=' ' read -r owner_run_id owner_lease_expires_at < "$owner_file" || exit 1
[ "$owner_run_id" = "$run_id" ] || exit 1
rm "$owner_file"
rmdir "$lock_path"`,
        undefined,
        "cleanup"
      )
      return result.status === "ok"
        ? { status: "ok", value: undefined }
        : errorResult("cleanup", "Oracle dynamic-lane lock cleanup failed")
    },

    recoverOrphans(prefix) {
      if (!/^dq_[a-z0-9_]*$/.test(prefix)) {
        return errorResult("cleanup", "Invalid disposable database prefix")
      }
      const listed = sql(
        "postgres",
        `SELECT datname FROM pg_database WHERE left(datname, ${prefix.length}) = '${prefix}' ORDER BY datname;`,
        "cleanup"
      )
      if (listed.status === "error") {
        return listed
      }

      for (const databaseName of listed.value.split(/\r?\n/).filter(Boolean)) {
        if (!validDisposableDatabase(databaseName)) {
          return errorResult("cleanup", "Oracle orphan recovery returned a non-disposable database")
        }
        const dropped = sql(
          "postgres",
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid();\nDROP DATABASE ${quotedIdentifier(databaseName)};`,
          "cleanup",
          DATABASE_ADMIN_ROLE
        )
        if (dropped.status === "error") {
          return dropped
        }
      }

      return { status: "ok", value: undefined }
    },

    createDatabase({ databaseName, template }) {
      if (!validDisposableDatabase(databaseName)) {
        return errorResult("stale-environment", "Only disposable database names may be created")
      }
      if (template !== undefined && template !== BASELINE_DATABASE) {
        return errorResult("stale-environment", "Only qltbyt_test may be cloned as a baseline")
      }
      const statement =
        template === undefined
          ? `CREATE DATABASE ${quotedIdentifier(databaseName)};`
          : `CREATE DATABASE ${quotedIdentifier(databaseName)} TEMPLATE ${quotedIdentifier(template)};`
      const created = sql("postgres", statement, "unavailable", DATABASE_ADMIN_ROLE)
      return created.status === "ok"
        ? { status: "ok", value: undefined }
        : errorResult(created.kind, created.error)
    },

    applyMigrations({ databaseName, migrations }) {
      if (!validDisposableDatabase(databaseName)) {
        return errorResult("stale-environment", "Migrations may run only on a disposable database")
      }
      if (
        migrations.some(
          (migration) =>
            !migration.path.startsWith("supabase/migrations/") ||
            migration.content.trim().length === 0 ||
            hasPsqlMetaCommand(migration.content)
        )
      ) {
        return errorResult("stale-environment", "Migration input is incomplete")
      }
      const content = migrations
        .map((migration) => `-- ${migration.path}\n${migration.content.trimEnd()}\n`)
        .join("\n")
      const applied = sql(databaseName, content, "failed")
      return applied.status === "ok"
        ? { status: "ok", value: undefined }
        : errorResult(applied.kind, applied.error)
    },

    collectCatalogs({ databaseName }) {
      if (databaseName !== BASELINE_DATABASE && !validDisposableDatabase(databaseName)) {
        return errorResult(
          "stale-environment",
          "Catalogs may be collected only from the baseline or a disposable database"
        )
      }
      const application = readJson(databaseName, APPLICATION_CATALOG_QUERY)
      const access = readJson(databaseName, ACCESS_CATALOG_QUERY)
      const environment = readJson(databaseName, ENVIRONMENT_CATALOG_QUERY)
      if (application.status === "error") {
        return application
      }
      if (access.status === "error") {
        return access
      }
      if (environment.status === "error") {
        return environment
      }

      return {
        status: "ok",
        value: {
          access: access.value,
          application: application.value,
          environment: environment.value,
        },
      }
    },

    runSqlTest({
      content,
      databaseName,
      fixtureContract,
      path: sqlTestPath,
      runnerRequirements,
      timeoutSeconds,
      transactionContract,
    }) {
      if (!validDisposableDatabase(databaseName) || !sqlTestPath.startsWith("supabase/tests/")) {
        return errorResult("stale-environment", "SQL test target is not disposable-safe")
      }
      const body = rollbackRequiredSqlTestBody(content)
      if (
        content.trim().length === 0 ||
        timeoutSeconds < 1 ||
        fixtureContract !== "isolated-fixture" ||
        transactionContract !== "rollback-required" ||
        !runnerRequirements.includes("psql") ||
        runnerRequirements.includes("psql-meta-commands") ||
        body === undefined
      ) {
        return errorResult("stale-environment", "SQL test input is incomplete")
      }
      const result = sql(
        databaseName,
        `BEGIN;\nSET LOCAL statement_timeout = ${Math.floor(timeoutSeconds * 1000)};\n${body}\nROLLBACK;`,
        "failed"
      )
      return result.status === "ok"
        ? { status: "ok", value: undefined }
        : errorResult(result.kind, result.error)
    },

    persistReport({ report, runId }) {
      if (!validRunId(runId)) {
        return errorResult("unavailable", "Invalid immutable Oracle evidence run ID")
      }
      const directory = `${config.evidenceDirectory}/${runId}`
      const result = remote(
        `umask 077; mkdir -p ${shellQuote(config.evidenceDirectory)} && mkdir ${shellQuote(directory)} && cat > ${shellQuote(`${directory}/report.json`)} && chmod a-w ${shellQuote(`${directory}/report.json`)} && chmod a-w ${shellQuote(directory)}`,
        report,
        "unavailable"
      )
      return result.status === "ok"
        ? { status: "ok", value: { evidenceId: `oracle:${runId}` } }
        : errorResult(result.kind, result.error)
    },

    dropDatabase(databaseName) {
      if (!validDisposableDatabase(databaseName)) {
        return errorResult("cleanup", "Only disposable databases may be dropped")
      }
      const result = sql(
        "postgres",
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid();\nDROP DATABASE ${quotedIdentifier(databaseName)};`,
        "cleanup",
        DATABASE_ADMIN_ROLE
      )
      return result.status === "ok"
        ? { status: "ok", value: undefined }
        : errorResult(result.kind, result.error)
    },
  }
}
