import fs from "node:fs"
import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationDossierCreateRpcArgs,
  TechnicalConfigurationDossierListWireResponse,
} from "../types"
import * as rpcModule from "../technical-configuration-rpc"

type RpcModuleContract = {
  listTechnicalConfigurationDossiers?: (
    args?: {
      p_page?: number
      p_page_size?: number
      p_include_archived?: boolean
    },
    signal?: AbortSignal
  ) => Promise<TechnicalConfigurationDossierListWireResponse>
  createTechnicalConfigurationDossier?: (
    args: TechnicalConfigurationDossierCreateRpcArgs,
    signal?: AbortSignal
  ) => Promise<unknown>
}

const rpc = rpcModule as RpcModuleContract

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("technical configuration RPC adapter", () => {
  it("has a module-local adapter instead of changing the shared RPC client", () => {
    const adapterPath = path.resolve(
      process.cwd(),
      "src/app/(app)/technical-configurations/technical-configuration-rpc.ts"
    )

    expect(fs.existsSync(adapterPath)).toBe(true)
  })

  it("posts typed dossier list arguments through the RPC proxy", async () => {
    expect(rpc.listTechnicalConfigurationDossiers).toEqual(expect.any(Function))
    if (!rpc.listTechnicalConfigurationDossiers) return

    const response: TechnicalConfigurationDossierListWireResponse = {
      data: [],
      total: 0,
      page: 2,
      page_size: 10,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      rpc.listTechnicalConfigurationDossiers({
        p_page: 2,
        p_page_size: 10,
        p_include_archived: false,
      })
    ).resolves.toEqual(response)

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rpc/technical_configuration_dossiers_list",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          p_page: 2,
          p_page_size: 10,
          p_include_archived: false,
        }),
      })
    )
  })

  it("forces dossier creation to use the frozen expected revision", async () => {
    expect(rpc.createTechnicalConfigurationDossier).toEqual(expect.any(Function))
    if (!rpc.createTechnicalConfigurationDossier) return

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "dossier-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await rpc.createTechnicalConfigurationDossier({
      p_device_type_name: "Máy siêu âm",
      p_name: "Cấu hình máy siêu âm",
      p_description: null,
      p_expected_revision: 0,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rpc/technical_configuration_dossiers_create",
      expect.objectContaining({
        body: JSON.stringify({
          p_device_type_name: "Máy siêu âm",
          p_name: "Cấu hình máy siêu âm",
          p_description: null,
          p_expected_revision: 0,
        }),
      })
    )
  })

  it("preserves HTTP status and PostgREST error metadata", async () => {
    expect(rpc.listTechnicalConfigurationDossiers).toEqual(expect.any(Function))
    if (!rpc.listTechnicalConfigurationDossiers) return

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "42501",
              message: "Access denied",
              details: "global role required",
              hint: "Use an authorized session",
            },
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    await expect(rpc.listTechnicalConfigurationDossiers()).rejects.toMatchObject({
      name: "TechnicalConfigurationRpcError",
      status: 403,
      code: "42501",
      message: "Access denied",
      details: "global role required",
      hint: "Use an authorized session",
    })
  })

  it("rejects a successful response whose JSON payload cannot be parsed", async () => {
    expect(rpc.listTechnicalConfigurationDossiers).toEqual(expect.any(Function))
    if (!rpc.listTechnicalConfigurationDossiers) return

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    await expect(rpc.listTechnicalConfigurationDossiers()).rejects.toMatchObject({
      name: "TechnicalConfigurationRpcError",
      status: 200,
      message: "RPC returned an invalid JSON response",
    })
  })

  it("preserves AbortError while reading a cancelled response body", async () => {
    expect(rpc.listTechnicalConfigurationDossiers).toEqual(expect.any(Function))
    if (!rpc.listTechnicalConfigurationDossiers) return

    const abortError = new DOMException("The operation was aborted", "AbortError")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(abortError),
      })
    )

    await expect(rpc.listTechnicalConfigurationDossiers()).rejects.toBe(abortError)
  })
})
