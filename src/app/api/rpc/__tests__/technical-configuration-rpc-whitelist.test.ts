import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { POST } from "@/app/api/rpc/[fn]/route"
import { BASELINE_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-baseline-rpcs"
import { REFERENCE_PRODUCT_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-reference-rpcs"
import * as supplierOptionRpcManifest from "@/lib/technical-configuration-supplier-option-rpcs"

const {
  OPTION_RESPONSE_RPC_FUNCTION_NAMES,
  OPTION_RPC_FUNCTION_NAMES,
  SUPPLIER_RPC_FUNCTION_NAMES,
} = supplierOptionRpcManifest

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

const P8A1_SUPPLIER_RPC_FUNCTIONS = [
  "technical_configuration_suppliers_list",
  "technical_configuration_supplier_create",
  "technical_configuration_supplier_update",
  "technical_configuration_supplier_delete",
] as const

const P8A2_OPTION_RPC_FUNCTIONS = [
  "technical_configuration_options_list",
  "technical_configuration_option_create",
  "technical_configuration_option_update",
  "technical_configuration_option_delete",
] as const

const P8A3_OPTION_RESPONSE_RPC_FUNCTIONS = [
  "technical_configuration_comparison_set_get_or_create",
  "technical_configuration_option_response_upsert",
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

describe("technical configuration supplier RPC whitelist", () => {
  it("keeps the local P8A1 supplier prefix aligned with the shared manifest", () => {
    expect(P8A1_SUPPLIER_RPC_FUNCTIONS).toEqual(SUPPLIER_RPC_FUNCTION_NAMES)
  })

  it("allowlists exactly the four P8A1 supplier RPCs", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter(
        (fn) =>
          fn === "technical_configuration_suppliers_list" ||
          fn.startsWith("technical_configuration_supplier_")
      )
    ).toEqual(P8A1_SUPPLIER_RPC_FUNCTIONS)
  })

  it.each(P8A1_SUPPLIER_RPC_FUNCTIONS)(
    'allows supplier RPC "%s" through the whitelist',
    async (fn) => {
      const response = await invokeRpcProxy(fn)

      expect(response.status).toBe(411)
      await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
    }
  )
})

describe("technical configuration option RPC whitelist", () => {
  it("keeps the local P8A2 option prefix aligned with the shared manifest", () => {
    expect(OPTION_RPC_FUNCTION_NAMES).toEqual(P8A2_OPTION_RPC_FUNCTIONS)
  })

  it("allowlists exactly the four P8A2 option RPCs", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter(
        (fn) =>
          fn === "technical_configuration_options_list" ||
          (fn.startsWith("technical_configuration_option_") &&
            !fn.startsWith("technical_configuration_option_response_"))
      )
    ).toEqual(P8A2_OPTION_RPC_FUNCTIONS)
  })

  it.each(P8A2_OPTION_RPC_FUNCTIONS)('allows option RPC "%s" through the whitelist', async (fn) => {
    const response = await invokeRpcProxy(fn)

    expect(response.status).toBe(411)
    await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
  })
})

describe("technical configuration option response RPC whitelist", () => {
  it("keeps the local P8A3 response prefix aligned with the shared manifest", () => {
    expect(OPTION_RESPONSE_RPC_FUNCTION_NAMES).toEqual(P8A3_OPTION_RESPONSE_RPC_FUNCTIONS)
  })

  it("allowlists exactly the two P8A3 response RPCs", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter(
        (fn) =>
          fn.startsWith("technical_configuration_comparison_set_") ||
          fn.startsWith("technical_configuration_option_response_")
      )
    ).toEqual(P8A3_OPTION_RESPONSE_RPC_FUNCTIONS)
  })

  it.each(P8A3_OPTION_RESPONSE_RPC_FUNCTIONS)(
    'allows option response RPC "%s" through the whitelist',
    async (fn) => {
      const response = await invokeRpcProxy(fn)

      expect(response.status).toBe(411)
      await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
    }
  )
})
