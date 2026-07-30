import fs from "node:fs"
import path from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ASSESSMENT_RPC_FUNCTION_NAMES,
  ASSESSMENT_RPC_FUNCTIONS,
} from "@/lib/technical-configuration-assessment-rpcs"
import { listTechnicalConfigurationEvaluationCriteria } from "../technical-configuration-assessment-rpc"
import {
  technicalConfigurationEvaluationCriteriaQueryKey,
  technicalConfigurationEvaluationCriteriaQueryKeyPrefix,
} from "../technical-configuration-query-keys"
import { TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE } from "../comparison-matrix-constants"

const callRpcMock = vi.hoisted(() => vi.fn())

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => callRpcMock(...args),
}))

describe("P12B2 server-filtered evaluation navigation contract", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
  })

  it("allowlists the dedicated server-side evaluation criteria RPC", () => {
    expect(ASSESSMENT_RPC_FUNCTIONS).toEqual({
      listAssessments: "technical_configuration_assessments_list",
      listEvaluationCriteria: "technical_configuration_evaluation_criteria_list",
      upsertAssessment: "technical_configuration_assessment_upsert",
    })
    expect(ASSESSMENT_RPC_FUNCTION_NAMES).toEqual(Object.values(ASSESSMENT_RPC_FUNCTIONS))
  })

  it("forwards the selected option, baseline, status filter and bounded page unchanged", async () => {
    const signal = new AbortController().signal
    const args = {
      p_option_id: "option-1",
      p_baseline_version_id: "baseline-1",
      p_status_filter: "fails" as const,
      p_page: 2,
      p_page_size: 100,
    }
    const response = {
      data: [
        {
          criterion_id: "criterion-101",
          canonical_index: 101,
          canonical_page: 3,
        },
      ],
      total: 101,
      page: 2,
      page_size: 100,
    }
    callRpcMock.mockResolvedValue(response)

    await expect(listTechnicalConfigurationEvaluationCriteria(args, signal)).resolves.toEqual(
      response
    )
    expect(callRpcMock).toHaveBeenCalledWith(
      ASSESSMENT_RPC_FUNCTIONS.listEvaluationCriteria,
      args,
      { signal }
    )
  })

  it("snapshots option, baseline and filter in the complete collection query key", () => {
    expect(
      technicalConfigurationEvaluationCriteriaQueryKeyPrefix("option-1", "baseline-1")
    ).toEqual(["technical-configurations", "evaluation-criteria", "option-1", "baseline-1"])
    expect(
      technicalConfigurationEvaluationCriteriaQueryKey({
        optionId: "option-1",
        baselineVersionId: "baseline-1",
        statusFilter: "insufficient_evidence",
      })
    ).toEqual([
      "technical-configurations",
      "evaluation-criteria",
      "option-1",
      "baseline-1",
      "insufficient_evidence",
    ])
  })

  it("defines status derivation and filtering inside a guarded server RPC", () => {
    const migrationsRoot = path.resolve(process.cwd(), "supabase/migrations")
    const migrationSource = fs
      .readdirSync(migrationsRoot)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .map((file) => fs.readFileSync(path.join(migrationsRoot, file), "utf8"))
      .join("\n")

    expect(migrationSource).toContain(
      "CREATE OR REPLACE FUNCTION public.technical_configuration_evaluation_criteria_list"
    )
    expect(migrationSource).toContain("p_status_filter TEXT")
    expect(migrationSource).toContain(
      "PERFORM public._technical_configuration_require_global_user()"
    )
    expect(migrationSource).toMatch(/LEFT JOIN public\.technical_configuration_manual_assessments/)
    expect(migrationSource).toMatch(/technical_axis = 'fails'[\s\S]*THEN 'fails'/)
    expect(migrationSource).toMatch(
      /evidence_axis IN \('partial', 'missing'\)[\s\S]*THEN 'insufficient_evidence'/
    )
    expect(migrationSource).toContain(
      "ORDER BY filtered.group_order, filtered.criterion_order, filtered.criterion_id"
    )
    expect(migrationSource).toContain(
      `v_comparison_page_size CONSTANT INTEGER := ${TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE}`
    )
    expect(migrationSource).toContain(
      "((canonical.canonical_index - 1) / v_comparison_page_size) + 1 AS canonical_page"
    )
    expect(migrationSource).not.toContain(
      "((canonical.canonical_index - 1) / p_page_size) + 1 AS canonical_page"
    )
  })

  it("ships a rollback-only SQL phase gate for auth, filters and canonical paging", () => {
    const phaseGateSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "supabase/tests/technical_configuration_evaluation_criteria_filter_phase_gate.sql"
      ),
      "utf8"
    )

    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
    expect(phaseGateSource).toContain("missing claims rejected")
    expect(phaseGateSource).toContain("fails filter returns exact canonical ids")
    expect(phaseGateSource).toContain(
      "raw admin receives canonical page independent from transport page size"
    )
    expect(phaseGateSource).toContain("(v_result->'data'->0->>'canonical_page')::BIGINT = 3")
  })
})
