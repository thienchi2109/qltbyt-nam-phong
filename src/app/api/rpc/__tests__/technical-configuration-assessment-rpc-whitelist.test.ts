import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { POST } from "@/app/api/rpc/[fn]/route"
import {
  ASSESSMENT_RPC_FUNCTION_NAMES,
  ASSESSMENT_RPC_FUNCTIONS,
} from "@/lib/technical-configuration-assessment-rpcs"

const P11B_ASSESSMENT_RPC_FUNCTIONS = [
  "technical_configuration_assessments_list",
  "technical_configuration_assessment_upsert",
] as const

async function invokeRpcProxy(fn: string) {
  const request = new Request(`http://localhost/api/rpc/${fn}`, { method: "POST" })
  return POST(request as never, { params: Promise.resolve({ fn }) })
}

describe("technical configuration assessment RPC whitelist", () => {
  it("freezes exactly the two applied P11B assessment RPC names", () => {
    expect(ASSESSMENT_RPC_FUNCTIONS).toEqual({
      listAssessments: "technical_configuration_assessments_list",
      upsertAssessment: "technical_configuration_assessment_upsert",
    })
    expect(ASSESSMENT_RPC_FUNCTION_NAMES).toEqual(P11B_ASSESSMENT_RPC_FUNCTIONS)
  })

  it("allowlists exactly the P11C assessment RPC manifest", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter(
        (fn) =>
          fn === "technical_configuration_assessments_list" ||
          fn === "technical_configuration_assessment_upsert"
      )
    ).toEqual(P11B_ASSESSMENT_RPC_FUNCTIONS)
  })

  it.each(P11B_ASSESSMENT_RPC_FUNCTIONS)(
    'allows assessment RPC "%s" through the whitelist',
    async (fn) => {
      const response = await invokeRpcProxy(fn)

      expect(response.status).toBe(411)
      await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
    }
  )
})
