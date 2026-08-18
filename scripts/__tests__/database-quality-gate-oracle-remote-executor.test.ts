import { createHash } from "node:crypto"
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type CommandInput = {
  arguments: string[]
  input?: string
  timeoutMs: number
}

type CommandResult = {
  exitCode: number
  stderr: string
  stdout: string
  timedOut: boolean
}

type OracleRemoteExecutorModule = {
  createOracleRemoteExecutor: (input: {
    command: (input: CommandInput) => CommandResult
    config: {
      containerName: string
      evidenceDirectory: string
      host: string
      minimumFreeDiskKilobytes: number
      sshKeyPath: string
      sshUser: string
    }
  }) => {
    acquireLock: (runId: string) => { status: string }
    applyMigrations: (input: {
      databaseName: string
      migrations: Array<{
        content: string
        path: string
        sha256: string
      }>
    }) => { status: string }
    createDatabase: (input: { databaseName: string; template?: "qltbyt_test" }) => {
      status: string
    }
    persistReport: (input: { report: string; runId: string }) => { status: string }
    preflight: () => {
      status: string
      value?: {
        baseline: {
          healthy: boolean
          migrationVersions: string[]
        }
      }
    }
    recoverOrphans: (prefix: string) => { status: string }
    releaseLock: (runId: string) => { status: string }
    runSqlTest: (input: {
      content: string
      databaseName: string
      fixtureContract: "isolated-fixture"
      path: string
      runnerRequirements: string[]
      timeoutSeconds: number
      transactionContract: "rollback-required"
    }) => { kind?: string; status: string }
  }
}

type OracleRemoteContractModule = {
  defaultOracleRemoteCommand: (input: CommandInput) => CommandResult
  oracleRemoteExecutorConfigFromEnvironment: (
    environment: NodeJS.ProcessEnv
  ) => Record<string, unknown> | undefined
}

function commandRecorder() {
  const commands: CommandInput[] = []

  return {
    command(input: CommandInput): CommandResult {
      commands.push(input)
      const remoteCommand = input.arguments.at(-1) ?? ""
      const fullCommand = `${remoteCommand}\n${input.input ?? ""}`

      if (remoteCommand.includes("df -Pk")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout:
            "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vda1 100 10 90 10% /\n",
          timedOut: false,
        }
      }
      if (remoteCommand.includes("docker inspect")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: "true\n",
          timedOut: false,
        }
      }
      if (fullCommand.includes("baseline_exists")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: "true\n",
          timedOut: false,
        }
      }
      if (fullCommand.includes("schema_migrations")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: '["20270101000000"]\n',
          timedOut: false,
        }
      }
      if (fullCommand.includes("pg_database") && fullCommand.includes("left(datname")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: "dq_stale_run\n",
          timedOut: false,
        }
      }

      return {
        exitCode: 0,
        stderr: "",
        stdout: "",
        timedOut: false,
      }
    },
    commands,
  }
}

function executorInput(command: (input: CommandInput) => CommandResult) {
  return {
    command,
    config: {
      containerName: "supabase-db",
      evidenceDirectory: "/opt/supabase-test/quality-gate/evidence",
      host: "oracle.test",
      minimumFreeDiskKilobytes: 64,
      sshHostKeyFingerprint: "SHA256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sshKeyPath: "/tmp/oracle-test.key",
      sshKnownHostsPath: "/tmp/oracle-test.known_hosts",
      sshUser: "ubuntu",
    },
  }
}

describe("database quality gate Oracle remote executor", () => {
  it("fails closed for unpinned Oracle configuration or an evidence-directory escape", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteContractModule>("oracle-remote-contract")
    const knownHostDirectory = mkdtempSync(path.join(tmpdir(), "dq-known-hosts-"))
    const knownHostPath = path.join(knownHostDirectory, "known_hosts")
    const hostKey = Buffer.from("database-quality-gate-oracle-host-key").toString("base64")
    const hostKeyFingerprint = `SHA256:${createHash("sha256")
      .update(Buffer.from(hostKey, "base64"))
      .digest("base64")
      .replace(/=+$/u, "")}`
    writeFileSync(knownHostPath, `oracle.test ssh-ed25519 ${hostKey}\n`)

    const attestedEnvironment = {
      ORACLE_DATABASE_QUALITY_GATE_HOST: "oracle.test",
      ORACLE_DATABASE_QUALITY_GATE_SSH_HOST_KEY_FINGERPRINT: hostKeyFingerprint,
      ORACLE_DATABASE_QUALITY_GATE_SSH_KEY_PATH: "/tmp/oracle-test.key",
      ORACLE_DATABASE_QUALITY_GATE_SSH_KNOWN_HOSTS_PATH: knownHostPath,
      ORACLE_DATABASE_QUALITY_GATE_SSH_USER: "ubuntu",
    }

    expect(
      source.oracleRemoteExecutorConfigFromEnvironment({
        ...attestedEnvironment,
        ORACLE_DATABASE_QUALITY_GATE_EVIDENCE_DIRECTORY:
          "/opt/supabase-test/quality-gate/evidence/../../outside",
      })
    ).toBeUndefined()
    expect(source.oracleRemoteExecutorConfigFromEnvironment(attestedEnvironment)).toEqual(
      expect.objectContaining({
        host: "oracle.test",
      })
    )
    expect(
      source.oracleRemoteExecutorConfigFromEnvironment({
        ORACLE_DATABASE_QUALITY_GATE_HOST: "untrusted.example.test",
        ORACLE_DATABASE_QUALITY_GATE_SSH_KEY_PATH: "/tmp/oracle-test.key",
        ORACLE_DATABASE_QUALITY_GATE_SSH_USER: "ubuntu",
      })
    ).toBeUndefined()
  })

  it("performs only SSH/Docker health checks without a tunnel, Supabase CLI, or secret-bearing command", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    const preflight = executor.preflight()
    const remoteCommands = recorder.commands.map(
      (command) => `${command.arguments.at(-1) ?? ""}\n${command.input ?? ""}`
    )

    expect(preflight.status).toBe("ok")
    expect(preflight.value?.baseline).toEqual({
      healthy: true,
      migrationVersions: ["20270101000000"],
    })
    expect(remoteCommands.join("\n")).toContain("docker exec -i supabase-db psql")
    expect(remoteCommands.join("\n")).not.toContain("supabase db")
    expect(recorder.commands.flatMap((command) => command.arguments)).not.toContain("-L")
    expect(remoteCommands.join("\n")).not.toContain("password")
  })

  it("uses an owner-leased remote lock with stale recovery and removes only disposable orphan databases", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    expect(executor.acquireLock("phase4-run").status).toBe("ok")
    expect(executor.acquireLock("second-run").status).toBe("ok")
    expect(executor.recoverOrphans("dq_baseline_forward_").status).toBe("ok")
    expect(executor.releaseLock("phase4-run").status).toBe("ok")

    const remoteCommands = recorder.commands.map(
      (command) => `${command.arguments.at(-1) ?? ""}\n${command.input ?? ""}`
    )
    const lockCommands = remoteCommands.filter((command) => command.includes("/locks/"))

    expect(remoteCommands.join("\n")).toContain("mkdir")
    expect(remoteCommands.join("\n")).toContain("left(datname")
    expect(remoteCommands.join("\n")).not.toContain("datname LIKE")
    expect(remoteCommands.join("\n")).toContain('DROP DATABASE "dq_stale_run"')
    expect(
      remoteCommands.find((command) => command.includes('DROP DATABASE "dq_stale_run"'))
    ).toContain("-U supabase_admin")
    expect(remoteCommands.join("\n")).not.toContain('DROP DATABASE "qltbyt_test"')
    expect(remoteCommands.join("\n")).toContain("rmdir")
    expect(lockCommands.join("\n")).toContain("owner")
    expect(lockCommands.join("\n")).toContain("lease")
    expect(lockCommands.join("\n")).toContain(".stale.")
    expect(lockCommands.join("\n")).toContain("mv ")
    expect(lockCommands).toHaveLength(3)
    expect(lockCommands).toEqual(
      expect.arrayContaining([expect.stringContaining("/locks/dynamic-lane.lock")])
    )
    expect(lockCommands.join("\n")).toContain("phase4-run")
    expect(lockCommands.join("\n")).toContain("second-run")
  })

  it("keeps transport loss after preflight INCOMPLETE instead of treating it as a candidate SQL failure", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(
      executorInput((input) => {
        if (input.input?.includes("candidate_only") || input.input === "SELECT 1;") {
          return {
            exitCode: 255,
            stderr: "Connection to oracle.test closed",
            stdout: "",
            timedOut: false,
          }
        }
        return recorder.command(input)
      })
    )

    const result = executor.applyMigrations({
      databaseName: "dq_baseline_forward_phase4_run",
      migrations: [
        {
          content: "CREATE TABLE public.candidate_only (id bigint PRIMARY KEY);",
          path: "supabase/migrations/20270201000000_candidate.sql",
          sha256: "a".repeat(64),
        },
      ],
    })

    expect(result).toMatchObject({
      kind: "unavailable",
      status: "error",
    })
  })

  it("rejects END transaction control in SQL tests before remote execution", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    const result = executor.runSqlTest({
      content: "BEGIN;\nSELECT 1;\nEND;\nROLLBACK;\n",
      databaseName: "dq_baseline_forward_phase4_run",
      fixtureContract: "isolated-fixture",
      path: "supabase/tests/malicious.sql",
      runnerRequirements: ["psql"],
      timeoutSeconds: 30,
      transactionContract: "rollback-required",
    })

    expect(result).toMatchObject({
      kind: "stale-environment",
      status: "error",
    })
    expect(recorder.commands).toHaveLength(0)
  })

  it("rejects psql meta commands in candidate migrations before remote execution", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    const result = executor.applyMigrations({
      databaseName: "dq_baseline_forward_phase4_run",
      migrations: [
        {
          content: "CREATE TABLE public.candidate_only (id bigint);\n\\connect qltbyt_test\n",
          path: "supabase/migrations/20270201000000_candidate.sql",
          sha256: "a".repeat(64),
        },
      ],
    })

    expect(result).toMatchObject({ kind: "stale-environment", status: "error" })
    expect(recorder.commands).toHaveLength(0)
  })

  it("owns the SQL-test transaction envelope after removing its declared outer rollback", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    expect(
      executor.runSqlTest({
        content: "BEGIN;\nDO $$\nBEGIN\n  PERFORM 1;\nEND\n$$;\nSELECT 1;\nROLLBACK;\n",
        databaseName: "dq_baseline_forward_phase4_run",
        fixtureContract: "isolated-fixture",
        path: "supabase/tests/example.sql",
        runnerRequirements: ["psql"],
        timeoutSeconds: 30,
        transactionContract: "rollback-required",
      }).status
    ).toBe("ok")

    expect(recorder.commands.at(-1)?.input).toBe(
      "BEGIN;\nSET LOCAL statement_timeout = 30000;\nDO $$\nBEGIN\n  PERFORM 1;\nEND\n$$;\nSELECT 1;\nROLLBACK;"
    )
  })

  it("rejects baseline mutation while allowing a clone and candidate SQL on a disposable database", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    expect(executor.createDatabase({ databaseName: "qltbyt_test" }).status).toBe("error")
    expect(
      executor.applyMigrations({
        databaseName: "qltbyt_test",
        migrations: [
          {
            content: "CREATE TABLE public.should_not_run (id bigint);\n",
            path: "supabase/migrations/20270201000000_candidate.sql",
            sha256: "a".repeat(64),
          },
        ],
      }).status
    ).toBe("error")
    expect(
      executor.createDatabase({
        databaseName: "dq_baseline_forward_phase4_run",
        template: "qltbyt_test",
      }).status
    ).toBe("ok")
    expect(
      executor.applyMigrations({
        databaseName: "dq_baseline_forward_phase4_run",
        migrations: [
          {
            content: "CREATE TABLE public.candidate_only (id bigint);\n",
            path: "supabase/migrations/20270201000000_candidate.sql",
            sha256: "b".repeat(64),
          },
        ],
      }).status
    ).toBe("ok")

    const remoteCommands = recorder.commands.map(
      (command) => `${command.arguments.at(-1) ?? ""}\n${command.input ?? ""}`
    )
    expect(remoteCommands.join("\n")).toContain(
      'CREATE DATABASE "dq_baseline_forward_phase4_run" TEMPLATE "qltbyt_test"'
    )
    expect(
      remoteCommands.find((command) =>
        command.includes('CREATE DATABASE "dq_baseline_forward_phase4_run" TEMPLATE "qltbyt_test"')
      )
    ).toContain("-U supabase_admin")
    expect(remoteCommands.join("\n")).not.toContain("should_not_run")
    expect(recorder.commands.some((command) => command.input?.includes("candidate_only"))).toBe(
      true
    )
  })

  it("writes deterministic report evidence under a new immutable Oracle run directory", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    expect(
      executor.persistReport({
        report: '{"outcome":"PASS"}\n',
        runId: "phase4-run",
      }).status
    ).toBe("ok")

    const command = recorder.commands.at(-1)
    expect(command?.arguments.at(-1)).toContain("mkdir")
    expect(command?.arguments.at(-1)).not.toContain("test ! -e")
    expect(command?.arguments.at(-1)).toContain("chmod")
    expect(command?.arguments.at(-1)).toContain("phase4-run")
    expect(command?.input).toBe('{"outcome":"PASS"}\n')
  })

  it("uses a non-keyword alias for pg_constraint in the application catalog query", async () => {
    const source = await loadDatabaseQualityGateModule<{
      ACCESS_CATALOG_QUERY: string
      APPLICATION_CATALOG_QUERY: string
    }>("oracle-catalog-queries")

    expect(source.APPLICATION_CATALOG_QUERY).toContain("FROM pg_constraint constraint_row")
    expect(source.APPLICATION_CATALOG_QUERY).toContain(
      "pg_get_constraintdef(constraint_row.oid, true)"
    )
    expect(source.APPLICATION_CATALOG_QUERY).not.toMatch(/\bconstraint\./)
    expect(source.APPLICATION_CATALOG_QUERY).toContain("'extensionOwned', EXISTS")
    expect(source.ACCESS_CATALOG_QUERY).toContain("'extensionOwned', EXISTS")
  })

  it("keeps complete catalog output above the Node default spawn buffer", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteContractModule>("oracle-remote-contract")
    const commandDirectory = mkdtempSync(path.join(tmpdir(), "dq-ssh-command-"))
    const sshPath = path.join(commandDirectory, "ssh")
    const originalPath = process.env.PATH

    writeFileSync(sshPath, "#!/bin/sh\nhead -c 1100000 /dev/zero | tr '\\0' x\n")
    chmodSync(sshPath, 0o700)
    process.env.PATH = `${commandDirectory}:${originalPath ?? ""}`

    try {
      const result = source.defaultOracleRemoteCommand({
        arguments: [],
        timeoutMs: 5_000,
      })

      expect(result.exitCode).toBe(0)
      expect(result.timedOut).toBe(false)
      expect(result.stdout).toHaveLength(1_100_000)
    } finally {
      process.env.PATH = originalPath
    }
  })
})
