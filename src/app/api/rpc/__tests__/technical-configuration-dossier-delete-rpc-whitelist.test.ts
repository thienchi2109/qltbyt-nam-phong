import fs from "node:fs"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { POST } from "@/app/api/rpc/[fn]/route"

const DOSSIER_RPC_FUNCTIONS = [
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
  it("owns the P15C delete RPC in a dedicated manifest", async () => {
    const manifestPath = path.resolve(
      process.cwd(),
      "src/lib/technical-configuration-dossier-rpcs.ts"
    )

    expect(fs.existsSync(manifestPath)).toBe(true)
    if (!fs.existsSync(manifestPath)) return

    const { DOSSIER_DELETE_RPC_FUNCTION_NAMES, DOSSIER_DELETE_RPC_FUNCTIONS } =
      (await vi.importActual("@/lib/technical-configuration-dossier-rpcs")) as {
        DOSSIER_DELETE_RPC_FUNCTION_NAMES: readonly string[]
        DOSSIER_DELETE_RPC_FUNCTIONS: Readonly<Record<string, string>>
      }

    expect(DOSSIER_DELETE_RPC_FUNCTIONS).toEqual({
      deleteDossier: "technical_configuration_dossiers_delete",
    })
    expect(DOSSIER_DELETE_RPC_FUNCTION_NAMES).toEqual(["technical_configuration_dossiers_delete"])
  })

  it("allowlists exactly the five P1 dossier RPCs plus the P15C delete RPC", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter((fn) => fn.startsWith("technical_configuration_dossiers_"))
    ).toEqual(DOSSIER_RPC_FUNCTIONS)
  })

  it.each(DOSSIER_RPC_FUNCTIONS)('allows dossier RPC "%s" through the whitelist', async (fn) => {
    const response = await invokeRpcProxy(fn)

    expect(response.status).toBe(411)
    await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
  })
})
