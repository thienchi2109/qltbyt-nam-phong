import { vi } from "vitest"

import { RESULT_EXPORT_RPC_FUNCTIONS } from "@/lib/technical-configuration-result-export-rpcs"

import type { TechnicalConfigurationResultExportMode } from "../technical-configuration-result-export-data"

export const DOSSIER_ID = "10000000-0000-4000-8000-000000000001"
export const BASELINE_ID = "20000000-0000-4000-8000-000000000001"
export const OPTION_IDS = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
] as const
const SUPPLIER_IDS = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
] as const
export const CRITERION_IDS = [
  "50000000-0000-4000-8000-000000000001",
  "50000000-0000-4000-8000-000000000002",
] as const
const GROUP_ID = "60000000-0000-4000-8000-000000000001"
const DOCUMENT_ID = "70000000-0000-4000-8000-000000000001"
const CITATION_ID = "80000000-0000-4000-8000-000000000001"

export const manifestResponse = {
  data: {
    dossier: {
      id: DOSSIER_ID,
      device_type_name: "Máy siêu âm",
      name: "Cấu hình máy siêu âm",
      revision: 9,
      archived_at: null,
    },
    baseline_version: {
      id: BASELINE_ID,
      dossier_id: DOSSIER_ID,
      version_number: 3,
      status: "locked",
      revision: 4,
      locked_at: "2026-08-01T02:03:04.000Z",
    },
    option_total: 2,
    criterion_total: 2,
    snapshot_token: "snapshot-v1",
    ranking_snapshot_token: "ranking-v1",
  },
}

export const rankingRows = OPTION_IDS.map((optionId, index) => ({
  option_id: optionId,
  supplier_id: SUPPLIER_IDS[index],
  supplier_name: `Nhà cung cấp ${index + 1}`,
  display_label: `Phương án ${index + 1}`,
  eligibility: index === 0 ? ("eligible" as const) : ("incomplete" as const),
  incomplete_criterion_count: index,
  failed_count: 0,
  insufficient_evidence_count: 0,
  exceeds_count: index === 0 ? 2 : 0,
  rank: index === 0 ? 1 : null,
}))

function createMatrixCell(criterionIndex: number, optionIndex: number) {
  return {
    group_id: GROUP_ID,
    group_name: "Nhóm chung",
    group_order: 1,
    criterion_id: CRITERION_IDS[criterionIndex],
    criterion_code: `TC-${criterionIndex + 1}`,
    criterion_title: `Tiêu chí ${criterionIndex + 1}`,
    requirement_text: `Yêu cầu ${criterionIndex + 1}`,
    criterion_order: criterionIndex + 1,
    option_id: OPTION_IDS[optionIndex],
    supplier_id: SUPPLIER_IDS[optionIndex],
    supplier_name: `Nhà cung cấp ${optionIndex + 1}`,
    display_label: `Phương án ${optionIndex + 1}`,
    model: optionIndex === 0 ? "Model A" : null,
    manufacturer: optionIndex === 0 ? "Hãng A" : null,
    option_name: optionIndex === 0 ? "Gói A" : null,
    response_text: optionIndex === 0 ? "Đáp ứng" : null,
    supplementary_information: optionIndex === 0 ? "" : null,
    document_links:
      criterionIndex === 0 && optionIndex === 0
        ? [
            {
              document_id: DOCUMENT_ID,
              document_name: "Tài liệu kỹ thuật",
              document_url: "https://example.com/document",
              citation_id: CITATION_ID,
              page_section: null,
              excerpt: "Đoạn trích",
            },
          ]
        : [],
    technical_axis: optionIndex === 0 ? ("meets" as const) : null,
    evidence_axis: optionIndex === 0 ? ("complete" as const) : null,
    assessment_notes: optionIndex === 0 ? "" : null,
    conclusion: optionIndex === 0 ? ("meets" as const) : ("not_evaluated" as const),
  }
}

export const matrixRows = [
  createMatrixCell(0, 0),
  createMatrixCell(0, 1),
  createMatrixCell(1, 0),
  createMatrixCell(1, 1),
]

export type RpcCall = {
  fn: string
  args: Record<string, unknown>
  signal: AbortSignal | null
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function installRpcMock(handler: (call: RpcCall) => Response | Promise<Response>): {
  calls: RpcCall[]
} {
  const calls: RpcCall[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const call = {
        fn: decodeURIComponent(String(input).split("/").at(-1) ?? ""),
        args: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        signal: init?.signal ?? null,
      }
      calls.push(call)
      return handler(call)
    })
  )
  return { calls }
}

export function exportRequest(mode: TechnicalConfigurationResultExportMode = "full") {
  return {
    mode,
    dossierId: DOSSIER_ID,
    baselineVersionId: BASELINE_ID,
    optionIds: OPTION_IDS,
    criterionIds: CRITERION_IDS,
  } as const
}

export function createPagedHandler({
  manifest = manifestResponse,
  finalManifest = manifestResponse,
  rankingPages = [rankingRows],
  matrixPages = [matrixRows],
  rankingPageOverrides = {},
  matrixPageOverrides = {},
}: {
  manifest?: unknown
  finalManifest?: unknown
  rankingPages?: unknown[][]
  matrixPages?: unknown[][]
  rankingPageOverrides?: Record<number, Record<string, unknown>>
  matrixPageOverrides?: Record<number, Record<string, unknown>>
} = {}) {
  let manifestCalls = 0
  return ({ fn, args }: RpcCall) => {
    if (fn === RESULT_EXPORT_RPC_FUNCTIONS.getManifest) {
      manifestCalls += 1
      return jsonResponse(manifestCalls === 1 ? manifest : finalManifest)
    }
    if (fn === RESULT_EXPORT_RPC_FUNCTIONS.listRanking) {
      const page = Number(args.p_page)
      return jsonResponse({
        data: rankingPages[page - 1] ?? [],
        dossier_id: DOSSIER_ID,
        baseline_version_id: BASELINE_ID,
        snapshot_token: "snapshot-v1",
        ranking_snapshot_token: "ranking-v1",
        total: rankingPages.flat().length,
        page,
        page_size: 100,
        ...rankingPageOverrides[page],
      })
    }
    if (fn === RESULT_EXPORT_RPC_FUNCTIONS.listMatrix) {
      const page = Number(args.p_page)
      return jsonResponse({
        data: matrixPages[page - 1] ?? [],
        dossier_id: DOSSIER_ID,
        baseline_version_id: BASELINE_ID,
        snapshot_token: "snapshot-v1",
        ranking_snapshot_token: "ranking-v1",
        total: matrixPages.flat().length,
        page,
        page_size: 1000,
        ...matrixPageOverrides[page],
      })
    }
    throw new Error(`Unexpected RPC: ${fn}`)
  }
}

function indexedUuid(namespace: number, index: number) {
  return `${String(namespace).padStart(8, "0")}-0000-4000-8000-${String(index + 1).padStart(
    12,
    "0"
  )}`
}

export function createManyPageFixture() {
  const optionIds = Array.from({ length: 101 }, (_, index) => indexedUuid(30, index))
  const supplierIds = Array.from({ length: 101 }, (_, index) => indexedUuid(40, index))
  const criterionIds = Array.from({ length: 10 }, (_, index) => indexedUuid(50, index))
  const rankings = optionIds.map((optionId, index) => ({
    ...rankingRows[0],
    option_id: optionId,
    supplier_id: supplierIds[index],
    supplier_name: `Nhà cung cấp ${index + 1}`,
    display_label: `Phương án ${index + 1}`,
    rank: index + 1,
  }))
  const matrix = criterionIds.flatMap((criterionId, criterionIndex) =>
    optionIds.map((optionId, optionIndex) => ({
      ...matrixRows[0],
      criterion_id: criterionId,
      criterion_code: `TC-${criterionIndex + 1}`,
      criterion_title: `Tiêu chí ${criterionIndex + 1}`,
      requirement_text: `Yêu cầu ${criterionIndex + 1}`,
      criterion_order: criterionIndex + 1,
      option_id: optionId,
      supplier_id: supplierIds[optionIndex],
      supplier_name: `Nhà cung cấp ${optionIndex + 1}`,
      display_label: `Phương án ${optionIndex + 1}`,
      document_links: [],
    }))
  )
  const manifest = {
    data: {
      ...manifestResponse.data,
      option_total: optionIds.length,
      criterion_total: criterionIds.length,
    },
  }
  return { optionIds, criterionIds, rankings, matrix, manifest }
}
