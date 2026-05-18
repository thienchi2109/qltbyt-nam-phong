import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "..", "..")
const scriptPath = path.join(repoRoot, "scripts", "backup-db.sh")

const tempDirs: string[] = []

function makeTempDir() {
  const dir = path.join(os.tmpdir(), `backup-db-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  tempDirs.push(dir)
  return dir
}

function writeExecutable(filePath: string, content: string) {
  writeFileSync(filePath, content)
  chmodSync(filePath, 0o755)
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    spawnSync("rm", ["-rf", dir], { stdio: "ignore" })
  }
})

describe("backup-db.sh", () => {
  it("writes a local dump without requiring rclone", () => {
    const tempDir = makeTempDir()
    const fakeBinDir = path.join(tempDir, "bin")
    mkdirSync(fakeBinDir, { recursive: true })

    const curlCapture = path.join(tempDir, "curl-args.txt")
    const backupDir = path.join(tempDir, "local-backups")
    const envFile = path.join(tempDir, ".env")
    const logFile = path.join(tempDir, "backup.log")
    const lockFile = path.join(tempDir, "backup.lock")

    writeFileSync(
      envFile,
      [
        'DATABASE_URL="postgresql://postgres:secret@example.supabase.co:5432/postgres?sslmode=require"',
        `BACKUP_DIR="${backupDir}"`,
        'TG_TOKEN="token"',
        'TG_CHAT="123"',
        'TG_HEARTBEAT=1',
      ].join("\n")
    )

    writeExecutable(
      path.join(fakeBinDir, "psql"),
      "#!/usr/bin/env bash\nexit 0\n"
    )
    writeExecutable(
      path.join(fakeBinDir, "flock"),
      "#!/usr/bin/env bash\nexit 0\n"
    )
    writeExecutable(
      path.join(fakeBinDir, "pg_dump"),
      "#!/usr/bin/env bash\nprintf '%2048s' | tr ' ' x\n"
    )
    writeExecutable(
      path.join(fakeBinDir, "curl"),
      `#!/usr/bin/env bash
set -eu
printf '%s\n' "$@" > "${curlCapture}"
exit 0
`
    )

    const result = spawnSync("bash", [scriptPath], {
      env: {
        ...process.env,
        PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
        BACKUP_ENV_FILE: envFile,
        BACKUP_LOG_FILE: logFile,
        BACKUP_LOCK_FILE: lockFile,
      },
      encoding: "utf8",
    })

    expect(result.status).toBe(0)

    const dumps = readdirSync(backupDir).filter((name) => name.endsWith(".dump"))
    expect(dumps).toHaveLength(1)
    const dumpPath = path.join(backupDir, dumps[0])
    expect(statSync(dumpPath).size).toBe(2048)
    expect(statSync(dumpPath).mode & 0o777).toBe(0o600)

    const curlArgs = readFileSync(curlCapture, "utf8")
    const logOutput = readFileSync(logFile, "utf8")

    expect(curlArgs).toContain("OK")
    expect(curlArgs).toContain("File:")
    expect(curlArgs).toContain(backupDir)

    expect(logOutput).toContain("OK local backup size")
    expect(logOutput).toContain("DONE")
  })

  it("writes detailed stderr files for failed pg_dump attempts", () => {
    const tempDir = makeTempDir()
    const fakeBinDir = path.join(tempDir, "bin")
    mkdirSync(fakeBinDir, { recursive: true })

    const curlCapture = path.join(tempDir, "curl-args.txt")
    const backupDir = path.join(tempDir, "local-backups")
    const detailDir = path.join(tempDir, "details")
    const envFile = path.join(tempDir, ".env")
    const logFile = path.join(tempDir, "backup.log")
    const lockFile = path.join(tempDir, "backup.lock")

    writeFileSync(
      envFile,
      [
        'DATABASE_URL="postgresql://postgres:secret@example.supabase.co:5432/postgres?sslmode=require"',
        `BACKUP_DIR="${backupDir}"`,
        `BACKUP_DETAIL_DIR="${detailDir}"`,
        'TG_TOKEN="token"',
        'TG_CHAT="123"',
      ].join("\n")
    )

    writeExecutable(path.join(fakeBinDir, "psql"), "#!/usr/bin/env bash\nexit 0\n")
    writeExecutable(path.join(fakeBinDir, "flock"), "#!/usr/bin/env bash\nexit 0\n")
    writeExecutable(
      path.join(fakeBinDir, "pg_dump"),
      `#!/usr/bin/env bash
printf 'pg dump warning\\n' >&2
exit 42
`
    )
    writeExecutable(
      path.join(fakeBinDir, "curl"),
      `#!/usr/bin/env bash
set -eu
printf '%s\n' "$@" > "${curlCapture}"
exit 0
`
    )

    const result = spawnSync("bash", [scriptPath], {
      env: {
        ...process.env,
        PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
        BACKUP_ENV_FILE: envFile,
        BACKUP_LOG_FILE: logFile,
        BACKUP_LOCK_FILE: lockFile,
      },
      encoding: "utf8",
    })

    expect(result.status).toBe(20)
    expect(existsSync(path.join(detailDir, "latest-pg_dump.stderr.log"))).toBe(true)

    const pgDumpStderr = readFileSync(path.join(detailDir, "latest-pg_dump.stderr.log"), "utf8")
    const curlArgs = readFileSync(curlCapture, "utf8")
    const logOutput = readFileSync(logFile, "utf8")

    expect(pgDumpStderr).toContain("pg dump warning")
    expect(curlArgs).toContain("pg_dump failed")
    expect(curlArgs).toContain("File:")
    expect(curlArgs).toContain("pg_dump=42")
    expect(logOutput).toContain("pg_dump failed")
    expect(logOutput).toContain("pg_dump stderr tail")
  })
})
