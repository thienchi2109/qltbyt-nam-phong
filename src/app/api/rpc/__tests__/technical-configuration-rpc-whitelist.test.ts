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
] as const

const BASELINE_RPC_FUNCTIONS = [
  "technical_configuration_baseline_draft_create",
  "technical_configuration_baseline_draft_get",
  "technical_configuration_baseline_group_create",
  "technical_configuration_baseline_group_update",
  "technical_configuration_baseline_group_delete",
  "technical_configuration_baseline_groups_reorder",
  "technical_configuration_baseline_criterion_create",
  "technical_configuration_baseline_criterion_update",
  "technical_configuration_baseline_criterion_delete",
  "technical_configuration_baseline_criteria_reorder",
  "technical_configuration_baseline_bulk_preview",
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
  it("allowlists exactly the eleven P2 baseline RPCs", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter((fn) => fn.startsWith("technical_configuration_baseline_"))
    ).toEqual(BASELINE_RPC_FUNCTIONS)
  })

  it.each(BASELINE_RPC_FUNCTIONS)('allows P2 RPC "%s" through the whitelist', async (fn) => {
    const response = await invokeRpcProxy(fn)

    expect(response.status).toBe(411)
    await expect(response.json()).resolves.toEqual({ error: "Content-Length header required" })
  })
})
