import { afterEach, describe, expect, it } from "vitest"

import { RESULT_EXPORT_RPC_FUNCTIONS } from "@/lib/technical-configuration-result-export-rpcs"

import { collectTechnicalConfigurationResultExportDataset } from "../technical-configuration-result-export-data"
import {
  getTechnicalConfigurationResultExportManifest,
  TechnicalConfigurationResultExportError,
} from "../technical-configuration-result-export-rpc"
import {
  BASELINE_ID,
  createManyPageFixture,
  createPagedHandler,
  CRITERION_IDS,
  DOSSIER_ID,
  exportRequest,
  installRpcMock,
  jsonResponse,
  manifestResponse,
  matrixRows,
  OPTION_IDS,
  rankingRows,
  type RpcCall,
} from "./technical-configuration-result-export-fixtures"

afterEach(() => vi.unstubAllGlobals())

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

describe("P14A3 stable result export dataset collector", () => {
  it("collects real bounded pages sequentially and freezes the complete dataset", async () => {
    const fixture = createManyPageFixture()
    const { calls } = installRpcMock(
      createPagedHandler({
        manifest: fixture.manifest,
        finalManifest: fixture.manifest,
        rankingPages: [fixture.rankings.slice(0, 100), fixture.rankings.slice(100)],
        matrixPages: [fixture.matrix.slice(0, 1000), fixture.matrix.slice(1000)],
      })
    )

    const dataset = await collectTechnicalConfigurationResultExportDataset({
      ...exportRequest(),
      optionIds: fixture.optionIds,
      criterionIds: fixture.criterionIds,
    })

    expect(dataset.ranking).toHaveLength(101)
    expect(dataset.matrix).toHaveLength(1010)
    expect(Object.isFrozen(dataset)).toBe(true)
    expect(Object.isFrozen(dataset.ranking)).toBe(true)
    expect(Object.isFrozen(dataset.matrix)).toBe(true)
    expect(calls.map(({ fn, args }) => [fn, args.p_page ?? null])).toEqual([
      [RESULT_EXPORT_RPC_FUNCTIONS.getManifest, null],
      [RESULT_EXPORT_RPC_FUNCTIONS.listRanking, 1],
      [RESULT_EXPORT_RPC_FUNCTIONS.listRanking, 2],
      [RESULT_EXPORT_RPC_FUNCTIONS.listMatrix, 1],
      [RESULT_EXPORT_RPC_FUNCTIONS.listMatrix, 2],
      [RESULT_EXPORT_RPC_FUNCTIONS.getManifest, null],
    ])
  })

  it("collects a zero-cell matrix when one selected dimension is empty", async () => {
    const emptyManifest = { data: { ...manifestResponse.data, option_total: 0 } }
    const { calls } = installRpcMock(
      createPagedHandler({
        manifest: emptyManifest,
        finalManifest: emptyManifest,
        rankingPages: [[]],
        matrixPages: [[]],
      })
    )

    await expect(
      collectTechnicalConfigurationResultExportDataset({
        ...exportRequest(),
        optionIds: null,
      })
    ).resolves.toMatchObject({ ranking: [], matrix: [] })
    expect(calls).toHaveLength(4)
  })

  it.each([
    {
      mode: "ranking_only",
      expected: [
        RESULT_EXPORT_RPC_FUNCTIONS.getManifest,
        RESULT_EXPORT_RPC_FUNCTIONS.listRanking,
        RESULT_EXPORT_RPC_FUNCTIONS.getManifest,
      ],
    },
    {
      mode: "detailed_matrix_only",
      expected: [
        RESULT_EXPORT_RPC_FUNCTIONS.getManifest,
        RESULT_EXPORT_RPC_FUNCTIONS.listMatrix,
        RESULT_EXPORT_RPC_FUNCTIONS.getManifest,
      ],
    },
  ] as const)("never fetches an unrequested surface in $mode mode", async ({ mode, expected }) => {
    const { calls } = installRpcMock(createPagedHandler())

    const dataset = await collectTechnicalConfigurationResultExportDataset(exportRequest(mode))

    expect(dataset.mode).toBe(mode)
    expect(calls.map(({ fn }) => fn)).toEqual(expected)
  })

  it("forwards and preserves cancellation from the active page request", async () => {
    const controller = new AbortController()
    const abortError = new DOMException("cancelled", "AbortError")
    let activeSignal: AbortSignal | null = null
    installRpcMock(({ fn, signal }) => {
      if (fn === RESULT_EXPORT_RPC_FUNCTIONS.getManifest) return jsonResponse(manifestResponse)
      activeSignal = signal
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true })
      })
    })

    const result = collectTechnicalConfigurationResultExportDataset({
      ...exportRequest("ranking_only"),
      signal: controller.signal,
    })
    await vi.waitFor(() => expect(activeSignal).toBe(controller.signal))
    controller.abort(abortError)

    await expect(result).rejects.toBe(abortError)
  })

  it.each([
    {
      name: "changed ranking token",
      kind: "snapshot_changed",
      handler: createPagedHandler({
        rankingPageOverrides: { 1: { ranking_snapshot_token: "ranking-v2" } },
      }),
    },
    {
      name: "changed ranking identity",
      kind: "invalid_response",
      handler: createPagedHandler({
        rankingPageOverrides: { 1: { dossier_id: OPTION_IDS[0] } },
      }),
    },
    {
      name: "changed ranking total",
      kind: "snapshot_changed",
      handler: createPagedHandler({
        rankingPages: [createManyPageFixture().rankings.slice(0, 100)],
        rankingPageOverrides: { 1: { total: 102 } },
      }),
    },
    {
      name: "oversized ranking page",
      kind: "invalid_response",
      handler: createPagedHandler({
        rankingPageOverrides: {
          1: { data: Array.from({ length: 101 }, () => rankingRows[0]), total: 101 },
        },
      }),
    },
    {
      name: "duplicate matrix key",
      kind: "snapshot_changed",
      handler: createPagedHandler({
        matrixPages: [[matrixRows[0], matrixRows[0], matrixRows[2], matrixRows[3]]],
      }),
    },
    {
      name: "missing matrix key",
      kind: "snapshot_changed",
      handler: createPagedHandler({
        matrixPages: [
          [
            ...matrixRows.slice(0, 3),
            { ...matrixRows[3], option_id: "30000000-0000-4000-8000-000000000099" },
          ],
        ],
      }),
    },
    {
      name: "malformed nested document link",
      kind: "invalid_response",
      handler: createPagedHandler({
        matrixPageOverrides: {
          1: {
            data: [
              {
                ...matrixRows[0],
                document_links: [{ ...matrixRows[0].document_links[0], citation_id: "bad" }],
              },
              ...matrixRows.slice(1),
            ],
          },
        },
      }),
    },
    {
      name: "changed final manifest",
      kind: "snapshot_changed",
      handler: createPagedHandler({
        finalManifest: {
          data: {
            ...manifestResponse.data,
            dossier: { ...manifestResponse.data.dossier, revision: 10 },
            snapshot_token: "snapshot-v2",
          },
        },
      }),
    },
  ] as const)("rejects the whole dataset on $name", async ({ handler, kind }) => {
    installRpcMock(handler)

    await expect(
      collectTechnicalConfigurationResultExportDataset(exportRequest())
    ).rejects.toMatchObject({
      name: "TechnicalConfigurationResultExportError",
      kind,
    })
  })
})
