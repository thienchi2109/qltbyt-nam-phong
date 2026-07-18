import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { POST } from "@/app/api/rpc/[fn]/route"
import { BASELINE_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-baseline-rpcs"
import { REFERENCE_PRODUCT_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-reference-rpcs"

const DOSSIER_RPC_FUNCTIONS = [
  "technical_configuration_dossiers_list",
  "technical_configuration_dossiers_get",
  "technical_configuration_dossiers_create",
  "technical_configuration_dossiers_update",
  "technical_configuration_dossiers_archive",
] as const

const BASELINE_DOCUMENT_RPC_FUNCTIONS = [
  "technical_configuration_baseline_documents_list",
  "technical_configuration_baseline_document_create",
  "technical_configuration_baseline_document_update",
  "technical_configuration_baseline_document_delete",
  "technical_configuration_baseline_citation_upsert",
  "technical_configuration_baseline_citation_delete",
] as const

const REFERENCE_DOCUMENT_RPC_FUNCTIONS = [
  "technical_configuration_reference_document_create",
  "technical_configuration_reference_document_update",
  "technical_configuration_reference_document_delete",
  "technical_configuration_reference_citation_upsert",
  "technical_configuration_reference_citation_delete",
] as const

const P7A1_REFERENCE_RPC_FUNCTIONS = [
  "technical_configuration_reference_products_list",
  "technical_configuration_reference_product_create",
  "technical_configuration_reference_product_update",
  "technical_configuration_reference_product_delete",
  "technical_configuration_reference_response_upsert",
] as const

const BASELINE_RPC_FUNCTIONS = [
  ...BASELINE_RPC_FUNCTION_NAMES,
  ...BASELINE_DOCUMENT_RPC_FUNCTIONS,
] as const

const REFERENCE_RPC_FUNCTIONS = [
  ...P7A1_REFERENCE_RPC_FUNCTIONS,
  ...REFERENCE_DOCUMENT_RPC_FUNCTIONS,
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
  it("keeps the ordered P7B1 document RPC manifest split by owner", async () => {
    const { DOCUMENT_RPC_FUNCTION_NAMES } = (await vi.importActual(
      "@/lib/technical-configuration-document-rpcs"
    )) as { DOCUMENT_RPC_FUNCTION_NAMES: readonly string[] }

    expect(DOCUMENT_RPC_FUNCTION_NAMES).toEqual([
      ...BASELINE_DOCUMENT_RPC_FUNCTIONS,
      ...REFERENCE_DOCUMENT_RPC_FUNCTIONS,
    ])
  })

  it("allowlists exactly the existing baseline RPCs plus six P7B1 baseline names", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter((fn) => fn.startsWith("technical_configuration_baseline_"))
    ).toEqual(BASELINE_RPC_FUNCTIONS)
  })

  it.each(BASELINE_RPC_FUNCTIONS)('allows baseline RPC "%s" through the whitelist', async (fn) => {
    const response = await invokeRpcProxy(fn)

    expect(response.status).toBe(411)
    await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
  })
})

describe("technical configuration reference product RPC whitelist", () => {
  it("keeps the local P7A1 reference-product prefix aligned with the shared manifest", () => {
    expect(P7A1_REFERENCE_RPC_FUNCTIONS).toEqual(REFERENCE_PRODUCT_RPC_FUNCTION_NAMES)
  })

  it("allowlists exactly five P7A1 names plus five P7B1 reference-document names", () => {
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
