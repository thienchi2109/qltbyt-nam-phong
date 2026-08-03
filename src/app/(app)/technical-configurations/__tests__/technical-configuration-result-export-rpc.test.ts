import { afterEach, describe, expect, it } from "vitest"

import {
  getTechnicalConfigurationResultExportManifest,
  listTechnicalConfigurationResultExportRanking,
  TechnicalConfigurationResultExportError,
} from "../technical-configuration-result-export-rpc"
import {
  BASELINE_ID,
  CRITERION_IDS,
  DOSSIER_ID,
  installRpcMock,
  jsonResponse,
  manifestResponse,
  OPTION_IDS,
} from "./technical-configuration-result-export-fixtures"

afterEach(() => vi.unstubAllGlobals())

function pendingRpcResponse(signal: AbortSignal | null): Promise<Response> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  return new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason), { once: true })
  })
}

function startPendingRankingRpc(signal: AbortSignal) {
  let activeSignal: AbortSignal | null = null
  installRpcMock(({ signal: requestSignal }) => {
    activeSignal = requestSignal
    return pendingRpcResponse(requestSignal)
  })
  return {
    result: listTechnicalConfigurationResultExportRanking(
      {
        p_dossier_id: DOSSIER_ID,
        p_baseline_version_id: BASELINE_ID,
        p_option_ids: OPTION_IDS,
        p_criterion_ids: CRITERION_IDS,
        p_page: 1,
        p_page_size: 100,
      },
      signal
    ),
    waitUntilActive: () => vi.waitFor(() => expect(activeSignal).toBe(signal)),
  }
}

describe("P14A3 result export RPC adapters", () => {
  it.each([
    { label: "PT404", status: 404, code: "PT404", kind: "not_found" },
    { label: "PT409", status: 409, code: "PT409", kind: "conflict" },
    { label: "PT422", status: 422, code: "PT422", kind: "validation" },
    { label: "PT500", status: 500, code: "PT500", kind: "server" },
    { label: "sanitized 500", status: 500, code: undefined, kind: "server" },
  ] as const)("classifies $label failures as $kind", async ({ status, code, kind }) => {
    installRpcMock(() =>
      jsonResponse(
        code === undefined
          ? { error: "RPC upstream error" }
          : { error: { code, message: "rpc_error", details: "details", hint: "hint" } },
        status
      )
    )

    await expect(
      getTechnicalConfigurationResultExportManifest({
        p_dossier_id: DOSSIER_ID,
        p_baseline_version_id: BASELINE_ID,
        p_option_ids: null,
        p_criterion_ids: null,
      })
    ).rejects.toMatchObject({
      name: "TechnicalConfigurationResultExportError",
      kind,
      status,
      code,
    })
  })

  it("preserves a custom cancellation reason at the RPC adapter boundary", async () => {
    const controller = new AbortController()
    const reason = new Error("custom RPC cancellation")
    const { result, waitUntilActive } = startPendingRankingRpc(controller.signal)
    await waitUntilActive()
    controller.abort(reason)

    await expect(result).rejects.toBe(reason)
  })

  it("preserves AbortSignal.timeout() at the RPC adapter boundary", async () => {
    const signal = AbortSignal.timeout(100)
    const { result, waitUntilActive } = startPendingRankingRpc(signal)
    const rejection = result.then(
      () => null,
      (error: unknown) => error
    )
    await waitUntilActive()
    await vi.waitFor(() => expect(signal.aborted).toBe(true))

    await expect(rejection).resolves.toBe(signal.reason)
  })

  it("classifies malformed successful JSON as an invalid response", async () => {
    installRpcMock(() => new Response("not-json", { status: 200 }))

    await expect(
      getTechnicalConfigurationResultExportManifest({
        p_dossier_id: DOSSIER_ID,
        p_baseline_version_id: BASELINE_ID,
        p_option_ids: null,
        p_criterion_ids: null,
      })
    ).rejects.toMatchObject({ kind: "invalid_response", status: 200 })
  })

  it.each([
    {
      name: "malformed identity",
      response: {
        ...manifestResponse,
        data: {
          ...manifestResponse.data,
          dossier: { ...manifestResponse.data.dossier, id: "not-a-uuid" },
        },
      },
    },
    {
      name: "selected option total mismatch",
      response: {
        ...manifestResponse,
        data: { ...manifestResponse.data, option_total: 1 },
      },
    },
    {
      name: "selected criterion total mismatch",
      response: {
        ...manifestResponse,
        data: { ...manifestResponse.data, criterion_total: 1 },
      },
    },
    {
      name: "empty token",
      response: {
        ...manifestResponse,
        data: { ...manifestResponse.data, snapshot_token: "" },
      },
    },
    {
      name: "unexpected field",
      response: {
        ...manifestResponse,
        data: { ...manifestResponse.data, option_ids: OPTION_IDS },
      },
    },
  ])("rejects $name instead of accepting a malformed manifest", async ({ response }) => {
    installRpcMock(() => jsonResponse(response))

    await expect(
      getTechnicalConfigurationResultExportManifest({
        p_dossier_id: DOSSIER_ID,
        p_baseline_version_id: BASELINE_ID,
        p_option_ids: OPTION_IDS,
        p_criterion_ids: CRITERION_IDS,
      })
    ).rejects.toBeInstanceOf(TechnicalConfigurationResultExportError)
  })
})
