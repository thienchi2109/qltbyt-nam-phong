import { aggregateOutcome, finalizeReport, outcomeExitCode, serializeReport } from "./contract"
import { runOracleDynamicLane } from "./dynamic-lane"
import { currentHeadCommit } from "./git-evidence"
import { oracleRemoteExecutorFromEnvironment } from "./oracle-remote-executor"
import { stableJsonStringify } from "./serialization"
import { runStaticLane } from "./static-lane"
import { GATE_LANES, GATE_SCHEMA_VERSION } from "./types"
import type { GateLane, GateReport } from "./types"
import type { OracleDynamicExecutor } from "./dynamic-lane"

type CommandExecution = {
  exitCode: 0 | 1 | 2
  stdout: string
}

type CommandOptions = {
  createdAt: string
  lane: GateLane
  runId: string
  subjectCommit?: string
}

type CommandDependencies = {
  dynamicExecutor?: () => OracleDynamicExecutor | undefined
  repositoryRoot?: string
}

const OPTION_NAMES = new Set(["--created-at", "--lane", "--run-id", "--subject-commit"])

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
    createdAt: values.get("--created-at") ?? new Date().toISOString(),
    lane: lane as GateLane,
    runId: values.get("--run-id") ?? "local-contract",
    subjectCommit: values.get("--subject-commit"),
  }
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

  if (options.lane === "baseline-forward" || options.lane === "fresh-replay") {
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
