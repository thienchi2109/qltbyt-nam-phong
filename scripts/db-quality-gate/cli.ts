import { aggregateOutcome, finalizeReport, outcomeExitCode, serializeReport } from "./contract"
import { runOracleDynamicLane } from "./dynamic-lane"
import { currentHeadCommit, refreshPublicOriginMain } from "./git-evidence"
import { createOracleEvidenceStore } from "./oracle-evidence-store"
import { createOracleRemoteClient } from "./oracle-remote-client"
import {
  defaultOracleRemoteCommand,
  oracleRemoteExecutorConfigFromEnvironment,
} from "./oracle-remote-contract"
import { oracleRemoteExecutorFromEnvironment } from "./oracle-remote-executor"
import { runPreLiveEvidenceCheck } from "./pre-live"
import { verifyProtectedMain } from "./protected-main"
import { evaluateReconciliation } from "./reconciliation"
import { stableJsonStringify } from "./serialization"
import { runStaticLane } from "./static-lane"
import { GATE_LANES, GATE_SCHEMA_VERSION } from "./types"
import type { OracleDynamicExecutor } from "./dynamic-lane"
import type { OracleEvidenceStore } from "./oracle-evidence-store"
import type { PreLiveEvidenceDependencies } from "./pre-live"
import type { ReconciliationDependencies } from "./reconciliation"
import type { GateLane, GateReport } from "./types"

type CommandExecution = {
  exitCode: 0 | 1 | 2
  stdout: string
}

type CommandOptions = {
  baselineForwardDigest?: string
  baselineForwardRunId?: string
  createdAt: string
  lane: GateLane
  liveObservationPath?: string
  runId: string
  staticRunId?: string
  subjectCommit?: string
}

type CommandDependencies = {
  dynamicExecutor?: () => OracleDynamicExecutor | undefined
  evidenceStore?: () => OracleEvidenceStore | undefined
  preLiveDependencies?: Omit<PreLiveEvidenceDependencies, "evidenceStore">
  reconciliationDependencies?: Omit<ReconciliationDependencies, "evidenceStore">
  repositoryRoot?: string
}

const OPTION_NAMES = new Set([
  "--baseline-forward-digest",
  "--baseline-forward-run-id",
  "--created-at",
  "--lane",
  "--live-observation",
  "--run-id",
  "--static-run-id",
  "--subject-commit",
])

function errorExecution(error: string): CommandExecution {
  return {
    exitCode: 2,
    stdout: `${stableJsonStringify({ error, outcome: "INCOMPLETE", schemaVersion: GATE_SCHEMA_VERSION })}\n`,
  }
}

function parseOptions(args: string[]): CommandOptions | undefined {
  const values = new Map<string, string>()

  for (let index = 0; index < args.length; index += 2) {
    const option = args[index]
    const value = args[index + 1]

    if (!OPTION_NAMES.has(option) || value === undefined || values.has(option)) {
      return undefined
    }

    values.set(option, value)
  }

  const lane = values.get("--lane")
  if (lane === undefined || !GATE_LANES.includes(lane as GateLane)) {
    return undefined
  }

  return {
    baselineForwardDigest: values.get("--baseline-forward-digest"),
    baselineForwardRunId: values.get("--baseline-forward-run-id"),
    createdAt: values.get("--created-at") ?? new Date().toISOString(),
    lane: lane as GateLane,
    liveObservationPath: values.get("--live-observation"),
    runId: values.get("--run-id") ?? "local-contract",
    staticRunId: values.get("--static-run-id"),
    subjectCommit: values.get("--subject-commit"),
  }
}

function oracleEvidenceStoreFromEnvironment(): OracleEvidenceStore | undefined {
  const config = oracleRemoteExecutorConfigFromEnvironment(process.env)
  if (config === undefined) {
    return undefined
  }

  return createOracleEvidenceStore({
    client: createOracleRemoteClient({
      command: defaultOracleRemoteCommand,
      config,
    }),
    config,
  })
}

/** Runs one local gate lane and fails closed whenever its required executor or evidence is unavailable. */
export function runDatabaseQualityGateCommand(
  args: string[],
  dependencies: CommandDependencies = {}
): CommandExecution {
  if (!args.includes("--lane")) {
    return errorExecution("Missing required --lane argument")
  }

  const options = parseOptions(args)
  if (options === undefined) {
    return errorExecution("Invalid database quality gate command arguments")
  }
  if (options.lane !== "static" && !args.includes("--run-id")) {
    return errorExecution("Dynamic Oracle lanes require an explicit --run-id")
  }
  if (
    (options.lane === "pre-live" || options.lane === "reconciliation") &&
    args.includes("--created-at")
  ) {
    return errorExecution("Pre-live and reconciliation require a trusted internal clock")
  }
  const repositoryRoot = dependencies.repositoryRoot ?? process.cwd()
  const subjectCommit = currentHeadCommit(repositoryRoot)
  if (subjectCommit === undefined) {
    return errorExecution("Repository HEAD is unavailable")
  }
  if (options.subjectCommit !== undefined && options.subjectCommit !== subjectCommit) {
    return errorExecution("Subject commit must match repository HEAD")
  }

  if (options.lane === "static") {
    try {
      const report = runStaticLane({
        createdAt: options.createdAt,
        repositoryRoot,
        runId: options.runId,
        subjectCommit,
      })

      return {
        exitCode: outcomeExitCode(report.outcome),
        stdout: serializeReport(report),
      }
    } catch {
      return errorExecution("Static lane execution failed")
    }
  }

  if (options.lane === "baseline-forward") {
    const executor = dependencies.dynamicExecutor?.() ?? oracleRemoteExecutorFromEnvironment()
    if (executor !== undefined) {
      try {
        const report = runOracleDynamicLane({
          createdAt: options.createdAt,
          executor,
          lane: options.lane,
          repositoryRoot,
          runId: options.runId,
          subjectCommit,
        })
        return {
          exitCode: outcomeExitCode(report.outcome),
          stdout: serializeReport(report),
        }
      } catch {
        return errorExecution("Dynamic Oracle lane execution failed")
      }
    }
  }

  if (options.lane === "reconciliation") {
    if (
      options.baselineForwardDigest === undefined ||
      options.baselineForwardRunId === undefined ||
      options.subjectCommit === undefined
    ) {
      return errorExecution("Reconciliation requires exact landed evidence identifiers")
    }

    const evidenceStore = dependencies.evidenceStore?.() ?? oracleEvidenceStoreFromEnvironment()
    if (evidenceStore !== undefined) {
      try {
        const report = evaluateReconciliation(
          {
            baselineForwardDigest: options.baselineForwardDigest,
            baselineForwardRunId: options.baselineForwardRunId,
            repositoryRoot,
            runId: options.runId,
            subjectCommit: options.subjectCommit,
          },
          {
            clock: () => new Date().toISOString(),
            refreshOriginMain: refreshPublicOriginMain,
            verifyProtectedMain,
            ...dependencies.reconciliationDependencies,
            evidenceStore,
          }
        )
        return {
          exitCode: outcomeExitCode(report.outcome),
          stdout: serializeReport(report),
        }
      } catch {
        return errorExecution("Reconciliation lane execution failed")
      }
    }
  }

  if (options.lane === "pre-live") {
    if (
      options.baselineForwardDigest === undefined ||
      options.baselineForwardRunId === undefined ||
      options.liveObservationPath === undefined ||
      options.staticRunId === undefined ||
      options.subjectCommit === undefined
    ) {
      return errorExecution("Pre-live requires exact landed evidence identifiers")
    }

    const evidenceStore = dependencies.evidenceStore?.() ?? oracleEvidenceStoreFromEnvironment()
    if (evidenceStore !== undefined) {
      try {
        const report = runPreLiveEvidenceCheck(
          {
            baselineForwardDigest: options.baselineForwardDigest,
            baselineForwardRunId: options.baselineForwardRunId,
            liveObservationPath: options.liveObservationPath,
            repositoryRoot,
            runId: options.runId,
            staticRunId: options.staticRunId,
            subjectCommit: options.subjectCommit,
          },
          {
            clock: () => new Date().toISOString(),
            ...dependencies.preLiveDependencies,
            evidenceStore,
          }
        )
        return {
          exitCode: outcomeExitCode(report.outcome),
          stdout: serializeReport(report),
        }
      } catch {
        return errorExecution("Pre-live lane execution failed")
      }
    }
  }

  const incompleteReport: GateReport = {
    baselineMigrationHighWater: "unavailable",
    createdAt: options.createdAt,
    digest: "",
    evidenceAvailable: false,
    executorEnvironment: {},
    findings: [],
    inputHashes: {},
    lane: options.lane,
    migrationIdentities: [],
    outcome: aggregateOutcome({
      evidenceAvailable: false,
      findings: [],
      requiredChecksComplete: false,
    }),
    requiredChecksComplete: false,
    runId: options.runId,
    schemaVersion: GATE_SCHEMA_VERSION,
    subjectCommit,
  }
  const report = finalizeReport(incompleteReport)

  return {
    exitCode: 2,
    stdout: serializeReport(report),
  }
}
