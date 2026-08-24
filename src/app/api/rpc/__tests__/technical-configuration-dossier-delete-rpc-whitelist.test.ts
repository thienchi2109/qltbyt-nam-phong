import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { POST } from "@/app/api/rpc/[fn]/route"
import {
  DOSSIER_RPC_FUNCTION_NAMES,
  DOSSIER_RPC_FUNCTIONS,
} from "@/lib/technical-configuration-dossier-rpcs"

const EXPECTED_DOSSIER_RPC_FUNCTION_NAMES = [
  "technical_configuration_dossiers_list",
  "technical_configuration_dossiers_get",
  "technical_configuration_dossiers_create",
  "technical_configuration_dossiers_update",
  "technical_configuration_dossiers_archive",
  "technical_configuration_dossiers_delete",
] as const

async function invokeRpcProxy(fn: string) {
  const request = new Request(`http://localhost/api/rpc/${fn}`, { method: "POST" })
  return POST(request as never, { params: Promise.resolve({ fn }) })
}

describe("technical configuration dossier RPC whitelist", () => {
  it("owns all dossier RPC names in one canonical manifest", () => {
    expect(DOSSIER_RPC_FUNCTIONS).toEqual({
      listDossiers: "technical_configuration_dossiers_list",
      getDossier: "technical_configuration_dossiers_get",
      createDossier: "technical_configuration_dossiers_create",
      updateDossier: "technical_configuration_dossiers_update",
      archiveDossier: "technical_configuration_dossiers_archive",
      deleteDossier: "technical_configuration_dossiers_delete",
    })
    expect(DOSSIER_RPC_FUNCTION_NAMES).toEqual(EXPECTED_DOSSIER_RPC_FUNCTION_NAMES)
  })

  it("allowlists exactly the canonical dossier RPC manifest", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter((fn) => fn.startsWith("technical_configuration_dossiers_"))
    ).toEqual(EXPECTED_DOSSIER_RPC_FUNCTION_NAMES)
  })

  it.each(EXPECTED_DOSSIER_RPC_FUNCTION_NAMES)(
    'allows dossier RPC "%s" through the whitelist',
    async (fn) => {
      const response = await invokeRpcProxy(fn)

      expect(response.status).toBe(411)
      await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
    }
  )
})
