import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

/** Input passed to the local SSH process transport without invoking a shell. */
export type OracleRemoteCommandInput = {
  arguments: string[]
  input?: string
  timeoutMs: number
}

/** Captured result from one local SSH process invocation. */
export type OracleRemoteCommandResult = {
  exitCode: number
  stderr: string
  stdout: string
  timedOut: boolean
}

/** Minimal Oracle VM connection data; credentials remain outside the repository. */
export type OracleRemoteExecutorConfig = {
  containerName: string
  evidenceDirectory: string
  host: string
  minimumFreeDiskKilobytes: number
  sshHostKeyFingerprint: string
  sshKeyPath: string
  sshKnownHostsPath: string
  sshUser: string
}

/** Dependency-injected construction inputs for the SSH/Docker-backed executor. */
export type OracleRemoteExecutorInput = {
  command: (input: OracleRemoteCommandInput) => OracleRemoteCommandResult
  config: OracleRemoteExecutorConfig
}

const DEFAULT_EVIDENCE_DIRECTORY = "/opt/supabase-test/quality-gate/evidence"
const DEFAULT_MINIMUM_FREE_DISK_KILOBYTES = 1_048_576

function validHost(value: string): boolean {
  return /^[a-zA-Z0-9.-]+$/.test(value)
}

function validIdentifier(value: string): boolean {
  return /^[a-z_][a-z0-9_]*$/.test(value)
}

function validContainerName(value: string): boolean {
  return /^[a-z0-9][a-z0-9_.-]*$/u.test(value)
}

function validAbsolutePath(value: string): boolean {
  return path.posix.isAbsolute(value) && !value.split("/").includes("..")
}

function validHostKeyFingerprint(value: string): boolean {
  return /^SHA256:[A-Za-z0-9+/]{43}$/u.test(value)
}

function knownHostFingerprint(host: string, knownHostsPath: string): string | undefined {
  try {
    const lines = readFileSync(knownHostsPath, "utf8").split(/\r?\n/u)
    for (const line of lines) {
      const [hosts, keyType, encodedKey] = line.trim().split(/\s+/u)
      if (
        hosts === undefined ||
        keyType === undefined ||
        encodedKey === undefined ||
        !hosts.split(",").includes(host) ||
        !/^(?:ecdsa|sk)-|^ssh-/u.test(keyType) ||
        !/^[A-Za-z0-9+/]+={0,2}$/u.test(encodedKey)
      ) {
        continue
      }

      return `SHA256:${createHash("sha256")
        .update(Buffer.from(encodedKey, "base64"))
        .digest("base64")
        .replace(/=+$/u, "")}`
    }
  } catch {
    return undefined
  }

  return undefined
}

/** Validates an immutable run ID before it becomes a remote lock or evidence path segment. */
export function validRunId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(value)
}

/** Validates the only database-name class permitted to receive dynamic writes. */
export function validDisposableDatabase(value: string): boolean {
  return /^dq_[a-z0-9_]{1,60}$/.test(value)
}

/** Quotes one remote shell value without concatenating untrusted tokens into a command. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`
}

/** Quotes one PostgreSQL identifier after its caller has checked the permitted database-name class. */
export function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

/** Reads strict Oracle-only executor configuration from process environment without exposing a secret. */
export function oracleRemoteExecutorConfigFromEnvironment(
  environment: NodeJS.ProcessEnv
): OracleRemoteExecutorConfig | undefined {
  const host = environment.ORACLE_DATABASE_QUALITY_GATE_HOST
  const sshUser = environment.ORACLE_DATABASE_QUALITY_GATE_SSH_USER
  const sshKeyPath = environment.ORACLE_DATABASE_QUALITY_GATE_SSH_KEY_PATH
  const sshKnownHostsPath = environment.ORACLE_DATABASE_QUALITY_GATE_SSH_KNOWN_HOSTS_PATH
  const sshHostKeyFingerprint = environment.ORACLE_DATABASE_QUALITY_GATE_SSH_HOST_KEY_FINGERPRINT
  const containerName = environment.ORACLE_DATABASE_QUALITY_GATE_CONTAINER ?? "supabase-db"
  const evidenceDirectory = environment.ORACLE_DATABASE_QUALITY_GATE_EVIDENCE_DIRECTORY
  const minimumFreeDiskKilobytes = Number.parseInt(
    environment.ORACLE_DATABASE_QUALITY_GATE_MINIMUM_FREE_DISK_KILOBYTES ??
      String(DEFAULT_MINIMUM_FREE_DISK_KILOBYTES),
    10
  )

  if (
    host === undefined ||
    sshUser === undefined ||
    sshKeyPath === undefined ||
    sshKnownHostsPath === undefined ||
    sshHostKeyFingerprint === undefined ||
    !validHost(host) ||
    !validIdentifier(sshUser) ||
    !validContainerName(containerName) ||
    !validAbsolutePath(sshKeyPath) ||
    !validAbsolutePath(sshKnownHostsPath) ||
    !validHostKeyFingerprint(sshHostKeyFingerprint) ||
    knownHostFingerprint(host, sshKnownHostsPath) !== sshHostKeyFingerprint ||
    (evidenceDirectory !== undefined && evidenceDirectory !== DEFAULT_EVIDENCE_DIRECTORY) ||
    !Number.isSafeInteger(minimumFreeDiskKilobytes) ||
    minimumFreeDiskKilobytes < 1
  ) {
    return undefined
  }

  return {
    containerName,
    evidenceDirectory: DEFAULT_EVIDENCE_DIRECTORY,
    host,
    minimumFreeDiskKilobytes,
    sshHostKeyFingerprint,
    sshKeyPath,
    sshKnownHostsPath,
    sshUser,
  }
}

/** Executes a fully argument-separated SSH command and reports timeout state without a shell. */
export function defaultOracleRemoteCommand(
  input: OracleRemoteCommandInput
): OracleRemoteCommandResult {
  const result = spawnSync("ssh", input.arguments, {
    encoding: "utf8",
    input: input.input,
    timeout: input.timeoutMs,
  })
  const stdout = typeof result.stdout === "string" ? result.stdout : ""
  const stderr = typeof result.stderr === "string" ? result.stderr : ""
  const errorCode =
    result.error instanceof Error && "code" in result.error && typeof result.error.code === "string"
      ? result.error.code
      : undefined

  return {
    exitCode: result.status ?? 1,
    stderr,
    stdout,
    timedOut: errorCode === "ETIMEDOUT" || result.signal === "SIGTERM",
  }
}
