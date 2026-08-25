import { aggregateOutcome } from "./contract"
import { runDatabaseQualityGateCommand } from "./cli"
import { currentHeadCommit, firstParentCommit } from "./git-evidence"
import { approvalCandidateForLandedCommit } from "./landed-static-lane"
import { collectStaticChangedFiles, DEFAULT_STATIC_BASE_REF } from "./static-changed-files"
import type { GateFinding, GateOutcome } from "./types"

export type LocalMigrationGateExecution = {
  exitCode: 0 | 1 | 2
  stdout: string
}

export type LocalMigrationGateDependencies = {
  collectStaticChangedFiles: (baseRef?: string) => string[]
  resolveApprovedLandedStatic: (repositoryRoot: string) => ApprovedLandedStatic | undefined
  runStaticGate: (landedStatic?: ApprovedLandedStatic) => LocalMigrationGateExecution
}

export type LocalMigrationGateOptions = {
  baseRef?: string
  repositoryRoot?: string
}

type ApprovedLandedStatic = {
  landedParentCommit: string
  subjectCommit: string
}

type StaticGateSummary = {
  blocking: number
  dangerous: number
  digest: string
  expectedOutcome: GateOutcome
  findings: number
  outcome: GateOutcome
  warnings: number
}

const outcomeExitCodes: Record<GateOutcome, 0 | 1 | 2> = {
  FAILED: 1,
  INCOMPLETE: 2,
  PASS: 0,
}

const defaultDependencies: LocalMigrationGateDependencies = {
  collectStaticChangedFiles,
  resolveApprovedLandedStatic: (repositoryRoot) => {
    const subjectCommit = currentHeadCommit(repositoryRoot)
    const landedParentCommit =
      subjectCommit === undefined ? undefined : firstParentCommit(repositoryRoot, subjectCommit)

    if (
      subjectCommit === undefined ||
      landedParentCommit === undefined ||
      approvalCandidateForLandedCommit({
        landedParentCommit,
        repositoryRoot,
        subjectCommit,
      }) !== landedParentCommit
    ) {
      return undefined
    }

    return {
      landedParentCommit,
      subjectCommit,
    }
  },
  runStaticGate: (landedStatic) =>
    runDatabaseQualityGateCommand(
      landedStatic === undefined
        ? ["--lane", "static"]
        : [
            "--lane",
            "static",
            "--subject-commit",
            landedStatic.subjectCommit,
            "--landed-parent-commit",
            landedStatic.landedParentCommit,
          ]
    ),
}

function incompleteExecution(message: string): LocalMigrationGateExecution {
  return {
    exitCode: 2,
    stdout: `[db-quality-gate] INCOMPLETE ${message}\n`,
  }
}

function isGateOutcome(value: unknown): value is GateOutcome {
  return value === "FAILED" || value === "INCOMPLETE" || value === "PASS"
}

function parseStaticGateSummary(stdout: string): StaticGateSummary {
  const report: unknown = JSON.parse(stdout)
  if (typeof report !== "object" || report === null || Array.isArray(report)) {
    throw new Error("report must be a JSON object")
  }

  const values = report as Record<string, unknown>
  if (values.lane !== "static") {
    throw new Error("report lane must be static")
  }
  if (!isGateOutcome(values.outcome)) {
    throw new Error("report outcome is unsupported")
  }
  if (typeof values.digest !== "string" || values.digest.length === 0) {
    throw new Error("report digest is missing")
  }
  if (!Array.isArray(values.findings)) {
    throw new Error("report findings must be an array")
  }
  if (typeof values.requiredChecksComplete !== "boolean") {
    throw new Error("report completion state is missing")
  }
  if (typeof values.evidenceAvailable !== "boolean") {
    throw new Error("report evidence state is missing")
  }

  const classifications = values.findings.map((finding: unknown) => {
    if (typeof finding !== "object" || finding === null || Array.isArray(finding)) {
      throw new Error("report finding must be an object")
    }

    const classification = (finding as Record<string, unknown>).classification
    if (
      classification !== "BLOCKING" &&
      classification !== "DANGEROUS" &&
      classification !== "WARNING"
    ) {
      throw new Error("report finding classification is unsupported")
    }
    return classification
  })

  return {
    blocking: classifications.filter((value) => value === "BLOCKING").length,
    dangerous: classifications.filter((value) => value === "DANGEROUS").length,
    digest: values.digest,
    expectedOutcome: aggregateOutcome({
      evidenceAvailable: values.evidenceAvailable,
      findings: values.findings as GateFinding[],
      requiredChecksComplete: values.requiredChecksComplete,
    }),
    findings: classifications.length,
    outcome: values.outcome,
    warnings: classifications.filter((value) => value === "WARNING").length,
  }
}

function summarizeStaticGateExecution(
  execution: LocalMigrationGateExecution,
  changedFileCount: number
): LocalMigrationGateExecution {
  let summary: StaticGateSummary
  try {
    summary = parseStaticGateSummary(execution.stdout)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return incompleteExecution(`invalid static gate report: ${message}`)
  }

  if (outcomeExitCodes[summary.outcome] !== execution.exitCode) {
    return incompleteExecution("static gate outcome and exit code disagree")
  }
  if (summary.expectedOutcome !== summary.outcome) {
    return incompleteExecution("static gate report outcome contradicts aggregate inputs")
  }

  return {
    exitCode: execution.exitCode,
    stdout:
      `[db-quality-gate] ${summary.outcome} static changed=${changedFileCount} ` +
      `findings=${summary.findings} warnings=${summary.warnings} ` +
      `dangerous=${summary.dangerous} blocking=${summary.blocking} ` +
      `digest=${summary.digest}\n`,
  }
}

/** Runs the static lane only when migrations or committed gate registries changed. */
export function runLocalMigrationGate(
  options: LocalMigrationGateOptions = {},
  dependencies: LocalMigrationGateDependencies = defaultDependencies
): LocalMigrationGateExecution {
  const baseRef = options.baseRef ?? DEFAULT_STATIC_BASE_REF
  const repositoryRoot = options.repositoryRoot ?? process.cwd()
  let changedFiles: string[]

  try {
    changedFiles = dependencies.collectStaticChangedFiles(baseRef)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return incompleteExecution(`unable to detect relevant changes: ${message}`)
  }

  if (changedFiles.length === 0) {
    return {
      exitCode: 0,
      stdout: "[db-quality-gate] SKIP no migration or gate registry changes\n",
    }
  }

  try {
    const landedStatic = dependencies.resolveApprovedLandedStatic(repositoryRoot)
    return summarizeStaticGateExecution(
      dependencies.runStaticGate(landedStatic),
      changedFiles.length
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return incompleteExecution(`unable to run static gate: ${message}`)
  }
}
