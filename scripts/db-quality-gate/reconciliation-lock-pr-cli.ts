import { refreshPublicOriginMain } from "./git-evidence"
import { oracleEvidenceStoreFromEnvironment } from "./oracle-evidence-store"
import { verifyProtectedMain } from "./protected-main"
import { prepareReconciliationLock } from "./reconciliation-lock-pr"
import { validRunId } from "./oracle-remote-contract"
import { stableJsonStringify } from "./serialization"
import type { OracleEvidenceStore } from "./oracle-evidence-store"
import type { ProtectedMainVerifier } from "./protected-main"
import type { ReconciliationLockDependencies } from "./reconciliation-lock-pr"

type LockCommandDependencies = {
  evidenceStore?: () => OracleEvidenceStore | undefined
  refreshOriginMain?: (repositoryRoot: string) => string | undefined
  repositoryRoot?: string
  runGit?: ReconciliationLockDependencies["runGit"]
  verifyProtectedMain?: ProtectedMainVerifier
}

type LockCommandOptions = {
  readBackDigest: string
  readBackRunId: string
  runId: string
  subjectCommit: string
}

const OPTION_NAMES = new Set([
  "--read-back-digest",
  "--read-back-run-id",
  "--run-id",
  "--subject-commit",
])

function parseOptions(args: string[]): LockCommandOptions | undefined {
  const values = new Map<string, string>()
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index]
    const value = args[index + 1]
    if (!OPTION_NAMES.has(option) || value === undefined || values.has(option)) {
      return undefined
    }
    values.set(option, value)
  }

  const readBackDigest = values.get("--read-back-digest")
  const readBackRunId = values.get("--read-back-run-id")
  const runId = values.get("--run-id")
  const subjectCommit = values.get("--subject-commit")
  if (
    readBackDigest === undefined ||
    !/^[a-f0-9]{64}$/u.test(readBackDigest) ||
    readBackRunId === undefined ||
    !validRunId(readBackRunId) ||
    runId === undefined ||
    !validRunId(runId) ||
    subjectCommit === undefined ||
    !/^[a-f0-9]{40}$/u.test(subjectCommit)
  ) {
    return undefined
  }

  return { readBackDigest, readBackRunId, runId, subjectCommit }
}

function invalidCommand() {
  return {
    exitCode: 2 as const,
    stdout: `${stableJsonStringify({
      error: "Invalid or unavailable reconciliation lock inputs",
      outcome: "INCOMPLETE",
    })}\n`,
  }
}

/** Runs the local-only lock preparation command without pushing or opening a PR. */
export function runReconciliationLockCommand(
  args: string[],
  dependencies: LockCommandDependencies = {}
): { exitCode: 0 | 2; stdout: string } {
  const options = parseOptions(args)
  if (options === undefined) {
    return invalidCommand()
  }
  const evidenceStore = dependencies.evidenceStore?.() ?? oracleEvidenceStoreFromEnvironment()
  if (evidenceStore === undefined) {
    return invalidCommand()
  }

  const result = prepareReconciliationLock(
    {
      readBackDigest: options.readBackDigest,
      readBackRunId: options.readBackRunId,
      repositoryRoot: dependencies.repositoryRoot ?? process.cwd(),
      subjectCommit: options.subjectCommit,
    },
    {
      evidenceStore,
      refreshOriginMain: dependencies.refreshOriginMain ?? refreshPublicOriginMain,
      ...(dependencies.runGit === undefined ? {} : { runGit: dependencies.runGit }),
      verifyProtectedMain: dependencies.verifyProtectedMain ?? verifyProtectedMain,
    }
  )
  const output = {
    ...result,
    outcome: result.status === "prepared" ? "PASS" : "INCOMPLETE",
    runId: options.runId,
  }

  return {
    exitCode: result.status === "prepared" ? 0 : 2,
    stdout: `${stableJsonStringify(output)}\n`,
  }
}
