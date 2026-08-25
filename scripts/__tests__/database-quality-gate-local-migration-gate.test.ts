import { describe, expect, it, vi } from "vitest"

import {
  type LocalMigrationGateDependencies,
  runLocalMigrationGate,
} from "../db-quality-gate/local-migration-gate"

type GateExecution = {
  exitCode: 0 | 1 | 2
  stdout: string
}

type GateOutcome = "FAILED" | "INCOMPLETE" | "PASS"

function gateExecution(
  outcome: GateOutcome,
  exitCode: 0 | 1 | 2,
  classifications: Array<"BLOCKING" | "DANGEROUS" | "WARNING"> = [],
  options: {
    evidenceAvailable?: boolean
    requiredChecksComplete?: boolean
  } = {}
): GateExecution {
  return {
    exitCode,
    stdout: `${JSON.stringify({
      digest: `digest-${outcome.toLowerCase()}`,
      findings: classifications.map((classification, index) => ({
        classification,
        evidence: {
          detail: `historical finding detail ${index}`,
        },
        fingerprint: `fingerprint-${index}`,
        ruleId: `rule-${index}`,
      })),
      evidenceAvailable: options.evidenceAvailable ?? outcome !== "INCOMPLETE",
      lane: "static",
      outcome,
      requiredChecksComplete: options.requiredChecksComplete ?? outcome !== "INCOMPLETE",
    })}\n`,
  }
}

function dependencies(
  changedFiles: string[],
  execution: GateExecution = gateExecution("PASS", 0)
): LocalMigrationGateDependencies & {
  collectStaticChangedFiles: ReturnType<typeof vi.fn>
  resolveApprovedLandedStatic: ReturnType<typeof vi.fn>
  runStaticGate: ReturnType<typeof vi.fn>
} {
  return {
    collectStaticChangedFiles: vi.fn(() => changedFiles),
    resolveApprovedLandedStatic: vi.fn(() => undefined),
    runStaticGate: vi.fn(() => execution),
  }
}

describe("database quality gate local migration trigger", () => {
  it("skips unrelated diffs without running the static lane", () => {
    const deps = dependencies([])

    const result = runLocalMigrationGate({}, deps)

    expect(result).toEqual({
      exitCode: 0,
      stdout: "[db-quality-gate] SKIP no migration or gate registry changes\n",
    })
    expect(deps.runStaticGate).not.toHaveBeenCalled()
  })

  it.each([
    "supabase/migrations/20260823000000_add_local_gate.sql",
    "supabase/applied-migrations.lock.json",
    "supabase/db-quality-gate-baseline.json",
    "supabase/db-quality-gate-waivers.json",
    "supabase/db-quality-gate-invariants.json",
    "supabase/db-quality-gate-tests.json",
  ])("runs the static lane for %s", (filePath) => {
    const deps = dependencies([filePath])

    const result = runLocalMigrationGate({}, deps)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("[db-quality-gate] PASS")
    expect(deps.collectStaticChangedFiles).toHaveBeenCalledWith("origin/main")
    expect(deps.runStaticGate).toHaveBeenCalledOnce()
  })

  it("uses landed static mode for a clean approval-bearing child commit", () => {
    const deps = dependencies([
      "supabase/db-quality-gate-static-evidence/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json",
      "supabase/db-quality-gate-waivers.json",
    ])
    deps.resolveApprovedLandedStatic.mockReturnValue({
      landedParentCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      subjectCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    })

    const result = runLocalMigrationGate({}, deps)

    expect(result.exitCode).toBe(0)
    expect(deps.resolveApprovedLandedStatic).toHaveBeenCalledWith(process.cwd())
    expect(deps.runStaticGate).toHaveBeenCalledWith({
      landedParentCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      subjectCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    })
  })

  it("fails closed when changed-file discovery is unavailable", () => {
    const deps = dependencies([])
    deps.collectStaticChangedFiles.mockImplementation(() => {
      throw new Error("git origin/main failed")
    })

    const result = runLocalMigrationGate({}, deps)

    expect(result.exitCode).toBe(2)
    expect(result.stdout).toContain("[db-quality-gate] INCOMPLETE")
    expect(result.stdout).toContain("git origin/main failed")
    expect(deps.runStaticGate).not.toHaveBeenCalled()
  })

  it("fails closed when the static lane cannot execute", () => {
    const deps = dependencies(["supabase/db-quality-gate-waivers.json"])
    deps.runStaticGate.mockImplementation(() => {
      throw new Error("static runner unavailable")
    })

    const result = runLocalMigrationGate({}, deps)

    expect(result.exitCode).toBe(2)
    expect(result.stdout).toContain("[db-quality-gate] INCOMPLETE")
    expect(result.stdout).toContain("static runner unavailable")
  })
})

describe("database quality gate local result summary", () => {
  it.each([
    ["PASS", 0, ["WARNING"]],
    ["FAILED", 1, ["DANGEROUS", "BLOCKING"]],
    ["INCOMPLETE", 2, ["WARNING"]],
  ] as const)("propagates %s as exit code %s", (outcome, exitCode, classifications) => {
    const deps = dependencies(
      ["supabase/migrations/20260823000000_add_local_gate.sql"],
      gateExecution(outcome, exitCode, [...classifications])
    )

    const result = runLocalMigrationGate({}, deps)

    expect(result.exitCode).toBe(exitCode)
    expect(result.stdout).toContain(`[db-quality-gate] ${outcome}`)
    expect(result.stdout).toContain(`digest=digest-${outcome.toLowerCase()}`)
    expect(result.stdout).toContain(`findings=${classifications.length}`)
  })

  it("fails closed when the report outcome disagrees with the command exit code", () => {
    const deps = dependencies(
      ["supabase/migrations/20260823000000_add_local_gate.sql"],
      gateExecution("PASS", 1)
    )

    const result = runLocalMigrationGate({}, deps)

    expect(result.exitCode).toBe(2)
    expect(result.stdout).toContain("[db-quality-gate] INCOMPLETE")
    expect(result.stdout).toContain("outcome and exit code disagree")
  })

  it("fails closed when the static report is malformed", () => {
    const deps = dependencies(["supabase/db-quality-gate-waivers.json"], {
      exitCode: 0,
      stdout: "not-json\n",
    })

    const result = runLocalMigrationGate({}, deps)

    expect(result.exitCode).toBe(2)
    expect(result.stdout).toContain("[db-quality-gate] INCOMPLETE")
    expect(result.stdout).toContain("invalid static gate report")
  })

  it.each([
    [
      "required checks are incomplete",
      gateExecution("PASS", 0, ["WARNING"], {
        requiredChecksComplete: false,
      }),
    ],
    [
      "evidence is unavailable",
      gateExecution("PASS", 0, ["WARNING"], {
        evidenceAvailable: false,
      }),
    ],
    ["a blocking finding exists", gateExecution("PASS", 0, ["BLOCKING"])],
  ])("fails closed when PASS contradicts aggregate inputs: %s", (_case, execution) => {
    const deps = dependencies(["supabase/db-quality-gate-baseline.json"], execution)

    const result = runLocalMigrationGate({}, deps)

    expect(result.exitCode).toBe(2)
    expect(result.stdout).toContain("[db-quality-gate] INCOMPLETE")
    expect(result.stdout).toContain("report outcome contradicts aggregate inputs")
  })

  it("summarizes findings without printing individual evidence", () => {
    const deps = dependencies(
      ["supabase/db-quality-gate-baseline.json"],
      gateExecution("PASS", 0, ["WARNING", "WARNING"])
    )

    const result = runLocalMigrationGate({}, deps)

    expect(result.stdout).toContain("findings=2")
    expect(result.stdout).toContain("warnings=2")
    expect(result.stdout).not.toContain("historical finding detail")
    expect(result.stdout.length).toBeLessThan(400)
  })
})
