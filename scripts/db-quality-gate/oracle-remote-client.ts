import { shellQuote } from "./oracle-remote-contract"
import type {
  OracleRemoteExecutorConfig,
  OracleRemoteExecutorInput,
} from "./oracle-remote-contract"
import type { DynamicFailureKind, OracleExecutorResult } from "./dynamic-lane-types"

const DEFAULT_TIMEOUT_MS = 120_000

/** Builds a typed fail-closed Oracle executor error result. */
export function oracleErrorResult<T>(
  kind: DynamicFailureKind,
  error: string
): OracleExecutorResult<T> {
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

export type OracleRemoteClient = {
  readJson: (databaseName: string, statement: string) => OracleExecutorResult<unknown>
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
      return oracleErrorResult("timeout", "Oracle SSH command timed out")
    }
    if (result.exitCode !== 0) {
      return oracleErrorResult(failureKind, result.stderr.trim() || "Oracle SSH command failed")
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
    return health.status === "ok" ? oracleErrorResult("failed", result.error) : health
  }

  function readJson(databaseName: string, statement: string): OracleExecutorResult<unknown> {
    const result = sql(databaseName, statement, "unavailable")
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
