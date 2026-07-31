import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { POST } from "@/app/api/rpc/[fn]/route"
import {
  REFERENCE_RANKING_RPC_FUNCTION_NAMES,
  REFERENCE_RANKING_RPC_FUNCTIONS,
} from "@/lib/technical-configuration-ranking-rpcs"

const RANKING_RPC_FUNCTIONS = ["technical_configuration_reference_ranking_list"] as const

async function invokeRpcProxy(fn: string) {
  const request = new Request(`http://localhost/api/rpc/${fn}`, { method: "POST" })
  return POST(request as never, { params: Promise.resolve({ fn }) })
}

describe("technical configuration reference ranking RPC whitelist", () => {
  it("freezes the P12C1 ranking RPC manifest", () => {
    expect(REFERENCE_RANKING_RPC_FUNCTIONS).toEqual({
      listReferenceRanking: "technical_configuration_reference_ranking_list",
    })
    expect(REFERENCE_RANKING_RPC_FUNCTION_NAMES).toEqual(RANKING_RPC_FUNCTIONS)
  })

  it("imports and spreads the ranking manifest into the shared allowlist", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter((fn) =>
        fn.startsWith("technical_configuration_reference_ranking")
      )
    ).toEqual(RANKING_RPC_FUNCTIONS)
  })

  it.each(RANKING_RPC_FUNCTIONS)('allows ranking RPC "%s" through the proxy', async (fn) => {
    const response = await invokeRpcProxy(fn)

    expect(response.status).toBe(411)
    await expect(response.json()).resolves.toEqual({
      error: "Content-Length header required",
    })
  })
})
