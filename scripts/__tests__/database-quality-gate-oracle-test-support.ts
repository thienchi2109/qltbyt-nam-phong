export type CommandInput = {
  arguments: string[]
  input?: string
  timeoutMs: number
}

export type CommandResult = {
  exitCode: number
  stderr: string
  stdout: string
  timedOut: boolean
}

export function commandRecorder() {
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
      if (remoteCommand.includes("/baseline/current.json")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: `${JSON.stringify({
            checkedAt: "2026-08-19T11:00:00Z",
            confirmedMigrations: [
              {
                liveName: "already_in_baseline",
                liveVersion: "20270101000000",
                path: "supabase/migrations/20270101000000_already_in_baseline.sql",
                sha256: "a".repeat(64),
              },
            ],
            generation: "phase5-baseline",
            healthy: true,
            migrationHighWater: "20270101000000",
            schemaVersion: 1,
            sourceCommit: "a".repeat(40),
          })}\n`,
          timedOut: false,
        }
      }
      if (fullCommand.includes("schema_migrations")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: `${JSON.stringify({
            healthy: true,
            invalidIndexCount: 0,
            migrationHighWater: "20270101000000",
            migrationRecords: [
              {
                liveName: "already_in_baseline",
                liveVersion: "20270101000000",
                sqlSha256: "a".repeat(64),
              },
            ],
            unvalidatedConstraintCount: 0,
          })}\n`,
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

export function executorInput(command: (input: CommandInput) => CommandResult) {
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
