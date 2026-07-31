import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { POST } from "@/app/api/rpc/[fn]/route"
import {
  ASSESSMENT_RPC_FUNCTION_NAMES,
  ASSESSMENT_RPC_FUNCTIONS,
} from "@/lib/technical-configuration-assessment-rpcs"

const ASSESSMENT_RPC_FUNCTIONS_WITH_P12B2 = [
  "technical_configuration_assessments_list",
  "technical_configuration_evaluation_criteria_list",
  "technical_configuration_assessment_upsert",
] as const

async function invokeRpcProxy(fn: string) {
  const request = new Request(`http://localhost/api/rpc/${fn}`, { method: "POST" })
  return POST(request as never, { params: Promise.resolve({ fn }) })
}

describe("technical configuration assessment RPC whitelist", () => {
  it("freezes the applied assessment and P12B2 navigation RPC names", () => {
    expect(ASSESSMENT_RPC_FUNCTIONS).toEqual({
      listAssessments: "technical_configuration_assessments_list",
      listEvaluationCriteria: "technical_configuration_evaluation_criteria_list",
      upsertAssessment: "technical_configuration_assessment_upsert",
    })
    expect(ASSESSMENT_RPC_FUNCTION_NAMES).toEqual(ASSESSMENT_RPC_FUNCTIONS_WITH_P12B2)
  })

  it("allowlists exactly the P11C assessment RPC manifest", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter(
        (fn) =>
          fn.startsWith("technical_configuration_assessment") ||
          fn === "technical_configuration_evaluation_criteria_list"
      )
    ).toEqual(ASSESSMENT_RPC_FUNCTIONS_WITH_P12B2)
  })

  it.each(ASSESSMENT_RPC_FUNCTIONS_WITH_P12B2)(
    'allows assessment RPC "%s" through the whitelist',
    async (fn) => {
      const response = await invokeRpcProxy(fn)

      expect(response.status).toBe(411)
      await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
    }
  )
})
