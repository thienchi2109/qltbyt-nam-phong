import { readFileSync } from "node:fs"

import {
  runBaselineCatchUp,
  runBaselineFullRefresh,
  runBaselineHealthRecovery,
} from "./baseline-maintenance"
import { parseBaselineManifest } from "./baseline-manifest"
import { currentHeadCommit } from "./git-evidence"
import { oracleBaselineMaintenanceExecutorFromEnvironment } from "./oracle-baseline-maintenance-executor"
import { runBaselineReconciliation } from "./reconciliation-baseline"
import { stableJsonStringify } from "./serialization"
import type { BaselineMaintenanceExecutor } from "./baseline-maintenance"
import type { BaselineManifest } from "./baseline-manifest"

type Operation = "catch-up" | "full-refresh" | "health" | "reconcile"

type CommandOptions = {
  checkedAt: string
  dumpPath?: string
  manifestPath: string
  operation: Operation
  runId: string
  subjectCommit?: string
}

type CommandDependencies = {
  currentHeadCommit?: (repositoryRoot: string) => string | undefined
  executorFromEnvironment?: () => BaselineMaintenanceExecutor | undefined
}

const OPTION_NAMES = new Set([
  "--checked-at",
  "--dump",
  "--manifest",
  "--operation",
  "--run-id",
  "--subject-commit",
])

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
  const operation = values.get("--operation")
  const runId = values.get("--run-id")
  const manifestPath = values.get("--manifest")
  if (
    (operation !== "catch-up" &&
      operation !== "full-refresh" &&
      operation !== "health" &&
      operation !== "reconcile") ||
    runId === undefined ||
    manifestPath === undefined ||
    !/^[a-z0-9][a-z0-9_-]*$/u.test(runId)
  ) {
    return undefined
  }
  const dumpPath = values.get("--dump")
  if (operation === "full-refresh" && dumpPath === undefined) {
    return undefined
  }

  return {
    checkedAt: values.get("--checked-at") ?? new Date().toISOString(),
    dumpPath,
    manifestPath,
    operation,
    runId,
    subjectCommit: values.get("--subject-commit"),
  }
}

function readManifest(filePath: string): BaselineManifest | undefined {
  try {
    return parseBaselineManifest(JSON.parse(readFileSync(filePath, "utf8")) as unknown)
  } catch {
    return undefined
  }
}

/** Runs one explicitly requested baseline maintenance operation. */
export function runBaselineMaintenanceCommand(
  args: string[],
  repositoryRoot = process.cwd(),
  dependencies: CommandDependencies = {}
): { exitCode: 0 | 2; stdout: string } {
  const options = parseOptions(args)
  const manifest = options === undefined ? undefined : readManifest(options.manifestPath)
  const executor = (
    dependencies.executorFromEnvironment ?? oracleBaselineMaintenanceExecutorFromEnvironment
  )()
  const subjectCommit =
    options?.subjectCommit ?? (dependencies.currentHeadCommit ?? currentHeadCommit)(repositoryRoot)
  if (
    options === undefined ||
    manifest === undefined ||
    executor === undefined ||
    subjectCommit === undefined ||
    subjectCommit !== manifest.sourceCommit
  ) {
    return {
      exitCode: 2,
      stdout: `${stableJsonStringify({
        error: "Invalid or unavailable baseline maintenance inputs",
        outcome: "INCOMPLETE",
      })}\n`,
    }
  }

  const common = {
    checkedAt: options.checkedAt,
    executor,
    manifest,
    repositoryRoot,
    runId: options.runId,
  }
  const result =
    options.operation === "health"
      ? runBaselineHealthRecovery(common)
      : options.operation === "catch-up"
        ? runBaselineCatchUp(common)
        : options.operation === "full-refresh"
          ? runBaselineFullRefresh({ ...common, dumpPath: options.dumpPath as string })
          : runBaselineReconciliation(common)

  return {
    exitCode: result.outcome === "PASS" ? 0 : 2,
    stdout: `${stableJsonStringify(result)}\n`,
  }
}
