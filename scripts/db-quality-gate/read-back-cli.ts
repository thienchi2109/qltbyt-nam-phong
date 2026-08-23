import type { OracleEvidenceStore } from "./oracle-evidence-store"
import { oracleEvidenceStoreFromEnvironment } from "./oracle-evidence-store"
import { ingestReadBackObservation, readReadBackObservationFile } from "./read-back"
import { stableJsonStringify } from "./serialization"

type ReadBackCommandDependencies = {
  evidenceStore?: () => OracleEvidenceStore | undefined
  now?: () => Date
  repositoryRoot?: string
}

type ReadBackCommandOptions = {
  observationPath: string
  runId: string
  subjectCommit: string
}

const OPTION_NAMES = new Set(["--observation", "--run-id", "--subject-commit"])

function parseOptions(args: string[]): ReadBackCommandOptions | undefined {
  const values = new Map<string, string>()
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index]
    const value = args[index + 1]
    if (!OPTION_NAMES.has(option) || value === undefined || values.has(option)) {
      return undefined
    }
    values.set(option, value)
  }

  const observationPath = values.get("--observation")
  const runId = values.get("--run-id")
  const subjectCommit = values.get("--subject-commit")
  if (
    observationPath === undefined ||
    observationPath.length === 0 ||
    runId === undefined ||
    subjectCommit === undefined ||
    !/^[a-f0-9]{40}$/u.test(subjectCommit)
  ) {
    return undefined
  }

  return { observationPath, runId, subjectCommit }
}

function invalidCommand() {
  return {
    exitCode: 2 as const,
    stdout: `${stableJsonStringify({
      error: "Invalid or unavailable read-back inputs",
      outcome: "INCOMPLETE",
    })}\n`,
  }
}

/** Runs the dedicated key/value read-back ingestion command. */
export function runReadBackCommand(
  args: string[],
  dependencies: ReadBackCommandDependencies = {}
): { exitCode: 0 | 2; stdout: string } {
  const options = parseOptions(args)
  if (options === undefined) {
    return invalidCommand()
  }

  const evidenceStore = dependencies.evidenceStore?.() ?? oracleEvidenceStoreFromEnvironment()
  if (evidenceStore === undefined) {
    return invalidCommand()
  }

  const result = ingestReadBackObservation(
    {
      observation: readReadBackObservationFile(options.observationPath),
      repositoryRoot: dependencies.repositoryRoot ?? process.cwd(),
      runId: options.runId,
      subjectCommit: options.subjectCommit,
    },
    {
      evidenceStore,
      now: dependencies.now ?? (() => new Date()),
    }
  )

  return {
    exitCode: result.outcome === "PASS" ? 0 : 2,
    stdout: `${stableJsonStringify(result)}\n`,
  }
}
