import path from "node:path"

import type { OracleExecutorResult } from "./dynamic-lane-types"
import { oracleErrorResult, oracleStatePath } from "./oracle-remote-client"
import type { OracleRemoteClient } from "./oracle-remote-client"
import { shellQuote, validRunId } from "./oracle-remote-contract"
import type { OracleRemoteExecutorConfig } from "./oracle-remote-contract"

/** Canonical immutable report artifact name within an Oracle evidence run. */
export const ORACLE_REPORT_ARTIFACT = "report.json"

type OracleArtifactInput = {
  artifactName: string
  runId: string
}

type PersistOracleArtifactInput = OracleArtifactInput & {
  content: string
}

export type OracleEvidenceStore = {
  persistArtifact: (
    input: PersistOracleArtifactInput
  ) => OracleExecutorResult<{ evidenceId: string }>
  readArtifact: (input: OracleArtifactInput) => OracleExecutorResult<string>
  readBaselineState: () => OracleExecutorResult<string>
}

type OracleEvidenceStoreInput = {
  client: Pick<OracleRemoteClient, "remote">
  config: OracleRemoteExecutorConfig
}

function validArtifactName(value: string): boolean {
  return (
    /^[a-z0-9][a-z0-9._-]*\.json$/u.test(value) &&
    !value.includes("..") &&
    path.posix.basename(value) === value
  )
}

function evidencePath(evidenceDirectory: string, input: OracleArtifactInput): string | undefined {
  if (!validRunId(input.runId) || !validArtifactName(input.artifactName)) {
    return undefined
  }

  return `${evidenceDirectory}/${input.runId}/${input.artifactName}`
}

/** Creates an injected immutable Oracle artifact store for reports and later evidence types. */
export function createOracleEvidenceStore(input: OracleEvidenceStoreInput): OracleEvidenceStore {
  const evidenceDirectory = input.config.evidenceDirectory

  return {
    persistArtifact(artifact) {
      const filePath = evidencePath(evidenceDirectory, artifact)
      if (filePath === undefined) {
        return oracleErrorResult("unavailable", "Invalid immutable Oracle evidence path")
      }
      const directory = path.posix.dirname(filePath)
      const temporaryPath = `${directory}/.${artifact.artifactName}.tmp`
      const result = input.client.remote(
        `set -eu
umask 077
evidence_root=${shellQuote(evidenceDirectory)}
directory=${shellQuote(directory)}
artifact_path=${shellQuote(filePath)}
temporary_path=${shellQuote(temporaryPath)}
published=0
cleanup() {
  rm -f "$temporary_path"
  if [ "$published" -eq 0 ]; then
    rmdir "$directory" 2>/dev/null || true
  fi
}
trap cleanup 0 HUP INT TERM
mkdir -p "$evidence_root"
mkdir "$directory"
cat > "$temporary_path"
chmod 400 "$temporary_path"
ln "$temporary_path" "$artifact_path"
published=1
rm -f "$temporary_path"
chmod 500 "$directory"
trap - 0 HUP INT TERM`,
        artifact.content,
        "unavailable"
      )

      return result.status === "ok"
        ? {
            status: "ok",
            value: { evidenceId: `oracle:${artifact.runId}/${artifact.artifactName}` },
          }
        : result
    },

    readArtifact(artifact) {
      const filePath = evidencePath(evidenceDirectory, artifact)
      if (filePath === undefined) {
        return oracleErrorResult("unavailable", "Invalid immutable Oracle evidence path")
      }

      return input.client.remote(`cat ${shellQuote(filePath)}`, undefined, "unavailable")
    },

    readBaselineState() {
      return input.client.remote(
        `cat ${shellQuote(oracleStatePath(input.config))}`,
        undefined,
        "unavailable"
      )
    },
  }
}
