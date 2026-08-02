import { RESULT_EXPORT_RPC_FUNCTIONS } from "@/lib/technical-configuration-result-export-rpcs"

import {
  callTechnicalConfigurationRpc,
  TechnicalConfigurationRpcError,
} from "./technical-configuration-rpc"
import {
  decodeCriterionAxisItem,
  decodeOptionAxisItem,
} from "./technical-configuration-result-export-axis-decoders"
import {
  decodeManifest,
  decodeMatrixCell,
  decodePageMetadata,
  decodeRankingItem,
  TechnicalConfigurationResultExportError,
} from "./technical-configuration-result-export-decoders"
import type { TechnicalConfigurationResultExportErrorKind } from "./technical-configuration-result-export-decoders"
import type {
  TechnicalConfigurationResultExportCriterionAxisPageWireResponse,
  TechnicalConfigurationResultExportManifestWireResponse,
  TechnicalConfigurationResultExportMatrixPageWireResponse,
  TechnicalConfigurationResultExportOptionAxisPageWireResponse,
  TechnicalConfigurationResultExportPageRpcArgs,
  TechnicalConfigurationResultExportPageWireResponse,
  TechnicalConfigurationResultExportRankingPageWireResponse,
  TechnicalConfigurationResultExportScopeRpcArgs,
} from "./technical-configuration-result-export-types"

export { TechnicalConfigurationResultExportError } from "./technical-configuration-result-export-decoders"
export type { TechnicalConfigurationResultExportErrorKind } from "./technical-configuration-result-export-decoders"

function rpcErrorKind(
  error: TechnicalConfigurationRpcError
): TechnicalConfigurationResultExportErrorKind {
  if (error.status >= 200 && error.status < 300) return "invalid_response"
  if (error.code === "42501" || error.status === 401 || error.status === 403) {
    return "permission_denied"
  }
  if (error.code === "PT404" || error.status === 404) return "not_found"
  if (error.code === "PT409" || error.status === 409) return "conflict"
  if (error.code === "PT422" || error.status === 422) return "validation"
  if (error.code === "PT500" || error.status >= 500) return "server"
  return "transport"
}

function mapRpcError(error: TechnicalConfigurationRpcError) {
  return new TechnicalConfigurationResultExportError(rpcErrorKind(error), error.message, {
    status: error.status,
    code: error.code,
    details: error.details,
    hint: error.hint,
    cause: error,
  })
}

async function callResultExportRpc<T>(
  fn: string,
  args: object,
  decode: (value: unknown) => T,
  signal?: AbortSignal
): Promise<T> {
  try {
    return decode(await callTechnicalConfigurationRpc<unknown>(fn, args, { signal }))
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    if (error instanceof TechnicalConfigurationResultExportError) throw error
    if (error instanceof TechnicalConfigurationRpcError) throw mapRpcError(error)
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw new TechnicalConfigurationResultExportError("transport", "Result export RPC failed.", {
      cause: error,
    })
  }
}

function listResultExportPage<TItem>(
  fn: string,
  args: TechnicalConfigurationResultExportPageRpcArgs,
  path: string,
  decodeItem: (value: unknown, index: number) => TItem,
  signal?: AbortSignal
): Promise<TechnicalConfigurationResultExportPageWireResponse<TItem>> {
  return callResultExportRpc(
    fn,
    args,
    (value) => {
      const page = decodePageMetadata(value, args, path)
      return {
        data: page.data.map(decodeItem),
        dossier_id: page.dossierId,
        baseline_version_id: page.baselineId,
        snapshot_token: page.snapshotToken,
        ranking_snapshot_token: page.rankingSnapshotToken,
        total: page.total,
        page: page.page,
        page_size: page.pageSize,
      }
    },
    signal
  )
}

/** Fetch and decode one stable result-export manifest. */
export function getTechnicalConfigurationResultExportManifest(
  args: TechnicalConfigurationResultExportScopeRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationResultExportManifestWireResponse> {
  return callResultExportRpc(
    RESULT_EXPORT_RPC_FUNCTIONS.getManifest,
    args,
    (value) => decodeManifest(value, args),
    signal
  )
}

/** Fetch and decode one bounded result-export ranking page. */
export function listTechnicalConfigurationResultExportRanking(
  args: TechnicalConfigurationResultExportPageRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationResultExportRankingPageWireResponse> {
  return listResultExportPage(
    RESULT_EXPORT_RPC_FUNCTIONS.listRanking,
    args,
    "ranking",
    decodeRankingItem,
    signal
  )
}

/** Fetch and decode one bounded result-export matrix page. */
export function listTechnicalConfigurationResultExportMatrix(
  args: TechnicalConfigurationResultExportPageRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationResultExportMatrixPageWireResponse> {
  return listResultExportPage(
    RESULT_EXPORT_RPC_FUNCTIONS.listMatrix,
    args,
    "matrix",
    decodeMatrixCell,
    signal
  )
}

/** Fetch and decode one bounded ordered option-axis page. */
export function listTechnicalConfigurationResultExportOptionAxis(
  args: TechnicalConfigurationResultExportPageRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationResultExportOptionAxisPageWireResponse> {
  return listResultExportPage(
    RESULT_EXPORT_RPC_FUNCTIONS.listOptionAxis,
    args,
    "option_axis",
    decodeOptionAxisItem,
    signal
  )
}

/** Fetch and decode one bounded ordered criterion-axis page. */
export function listTechnicalConfigurationResultExportCriterionAxis(
  args: TechnicalConfigurationResultExportPageRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationResultExportCriterionAxisPageWireResponse> {
  return listResultExportPage(
    RESULT_EXPORT_RPC_FUNCTIONS.listCriterionAxis,
    args,
    "criterion_axis",
    decodeCriterionAxisItem,
    signal
  )
}
