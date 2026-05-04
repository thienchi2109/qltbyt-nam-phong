import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
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
  it("includes upload context in Telegram and log output when rclone upload fails", () => {
    const tempDir = makeTempDir()
    const fakeBinDir = path.join(tempDir, "bin")
    mkdirSync(fakeBinDir, { recursive: true })

    const curlCapture = path.join(tempDir, "curl-args.txt")
    const envFile = path.join(tempDir, ".env")
    const logFile = path.join(tempDir, "backup.log")
    const lockFile = path.join(tempDir, "backup.lock")

    writeFileSync(
      envFile,
      [
        'DATABASE_URL="postgresql://postgres:secret@example.supabase.co:5432/postgres?sslmode=require"',
        'RCLONE_REMOTE="gdrive:qltbyt-backup"',
        'TG_TOKEN="token"',
        'TG_CHAT="123"',
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
      "#!/usr/bin/env bash\nprintf 'fake dump payload'\n"
    )
    writeExecutable(
      path.join(fakeBinDir, "rclone"),
      `#!/usr/bin/env bash
set -eu
if [[ "$1" == "listremotes" ]]; then
  printf 'gdrive:\\n'
  exit 0
fi
if [[ "$1" == "rcat" ]]; then
  cat >/dev/null
  printf 'googleapi: Error 429: Rate Limit Exceeded\\\\n' >&2
  printf 'retry after 120 seconds\\\\n' >&2
  exit 1
fi
if [[ "$1" == "delete" ]]; then
  exit 0
fi
if [[ "$1" == "size" ]]; then
  printf '{"bytes":2398284}\\n'
  exit 0
fi
printf 'unexpected rclone invocation: %s\\n' "$*" >&2
exit 97
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

    const curlArgs = readFileSync(curlCapture, "utf8")
    const logOutput = readFileSync(logFile, "utf8")

    expect(curlArgs).toContain("upload failed")
    expect(curlArgs).toContain("Remote:")
    expect(curlArgs).toContain("rclone=1")
    expect(curlArgs).toContain("Rate Limit Exceeded")

    expect(logOutput).toContain("dump|upload failed")
    expect(logOutput).toContain("rclone stderr tail")
    expect(logOutput).toContain("Rate Limit Exceeded")
  })

  it("writes detailed stderr files for failed upload attempts", () => {
    const tempDir = makeTempDir()
    const fakeBinDir = path.join(tempDir, "bin")
    mkdirSync(fakeBinDir, { recursive: true })

    const detailDir = path.join(tempDir, "details")
    const envFile = path.join(tempDir, ".env")
    const logFile = path.join(tempDir, "backup.log")
    const lockFile = path.join(tempDir, "backup.lock")

    writeFileSync(
      envFile,
      [
        'DATABASE_URL="postgresql://postgres:secret@example.supabase.co:5432/postgres?sslmode=require"',
        'RCLONE_REMOTE="gdrive:qltbyt-backup"',
        `BACKUP_DETAIL_DIR="${detailDir}"`,
      ].join("\n")
    )

    writeExecutable(path.join(fakeBinDir, "psql"), "#!/usr/bin/env bash\nexit 0\n")
    writeExecutable(path.join(fakeBinDir, "flock"), "#!/usr/bin/env bash\nexit 0\n")
    writeExecutable(path.join(fakeBinDir, "pg_dump"), "#!/usr/bin/env bash\nprintf 'fake dump payload'\nprintf 'pg dump warning\\n' >&2\n")
    writeExecutable(
      path.join(fakeBinDir, "rclone"),
      `#!/usr/bin/env bash
set -eu
if [[ "$1" == "listremotes" ]]; then
  printf 'gdrive:\\n'
  exit 0
fi
if [[ "$1" == "rcat" ]]; then
  cat >/dev/null
  printf 'googleapi: Error 429: Rate Limit Exceeded\\\\n' >&2
  exit 1
fi
if [[ "$1" == "delete" ]]; then
  exit 0
fi
if [[ "$1" == "size" ]]; then
  printf '{"bytes":2398284}\\n'
  exit 0
fi
exit 97
`
    )
    writeExecutable(path.join(fakeBinDir, "curl"), "#!/usr/bin/env bash\nexit 0\n")

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
    expect(existsSync(path.join(detailDir, "latest-rclone-upload.stderr.log"))).toBe(true)
    expect(existsSync(path.join(detailDir, "latest-pg_dump.stderr.log"))).toBe(true)

    const rcloneStderr = readFileSync(path.join(detailDir, "latest-rclone-upload.stderr.log"), "utf8")
    const pgDumpStderr = readFileSync(path.join(detailDir, "latest-pg_dump.stderr.log"), "utf8")

    expect(rcloneStderr).toContain("Rate Limit Exceeded")
    expect(pgDumpStderr).toContain("pg dump warning")
  })
})
