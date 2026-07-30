import { ASSESSMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-assessment-rpcs"

import type {
  TechnicalConfigurationAssessmentListRpcArgs,
  TechnicalConfigurationAssessmentListWireResponse,
  TechnicalConfigurationAssessmentUpsertRpcArgs,
  TechnicalConfigurationAssessmentWireResponse,
} from "./assessment-types"
import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"

/** Lists one bounded page of manual assessments for an existing comparison set. */
export function listTechnicalConfigurationAssessments(
  args: TechnicalConfigurationAssessmentListRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationAssessmentListWireResponse> {
  return callTechnicalConfigurationRpc(ASSESSMENT_RPC_FUNCTIONS.listAssessments, args, { signal })
}

/** Upserts one manual assessment while preserving the P11B row revision contract. */
export function upsertTechnicalConfigurationAssessment(
  args: TechnicalConfigurationAssessmentUpsertRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationAssessmentWireResponse> {
  return callTechnicalConfigurationRpc(ASSESSMENT_RPC_FUNCTIONS.upsertAssessment, args, { signal })
}
