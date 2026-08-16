import { aggregateOutcome, finalizeReport, serializeReport } from "./contract"
import { stableJsonStringify } from "./serialization"
import { GATE_LANES, GATE_SCHEMA_VERSION } from "./types"
import type { GateLane, GateReport } from "./types"

type CommandExecution = {
  exitCode: 2
  stdout: string
}

type CommandOptions = {
  createdAt: string
  lane: GateLane
  runId: string
  subjectCommit: string
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
    subjectCommit: values.get("--subject-commit") ?? "unknown",
  }
}

/** Runs the local command contract and returns JSON without invoking a lane executor. */
export function runDatabaseQualityGateCommand(args: string[]): CommandExecution {
  if (!args.includes("--lane")) {
    return errorExecution("Missing required --lane argument")
  }

  const options = parseOptions(args)
  if (options === undefined) {
    return errorExecution("Invalid database quality gate command arguments")
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
    subjectCommit: options.subjectCommit,
  }
  const report = finalizeReport(incompleteReport)

  return {
    exitCode: 2,
    stdout: serializeReport(report),
  }
}
