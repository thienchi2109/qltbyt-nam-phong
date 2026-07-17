import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { POST } from "@/app/api/rpc/[fn]/route"
import { BASELINE_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-baseline-rpcs"

const DOSSIER_RPC_FUNCTIONS = [
  "technical_configuration_dossiers_list",
  "technical_configuration_dossiers_get",
  "technical_configuration_dossiers_create",
  "technical_configuration_dossiers_update",
  "technical_configuration_dossiers_archive",
] as const

const REFERENCE_RPC_FUNCTIONS = [
  "technical_configuration_reference_products_list",
  "technical_configuration_reference_product_create",
  "technical_configuration_reference_product_update",
  "technical_configuration_reference_product_delete",
  "technical_configuration_reference_response_upsert",
] as const

async function invokeRpcProxy(fn: string) {
  const request = new Request(`http://localhost/api/rpc/${fn}`, { method: "POST" })
  return POST(request as never, { params: Promise.resolve({ fn }) })
}

describe("technical configuration dossier RPC whitelist", () => {
  it("allowlists exactly the five P1 dossier RPCs", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter((fn) => fn.startsWith("technical_configuration_dossiers_"))
    ).toEqual(DOSSIER_RPC_FUNCTIONS)
  })

  it.each(DOSSIER_RPC_FUNCTIONS)('allows P1 RPC "%s" through the whitelist', async (fn) => {
    const response = await invokeRpcProxy(fn)

    expect(response.status).toBe(411)
    await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
  })
})

describe("technical configuration baseline RPC whitelist", () => {
  it("allowlists exactly the P2, P4, and P5C baseline RPCs", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter((fn) => fn.startsWith("technical_configuration_baseline_"))
    ).toEqual(BASELINE_RPC_FUNCTION_NAMES)
  })

  it.each(BASELINE_RPC_FUNCTION_NAMES)(
    'allows baseline RPC "%s" through the whitelist',
    async (fn) => {
      const response = await invokeRpcProxy(fn)

      expect(response.status).toBe(411)
      await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
    }
  )
})

describe("technical configuration reference product RPC whitelist", () => {
  it("allowlists exactly the five P7A1 reference product RPCs", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter((fn) => fn.startsWith("technical_configuration_reference_"))
    ).toEqual(REFERENCE_RPC_FUNCTIONS)
  })

  it.each(REFERENCE_RPC_FUNCTIONS)(
    'allows reference product RPC "%s" through the whitelist',
    async (fn) => {
      const response = await invokeRpcProxy(fn)

      expect(response.status).toBe(411)
      await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
    }
  )
})
