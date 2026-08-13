import { afterEach, describe, expect, it } from "vitest"

import { RESULT_EXPORT_RPC_FUNCTIONS } from "@/lib/technical-configuration-result-export-rpcs"

import { collectTechnicalConfigurationResultExportDataset } from "../technical-configuration-result-export-data"
import {
  listTechnicalConfigurationResultExportCriterionAxis,
  listTechnicalConfigurationResultExportOptionAxis,
} from "../technical-configuration-result-export-rpc"
import {
  BASELINE_ID,
  createManyPageFixture,
  createPagedHandler,
  CRITERION_IDS,
  criterionAxisRows,
  DOSSIER_ID,
  exportRequest,
  installRpcMock,
  jsonResponse,
  manifestResponse,
  OPTION_IDS,
  optionAxisRows,
  resultExportHierarchySnapshot,
} from "./technical-configuration-result-export-fixtures"

afterEach(() => vi.unstubAllGlobals())

const pageArgs = {
  p_dossier_id: DOSSIER_ID,
  p_baseline_version_id: BASELINE_ID,
  p_option_ids: OPTION_IDS,
  p_criterion_ids: CRITERION_IDS,
  p_page: 1,
  p_page_size: 100,
} as const

function axisPage(data: unknown[], total = data.length) {
  return {
    data,
    dossier_id: DOSSIER_ID,
    baseline_version_id: BASELINE_ID,
    snapshot_token: "snapshot-v1",
    ranking_snapshot_token: "ranking-v1",
    total,
    page: 1,
    page_size: 100,
  }
}

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function createHierarchySnapshot(
  criterionAxis: readonly (typeof criterionAxisRows)[number][] = criterionAxisRows
) {
  const criterionIds = new Set(criterionAxis.map((criterion) => criterion.criterion_id))
  const group = resultExportHierarchySnapshot.baselineGroups[0]
  return {
    ...resultExportHierarchySnapshot,
    baselineGroups: [
      {
        ...group,
        criteria: group.criteria.filter((criterion) => criterionIds.has(criterion.id)),
      },
    ],
  }
}

function collectDataset(request = exportRequest(), hierarchySnapshot = createHierarchySnapshot()) {
  return collectTechnicalConfigurationResultExportDataset(request, hierarchySnapshot)
}

describe("P14A4 result export axis adapters", () => {
  it("decodes the exact ordered option and criterion descriptors", async () => {
    installRpcMock(({ fn }) => {
      if (fn === RESULT_EXPORT_RPC_FUNCTIONS.listOptionAxis) {
        return jsonResponse(axisPage(optionAxisRows))
      }
      if (fn === RESULT_EXPORT_RPC_FUNCTIONS.listCriterionAxis) {
        return jsonResponse(axisPage(criterionAxisRows))
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    await expect(listTechnicalConfigurationResultExportOptionAxis(pageArgs)).resolves.toMatchObject(
      {
        data: optionAxisRows,
        total: optionAxisRows.length,
      }
    )
    await expect(
      listTechnicalConfigurationResultExportCriterionAxis(pageArgs)
    ).resolves.toMatchObject({
      data: criterionAxisRows,
      total: criterionAxisRows.length,
    })
  })

  it.each([
    {
      label: "option",
      fn: RESULT_EXPORT_RPC_FUNCTIONS.listOptionAxis,
      row: { ...optionAxisRows[0], unexpected: true },
      call: listTechnicalConfigurationResultExportOptionAxis,
    },
    {
      label: "criterion",
      fn: RESULT_EXPORT_RPC_FUNCTIONS.listCriterionAxis,
      row: { ...criterionAxisRows[0], unexpected: true },
      call: listTechnicalConfigurationResultExportCriterionAxis,
    },
  ] as const)("rejects a malformed $label descriptor", async ({ fn, row, call }) => {
    installRpcMock(({ fn: calledFn }) => {
      if (calledFn !== fn) throw new Error(`Unexpected RPC: ${calledFn}`)
      return jsonResponse(axisPage([row]))
    })

    await expect(call(pageArgs)).rejects.toMatchObject({
      name: "TechnicalConfigurationResultExportError",
      kind: "invalid_response",
    })
  })
})

describe("P14A4 stable ordered axes collector", () => {
  it("starts both independent axes before either first page resolves", async () => {
    const optionGate = createDeferred()
    const criterionGate = createDeferred()
    let optionStarted = false
    let criterionStarted = false
    const fallback = createPagedHandler()
    installRpcMock(async (call) => {
      if (call.fn === RESULT_EXPORT_RPC_FUNCTIONS.listOptionAxis) {
        optionStarted = true
        await optionGate.promise
        return jsonResponse(axisPage(optionAxisRows))
      }
      if (call.fn === RESULT_EXPORT_RPC_FUNCTIONS.listCriterionAxis) {
        criterionStarted = true
        await criterionGate.promise
        return jsonResponse(axisPage(criterionAxisRows))
      }
      return fallback(call)
    })

    const result = collectDataset()
    await vi.waitFor(() => expect([optionStarted, criterionStarted]).toEqual([true, true]))

    optionGate.resolve()
    criterionGate.resolve()
    await expect(result).resolves.toMatchObject({
      optionAxis: optionAxisRows,
      criterionAxis: criterionAxisRows,
    })
  })

  it("collects both complete axes before mode-specific surfaces", async () => {
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

    const dataset = await collectDataset(
      {
        ...exportRequest(),
        optionIds: fixture.optionIds,
        criterionIds: fixture.criterionIds,
      },
      fixture.hierarchySnapshot
    )

    expect(dataset.optionAxis.map((item) => item.option_id)).toEqual(fixture.optionIds)
    expect(dataset.criterionAxis.map((item) => item.criterion_id)).toEqual(fixture.criterionIds)
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

  it.each([
    {
      label: "0 x 0",
      optionAxis: [],
      criterionAxis: [],
      optionTotal: 0,
      criterionTotal: 0,
    },
    {
      label: "1 x 0",
      optionAxis: [optionAxisRows[0]],
      criterionAxis: [],
      optionTotal: 1,
      criterionTotal: 0,
    },
    {
      label: "0 x 1",
      optionAxis: [],
      criterionAxis: [criterionAxisRows[0]],
      optionTotal: 0,
      criterionTotal: 1,
    },
  ] as const)(
    "preserves independent ordered dimensions for $label",
    async ({ optionAxis, criterionAxis, optionTotal, criterionTotal }) => {
      const manifest = {
        data: {
          ...manifestResponse.data,
          option_total: optionTotal,
          criterion_total: criterionTotal,
        },
      }
      installRpcMock(
        createPagedHandler({
          manifest,
          finalManifest: manifest,
          optionAxisPages: [optionAxis],
          criterionAxisPages: [criterionAxis],
          rankingPages: [[]],
          matrixPages: [[]],
        })
      )

      const dataset = await collectDataset(
        {
          ...exportRequest("detailed_matrix_only"),
          optionIds: optionTotal === 0 ? null : optionAxis.map((item) => item.option_id),
          criterionIds:
            criterionTotal === 0 ? null : criterionAxis.map((item) => item.criterion_id),
        },
        createHierarchySnapshot(criterionAxis)
      )

      expect(dataset.optionAxis).toEqual(optionAxis)
      expect(dataset.criterionAxis).toEqual(criterionAxis)
      expect(dataset.matrix).toEqual([])
    }
  )

  it.each([
    {
      label: "option",
      pages: { optionAxisPages: [[optionAxisRows[1], optionAxisRows[0]]] },
    },
    {
      label: "criterion",
      pages: { criterionAxisPages: [[criterionAxisRows[1], criterionAxisRows[0]]] },
    },
  ] as const)(
    "rejects reordered $label axes even when membership is unchanged",
    async ({ pages }) => {
      installRpcMock(createPagedHandler(pages))

      await expect(collectDataset(exportRequest("ranking_only"))).rejects.toMatchObject({
        name: "TechnicalConfigurationResultExportError",
        kind: "snapshot_changed",
      })
    }
  )

  it("deep-freezes both axes and their descriptor rows", async () => {
    installRpcMock(createPagedHandler())

    const dataset = await collectDataset()

    expect(Object.isFrozen(dataset.optionAxis)).toBe(true)
    expect(Object.isFrozen(dataset.criterionAxis)).toBe(true)
    for (const item of [...dataset.optionAxis, ...dataset.criterionAxis]) {
      expect(Object.isFrozen(item)).toBe(true)
    }
  })
})
