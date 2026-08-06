import fs from "node:fs"
import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationDossierCreateRpcArgs,
  TechnicalConfigurationDossierDeleteRpcArgs,
  TechnicalConfigurationDossierDeleteWireResponse,
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierListWireResponse,
  TechnicalConfigurationDossierUpdateRpcArgs,
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
  updateTechnicalConfigurationDossier?: (
    args: TechnicalConfigurationDossierUpdateRpcArgs,
    signal?: AbortSignal
  ) => Promise<unknown>
  deleteTechnicalConfigurationDossier?: (
    args: TechnicalConfigurationDossierDeleteRpcArgs,
    signal?: AbortSignal
  ) => Promise<TechnicalConfigurationDossierDeleteWireResponse>
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

    const dossier: TechnicalConfigurationDossierListItemWire = {
      id: "dossier-1",
      device_type_name: "Máy siêu âm",
      name: "Cấu hình máy siêu âm",
      description: null,
      revision: 3,
      archived_at: null,
      archived_by: null,
      created_at: "2026-08-06T00:00:00.000Z",
      created_by: 1,
      updated_at: "2026-08-06T00:00:00.000Z",
      updated_by: 1,
      can_delete: true,
    }
    const response: TechnicalConfigurationDossierListWireResponse = {
      data: [dossier],
      total: 1,
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

  it("posts the selected dossier revision through the dedicated delete RPC", async () => {
    expect(rpc.deleteTechnicalConfigurationDossier).toEqual(expect.any(Function))
    if (!rpc.deleteTechnicalConfigurationDossier) return

    const response: TechnicalConfigurationDossierDeleteWireResponse = {
      data: { id: "dossier-1" },
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const args: TechnicalConfigurationDossierDeleteRpcArgs = {
      p_id: "dossier-1",
      p_expected_revision: 7,
    }

    await expect(rpc.deleteTechnicalConfigurationDossier(args)).resolves.toEqual(response)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rpc/technical_configuration_dossiers_delete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(args),
      })
    )
  })

  it.each([
    ["locked_dossier", 409],
    ["stale_revision", 409],
    ["archived_dossier", 409],
    ["not_found", 404],
  ] as const)("preserves the authoritative %s delete conflict", async (message, status) => {
    expect(rpc.deleteTechnicalConfigurationDossier).toEqual(expect.any(Function))
    if (!rpc.deleteTechnicalConfigurationDossier) return

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: status === 404 ? "PT404" : "PT409",
              message,
            },
          }),
          {
            status,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    )

    await expect(
      rpc.deleteTechnicalConfigurationDossier({
        p_id: "dossier-1",
        p_expected_revision: 7,
      })
    ).rejects.toMatchObject({
      name: "TechnicalConfigurationRpcError",
      status,
      code: status === 404 ? "PT404" : "PT409",
      message,
    })
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

  it("posts the selected dossier and current revision through the update RPC", async () => {
    expect(rpc.updateTechnicalConfigurationDossier).toEqual(expect.any(Function))
    if (!rpc.updateTechnicalConfigurationDossier) return

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "dossier-1", revision: 8 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const args: TechnicalConfigurationDossierUpdateRpcArgs = {
      p_id: "dossier-1",
      p_device_type_name: "Máy siêu âm tim",
      p_name: "Cấu hình máy siêu âm tim",
      p_description: "Metadata đã cập nhật",
      p_expected_revision: 7,
    }

    await rpc.updateTechnicalConfigurationDossier(args)

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rpc/technical_configuration_dossiers_update",
      expect.objectContaining({
        body: JSON.stringify(args),
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
