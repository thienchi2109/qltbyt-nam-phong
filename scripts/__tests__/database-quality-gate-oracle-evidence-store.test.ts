import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import {
  createOracleEvidenceStore,
  ORACLE_REPORT_ARTIFACT,
} from "../db-quality-gate/oracle-evidence-store"
import type { OracleRemoteClient } from "../db-quality-gate/oracle-remote-client"
import { BASELINE_RUN_ID, STATIC_RUN_ID } from "./database-quality-gate-pre-live-test-support"
import {
  cleanupFixtureRepositories,
  createFixtureRepository,
} from "./database-quality-gate-test-support"

const CONFIG = {
  containerName: "supabase-db",
  evidenceDirectory: "/opt/supabase-test/quality-gate/evidence",
  host: "oracle.test",
  minimumFreeDiskKilobytes: 64,
  sshHostKeyFingerprint: "SHA256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  sshKeyPath: "/tmp/oracle-test.key",
  sshKnownHostsPath: "/tmp/oracle-test.known-hosts",
  sshUser: "ubuntu",
}

function localShellClient(): OracleRemoteClient {
  return {
    readJson: () => ({ status: "ok", value: {} }),
    remote: (command, input) => {
      const result = spawnSync("sh", ["-c", command], {
        encoding: "utf8",
        input,
      })
      return result.status === 0
        ? { status: "ok", value: result.stdout }
        : {
            error: result.stderr.trim() || "local shell failed",
            kind: "unavailable",
            status: "error",
          }
    },
    sql: () => ({ status: "ok", value: "" }),
  }
}

afterEach(cleanupFixtureRepositories)

describe("Oracle immutable evidence store", () => {
  it("rejects path-like artifact names before invoking the Oracle client", () => {
    const calls: string[] = []
    const client: OracleRemoteClient = {
      readJson: () => ({ status: "ok", value: {} }),
      remote: (command) => {
        calls.push(command)
        return { status: "ok", value: "" }
      },
      sql: () => ({ status: "ok", value: "" }),
    }
    const store = createOracleEvidenceStore({ client, config: CONFIG })

    const result = store.readArtifact({
      artifactName: "../../fabricated.json",
      runId: BASELINE_RUN_ID,
    })

    expect(result.status).toBe("error")
    expect(calls).toEqual([])
  })

  it("publishes immutable artifacts from a restrictive temporary file without clobbering", () => {
    const calls: Array<{ command: string; input?: string }> = []
    const client: OracleRemoteClient = {
      readJson: () => ({ status: "ok", value: {} }),
      remote: (command, input) => {
        calls.push({ command, input })
        return { status: "ok", value: "" }
      },
      sql: () => ({ status: "ok", value: "" }),
    }
    const store = createOracleEvidenceStore({ client, config: CONFIG })

    const result = store.persistArtifact({
      artifactName: ORACLE_REPORT_ARTIFACT,
      content: "{}\n",
      runId: STATIC_RUN_ID,
    })

    expect(result.status).toBe("ok")
    expect(calls).toHaveLength(1)
    expect(calls[0].command).toContain('cat > "$temporary_path"')
    expect(calls[0].command).toContain('ln "$temporary_path" "$artifact_path"')
    expect(calls[0].command).not.toContain("cat > '/opt/supabase-test/quality-gate/evidence")
  })

  it("rejects path-like run IDs before invoking the Oracle client", () => {
    const calls: string[] = []
    const client: OracleRemoteClient = {
      readJson: () => ({ status: "ok", value: {} }),
      remote: (command) => {
        calls.push(command)
        return { status: "ok", value: "" }
      },
      sql: () => ({ status: "ok", value: "" }),
    }
    const store = createOracleEvidenceStore({ client, config: CONFIG })

    const result = store.persistArtifact({
      artifactName: ORACLE_REPORT_ARTIFACT,
      content: "{}\n",
      runId: "../escape",
    })

    expect(result.status).toBe("error")
    expect(calls).toEqual([])
  })

  it("preserves the first immutable artifact when a duplicate publication is attempted", () => {
    const repository = createFixtureRepository({})
    const evidenceDirectory = repository.path("evidence")
    const store = createOracleEvidenceStore({
      client: localShellClient(),
      config: {
        ...CONFIG,
        evidenceDirectory,
      },
    })
    const artifact = {
      artifactName: ORACLE_REPORT_ARTIFACT,
      runId: STATIC_RUN_ID,
    }

    const first = store.persistArtifact({
      ...artifact,
      content: "first\n",
    })
    const second = store.persistArtifact({
      ...artifact,
      content: "second\n",
    })

    expect(first.status).toBe("ok")
    expect(second.status).toBe("error")
    expect(
      readFileSync(repository.path("evidence", STATIC_RUN_ID, ORACLE_REPORT_ARTIFACT), "utf8")
    ).toBe("first\n")
  })
})
