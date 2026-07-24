import { isTechnicalConfigurationBaselineConflict } from "./technical-configuration-baseline-version-state"
import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"
import type {
  TechnicalConfigurationComparisonSetGetOrCreateRpcArgs,
  TechnicalConfigurationComparisonSetGetRpcArgs,
  TechnicalConfigurationComparisonSetReadWireResponse,
  TechnicalConfigurationComparisonSetWire,
  TechnicalConfigurationComparisonSetWireResponse,
  TechnicalConfigurationOptionResponseUpsertRpcArgs,
  TechnicalConfigurationOptionResponseWire,
  TechnicalConfigurationOptionResponseWireResponse,
} from "./supplier-option-types"

/** Reads a nullable comparison set without creating data or incrementing revisions. */
export async function readTechnicalConfigurationComparisonSet(
  args: TechnicalConfigurationComparisonSetGetRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationComparisonSetWire | null> {
  const response =
    await callTechnicalConfigurationRpc<TechnicalConfigurationComparisonSetReadWireResponse>(
      "technical_configuration_comparison_set_get",
      args,
      { signal }
    )
  return response.data
}

/** Gets or creates the comparison set only after an explicit save action. */
export async function getOrCreateTechnicalConfigurationComparisonSet(
  args: TechnicalConfigurationComparisonSetGetOrCreateRpcArgs
): Promise<TechnicalConfigurationComparisonSetWire> {
  const response =
    await callTechnicalConfigurationRpc<TechnicalConfigurationComparisonSetWireResponse>(
      "technical_configuration_comparison_set_get_or_create",
      args
    )
  return response.data
}

/** Persists one exact-baseline criterion response with optimistic concurrency. */
export async function upsertTechnicalConfigurationOptionResponse(
  args: TechnicalConfigurationOptionResponseUpsertRpcArgs
): Promise<TechnicalConfigurationOptionResponseWire> {
  const response =
    await callTechnicalConfigurationRpc<TechnicalConfigurationOptionResponseWireResponse>(
      "technical_configuration_option_response_upsert",
      args
    )
  return response.data
}

/** Carries the now-existing set when step two of the first save fails. */
export class TechnicalConfigurationOptionResponseSaveFailure extends Error {
  readonly comparisonSet: TechnicalConfigurationComparisonSetWire
  readonly isConflict: boolean
  readonly originalError: unknown

  constructor(error: unknown, comparisonSet: TechnicalConfigurationComparisonSetWire) {
    super(error instanceof Error && error.message ? error.message : "option_response_save_failed")
    this.name = "TechnicalConfigurationOptionResponseSaveFailure"
    this.comparisonSet = comparisonSet
    this.isConflict = isTechnicalConfigurationBaselineConflict(error)
    this.originalError = error
  }
}

/** Runs the recoverable get-or-create then upsert sequence for one explicit save. */
export async function saveTechnicalConfigurationOptionResponse({
  optionId,
  baselineVersionId,
  criterionId,
  responseText,
  supplementaryInformation,
  expectedRevision,
  comparisonSet: existingComparisonSet,
  onComparisonSetReady,
}: {
  optionId: string
  baselineVersionId: string
  criterionId: string
  responseText: string
  supplementaryInformation: string
  expectedRevision: number
  comparisonSet: TechnicalConfigurationComparisonSetWire | null
  onComparisonSetReady?: (comparisonSet: TechnicalConfigurationComparisonSetWire) => void
}): Promise<{
  comparisonSet: TechnicalConfigurationComparisonSetWire
  response: TechnicalConfigurationOptionResponseWire
}> {
  const comparisonSet =
    existingComparisonSet ??
    (await getOrCreateTechnicalConfigurationComparisonSet({
      p_option_id: optionId,
      p_baseline_version_id: baselineVersionId,
      p_expected_revision: expectedRevision,
    }))
  if (!existingComparisonSet) onComparisonSetReady?.(comparisonSet)

  try {
    const response = await upsertTechnicalConfigurationOptionResponse({
      p_comparison_set_id: comparisonSet.id,
      p_criterion_id: criterionId,
      p_response_text: responseText,
      p_supplementary_information: supplementaryInformation,
      p_expected_revision: existingComparisonSet ? expectedRevision : comparisonSet.revision,
    })
    return { comparisonSet, response }
  } catch (error) {
    throw new TechnicalConfigurationOptionResponseSaveFailure(error, comparisonSet)
  }
}
