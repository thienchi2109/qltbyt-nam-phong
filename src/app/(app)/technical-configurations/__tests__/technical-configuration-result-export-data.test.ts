import { afterEach, describe, expect, it } from "vitest"

import { RESULT_EXPORT_RPC_FUNCTIONS } from "@/lib/technical-configuration-result-export-rpcs"

import { collectTechnicalConfigurationResultExportDataset } from "../technical-configuration-result-export-data"
import {
  createManyPageFixture,
  createPagedHandler,
  criterionAxisRows,
  exportRequest,
  installRpcMock,
  jsonResponse,
  manifestResponse,
  matrixRows,
  OPTION_IDS,
  rankingRows,
} from "./technical-configuration-result-export-fixtures"

afterEach(() => vi.unstubAllGlobals())

function pendingRpcResponse(signal: AbortSignal | null): Promise<Response> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  return new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason), { once: true })
  })
}

function startPendingCollection(
  mode: "ranking_only" | "detailed_matrix_only",
  signal: AbortSignal
) {
  let activeSignal: AbortSignal | null = null
  installRpcMock(({ fn, signal: requestSignal }) => {
    if (fn === RESULT_EXPORT_RPC_FUNCTIONS.getManifest) return jsonResponse(manifestResponse)
    activeSignal = requestSignal
    return pendingRpcResponse(requestSignal)
  })
  return {
    result: collectTechnicalConfigurationResultExportDataset({
      ...exportRequest(mode),
      signal,
    }),
    waitUntilActive: () => vi.waitFor(() => expect(activeSignal).toBe(signal)),
  }
}

describe("P14A3 stable result export dataset collector", () => {
  it("collects real bounded pages sequentially and freezes the complete dataset", async () => {
    const fixture = createManyPageFixture()
    const { calls } = installRpcMock(
      createPagedHandler({
        manifest: fixture.manifest,
        finalManifest: fixture.manifest,
        optionAxisPages: [fixture.optionAxis.slice(0, 100), fixture.optionAxis.slice(100)],
        criterionAxisPages: [fixture.criterionAxis],
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
    const pageCalls = calls.map(({ fn, args }) => [fn, args.p_page ?? null])
    expect(pageCalls[0]).toEqual([RESULT_EXPORT_RPC_FUNCTIONS.getManifest, null])
    expect(pageCalls.slice(1, 4)).toEqual(
      expect.arrayContaining([
        [RESULT_EXPORT_RPC_FUNCTIONS.listOptionAxis, 1],
        [RESULT_EXPORT_RPC_FUNCTIONS.listOptionAxis, 2],
        [RESULT_EXPORT_RPC_FUNCTIONS.listCriterionAxis, 1],
      ])
    )
    expect(pageCalls.slice(4)).toEqual([
      [RESULT_EXPORT_RPC_FUNCTIONS.listRanking, 1],
      [RESULT_EXPORT_RPC_FUNCTIONS.listRanking, 2],
      [RESULT_EXPORT_RPC_FUNCTIONS.listMatrix, 1],
      [RESULT_EXPORT_RPC_FUNCTIONS.listMatrix, 2],
      [RESULT_EXPORT_RPC_FUNCTIONS.getManifest, null],
    ])
  })

  it("deep-freezes collected rows and nested document links", async () => {
    installRpcMock(createPagedHandler())

    const dataset = await collectTechnicalConfigurationResultExportDataset(exportRequest())

    expect(dataset.mode).toBe("full")
    if (dataset.mode !== "full") throw new Error("Expected a full export dataset.")
    for (const row of dataset.ranking) expect(Object.isFrozen(row)).toBe(true)
    for (const cell of dataset.matrix) {
      expect(Object.isFrozen(cell)).toBe(true)
      expect(Object.isFrozen(cell.document_links)).toBe(true)
      for (const link of cell.document_links) expect(Object.isFrozen(link)).toBe(true)
    }
  })

  it("collects a zero-cell matrix when one selected dimension is empty", async () => {
    const emptyManifest = { data: { ...manifestResponse.data, option_total: 0 } }
    const { calls } = installRpcMock(
      createPagedHandler({
        manifest: emptyManifest,
        finalManifest: emptyManifest,
        optionAxisPages: [[]],
        criterionAxisPages: [criterionAxisRows],
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
    expect(calls).toHaveLength(6)
  })

  it.each([
    {
      mode: "ranking_only",
      expected: [
        RESULT_EXPORT_RPC_FUNCTIONS.getManifest,
        RESULT_EXPORT_RPC_FUNCTIONS.listOptionAxis,
        RESULT_EXPORT_RPC_FUNCTIONS.listCriterionAxis,
        RESULT_EXPORT_RPC_FUNCTIONS.listRanking,
        RESULT_EXPORT_RPC_FUNCTIONS.getManifest,
      ],
    },
    {
      mode: "detailed_matrix_only",
      expected: [
        RESULT_EXPORT_RPC_FUNCTIONS.getManifest,
        RESULT_EXPORT_RPC_FUNCTIONS.listOptionAxis,
        RESULT_EXPORT_RPC_FUNCTIONS.listCriterionAxis,
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

  it.each([
    {
      mode: "ranking_only",
      name: "AbortError",
      reason: new DOMException("cancelled", "AbortError"),
    },
    {
      mode: "detailed_matrix_only",
      name: "custom error",
      reason: new Error("custom cancellation"),
    },
  ] as const)("forwards and preserves $name cancellation in $mode", async ({ mode, reason }) => {
    const controller = new AbortController()
    const { result, waitUntilActive } = startPendingCollection(mode, controller.signal)
    await waitUntilActive()
    controller.abort(reason)

    await expect(result).rejects.toBe(reason)
  })

  it("preserves the reason from AbortSignal.timeout()", async () => {
    const signal = AbortSignal.timeout(100)
    const { result, waitUntilActive } = startPendingCollection("ranking_only", signal)
    const rejection = result.then(
      () => null,
      (error: unknown) => error
    )
    await waitUntilActive()
    await vi.waitFor(() => expect(signal.aborted).toBe(true))

    await expect(rejection).resolves.toBe(signal.reason)
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
