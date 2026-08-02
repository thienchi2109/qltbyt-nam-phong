import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { POST } from "@/app/api/rpc/[fn]/route"
import {
  RESULT_EXPORT_RPC_FUNCTION_NAMES,
  RESULT_EXPORT_RPC_FUNCTIONS,
} from "@/lib/technical-configuration-result-export-rpcs"

const P14A4_RPC_FUNCTIONS = [
  "technical_configuration_result_export_manifest_get",
  "technical_configuration_result_export_ranking_list",
  "technical_configuration_result_export_matrix_list",
  "technical_configuration_result_export_option_axis_list",
  "technical_configuration_result_export_criterion_axis_list",
] as const

async function invokeRpcProxy(fn: string) {
  const request = new Request(`http://localhost/api/rpc/${fn}`, { method: "POST" })
  return POST(request as never, { params: Promise.resolve({ fn }) })
}

describe("technical configuration result export RPC whitelist", () => {
  it("freezes exactly the P14A1, P14A2 and P14A4 RPCs", () => {
    expect(RESULT_EXPORT_RPC_FUNCTIONS).toEqual({
      getManifest: "technical_configuration_result_export_manifest_get",
      listRanking: "technical_configuration_result_export_ranking_list",
      listMatrix: "technical_configuration_result_export_matrix_list",
      listOptionAxis: "technical_configuration_result_export_option_axis_list",
      listCriterionAxis: "technical_configuration_result_export_criterion_axis_list",
    })
    expect(RESULT_EXPORT_RPC_FUNCTION_NAMES).toEqual(P14A4_RPC_FUNCTIONS)
  })

  it("imports and spreads only the P14A1/P14A2/P14A4 result-export RPCs", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter((fn) => fn.startsWith("technical_configuration_result_export_"))
    ).toEqual(P14A4_RPC_FUNCTIONS)
  })

  it.each(P14A4_RPC_FUNCTIONS)('allows result export RPC "%s" through the proxy', async (fn) => {
    const response = await invokeRpcProxy(fn)

    expect(response.status).toBe(411)
    await expect(response.json()).resolves.toEqual({
      error: "Content-Length header required",
    })
  })
})
