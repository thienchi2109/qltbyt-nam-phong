import { shellQuote } from "./oracle-remote-contract"
import type {
  OracleRemoteExecutorConfig,
  OracleRemoteExecutorInput,
} from "./oracle-remote-contract"
import type { DynamicFailureKind, OracleExecutorResult } from "./dynamic-lane-types"
import { classifyOracleDiagnostic } from "./oracle-diagnostics"
import type { OracleDiagnostic } from "./oracle-diagnostics"

const DEFAULT_TIMEOUT_MS = 120_000

/** Builds a typed fail-closed Oracle executor error result. */
export function oracleErrorResult<T>(
  kind: DynamicFailureKind,
  error: string,
  diagnostic?: OracleDiagnostic
): OracleExecutorResult<T> {
  return {
    ...(diagnostic === undefined ? {} : { diagnostic }),
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

export type OracleRemoteClient = {
  readJson: (
    databaseName: string,
    statement: string,
    role?: string
  ) => OracleExecutorResult<unknown>
  remote: (
    remoteCommand: string,
    inputText?: string,
    failureKind?: DynamicFailureKind
  ) => OracleExecutorResult<string>
  sql: (
    databaseName: string,
    statement: string,
    failureKind: DynamicFailureKind,
    role?: string
  ) => OracleExecutorResult<string>
}

/** Creates the shared argument-safe SSH and psql transport for Oracle-only executors. */
export function createOracleRemoteClient(input: OracleRemoteExecutorInput): OracleRemoteClient {
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
      return oracleErrorResult(
        "timeout",
        "Oracle SSH command timed out",
        result.stderr.length === 0 ? undefined : classifyOracleDiagnostic(result.stderr)
      )
    }
    if (result.exitCode !== 0) {
      return oracleErrorResult(
        failureKind,
        "Oracle SSH command failed",
        classifyOracleDiagnostic(result.stderr)
      )
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
    const remoteCommand = `docker exec -i ${config.containerName} psql -X -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -U ${role} -d ${shellQuote(databaseName)} -tA`
    const result = remote(remoteCommand, statement)
    if (result.status === "ok" || failureKind !== "failed" || result.kind !== "unavailable") {
      return result
    }

    const health = remote(remoteCommand, "SELECT 1;")
    return health.status === "ok"
      ? oracleErrorResult("failed", "Oracle SQL command failed", result.diagnostic)
      : health
  }

  function readJson(
    databaseName: string,
    statement: string,
    role?: string
  ): OracleExecutorResult<unknown> {
    const result = sql(databaseName, statement, "unavailable", role)
    if (result.status === "error") {
      return result
    }
    const value = parseJsonOutput(result.value)
    return value === undefined
      ? oracleErrorResult("unavailable", "Oracle catalog query returned invalid JSON")
      : { status: "ok", value }
  }

  return { readJson, remote, sql }
}

/** Returns the fixed atomic baseline-state path adjacent to immutable evidence. */
export function oracleStatePath(config: OracleRemoteExecutorConfig): string {
  return `${config.evidenceDirectory}/../baseline/current.json`
}
