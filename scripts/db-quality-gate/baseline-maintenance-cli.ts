import { readFileSync } from "node:fs"

import {
  runBaselineCatchUp,
  runBaselineFullRefresh,
  runBaselineHealthRecovery,
} from "./baseline-maintenance"
import type { ConfirmedLiveMigration } from "./baseline-state"
import { validConfirmation } from "./baseline-state"
import { currentHeadCommit } from "./git-evidence"
import { oracleBaselineMaintenanceExecutorFromEnvironment } from "./oracle-baseline-maintenance-executor"
import { stableJsonStringify } from "./serialization"

type Operation = "catch-up" | "full-refresh" | "health"

type CommandOptions = {
  checkedAt: string
  confirmationsPath: string
  dumpPath?: string
  operation: Operation
  runId: string
  subjectCommit?: string
}

const OPTION_NAMES = new Set([
  "--checked-at",
  "--confirmations",
  "--dump",
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
  const confirmationsPath = values.get("--confirmations")
  if (
    (operation !== "catch-up" && operation !== "full-refresh" && operation !== "health") ||
    runId === undefined ||
    confirmationsPath === undefined ||
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
    confirmationsPath,
    dumpPath,
    operation,
    runId,
    subjectCommit: values.get("--subject-commit"),
  }
}

function readConfirmations(filePath: string): ConfirmedLiveMigration[] | undefined {
  let value: unknown
  try {
    value = JSON.parse(readFileSync(filePath, "utf8")) as unknown
  } catch {
    return undefined
  }
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !isRecord(item))) {
    return undefined
  }
  const confirmations: ConfirmedLiveMigration[] = []
  for (const item of value) {
    const confirmation = {
      liveName: item.liveName,
      liveVersion: item.liveVersion,
      path: item.path,
      sha256: item.sha256,
    }
    if (
      typeof confirmation.liveName !== "string" ||
      typeof confirmation.liveVersion !== "string" ||
      typeof confirmation.path !== "string" ||
      typeof confirmation.sha256 !== "string" ||
      !validConfirmation(confirmation)
    ) {
      return undefined
    }
    confirmations.push(confirmation)
  }
  return confirmations
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Runs one explicitly requested baseline maintenance operation. */
export function runBaselineMaintenanceCommand(
  args: string[],
  repositoryRoot = process.cwd()
): { exitCode: 0 | 2; stdout: string } {
  const options = parseOptions(args)
  const confirmations =
    options === undefined ? undefined : readConfirmations(options.confirmationsPath)
  const executor = oracleBaselineMaintenanceExecutorFromEnvironment()
  const subjectCommit = options?.subjectCommit ?? currentHeadCommit(repositoryRoot) ?? undefined
  if (
    options === undefined ||
    confirmations === undefined ||
    executor === undefined ||
    subjectCommit === undefined
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
    confirmedMigrations: confirmations,
    executor,
    runId: options.runId,
    sourceCommit: subjectCommit,
  }
  const result =
    options.operation === "health"
      ? runBaselineHealthRecovery(common)
      : options.operation === "catch-up"
        ? runBaselineCatchUp({
            ...common,
            repositoryRoot,
          })
        : runBaselineFullRefresh({
            ...common,
            dumpPath: options.dumpPath as string,
            repositoryRoot,
          })

  return {
    exitCode: result.outcome === "PASS" ? 0 : 2,
    stdout: `${stableJsonStringify(result)}\n`,
  }
}
