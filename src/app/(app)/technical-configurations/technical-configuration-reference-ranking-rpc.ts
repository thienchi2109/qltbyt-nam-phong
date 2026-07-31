import { REFERENCE_RANKING_RPC_FUNCTIONS } from "@/lib/technical-configuration-ranking-rpcs"

import type {
  TechnicalConfigurationReferenceRankingListRpcArgs,
  TechnicalConfigurationReferenceRankingPageWireResponse,
} from "./reference-ranking-types"
import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"

/** Lists one bounded page from the complete dossier-wide reference ranking. */
export function listTechnicalConfigurationReferenceRanking(
  args: TechnicalConfigurationReferenceRankingListRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationReferenceRankingPageWireResponse> {
  return callTechnicalConfigurationRpc(REFERENCE_RANKING_RPC_FUNCTIONS.listReferenceRanking, args, {
    signal,
  })
}
