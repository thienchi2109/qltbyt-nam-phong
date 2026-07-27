import { COMPARISON_READ_RPC_FUNCTIONS } from "@/lib/technical-configuration-comparison-rpcs"
import type {
  TechnicalConfigurationComparisonCriterionRow,
  TechnicalConfigurationComparisonCriterionRowWire,
  TechnicalConfigurationComparisonEvidence,
  TechnicalConfigurationComparisonEvidenceWire,
  TechnicalConfigurationComparisonOptionValue,
  TechnicalConfigurationComparisonOptionValueWire,
  TechnicalConfigurationComparisonRequest,
  TechnicalConfigurationComparisonResponse,
  TechnicalConfigurationComparisonResponseWire,
  TechnicalConfigurationComparisonResult,
  TechnicalConfigurationComparisonRpcArgs,
  TechnicalConfigurationComparisonWireResponse,
} from "./comparison-types"
import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"

function normalizeEvidence(
  evidence: TechnicalConfigurationComparisonEvidenceWire
): TechnicalConfigurationComparisonEvidence {
  return {
    documentCount: evidence.document_count,
    citationCount: evidence.citation_count,
    hasEvidence: evidence.has_evidence,
  }
}

function normalizeResponse(
  response: TechnicalConfigurationComparisonResponseWire | null
): TechnicalConfigurationComparisonResponse | null {
  if (response === null) return null

  return {
    id: response.id,
    responseText: response.response_text,
    supplementaryInformation: response.supplementary_information,
  }
}

function normalizeOptionValue(
  value: TechnicalConfigurationComparisonOptionValueWire
): TechnicalConfigurationComparisonOptionValue {
  return {
    optionId: value.option_id,
    comparisonSetId: value.comparison_set_id,
    response: normalizeResponse(value.response),
    evidence: normalizeEvidence(value.evidence),
  }
}

function normalizeCriterionRow(
  row: TechnicalConfigurationComparisonCriterionRowWire
): TechnicalConfigurationComparisonCriterionRow {
  return {
    group: {
      id: row.group.id,
      name: row.group.name,
      sortOrder: row.group.sort_order,
    },
    criterion: {
      id: row.criterion.id,
      criterionCode: row.criterion.criterion_code,
      title: row.criterion.title,
      requirementText: row.criterion.requirement_text,
      sortOrder: row.criterion.sort_order,
    },
    baselineEvidence: normalizeEvidence(row.baseline_evidence),
    optionValues: row.option_values.map(normalizeOptionValue),
  }
}

/** Reads one bounded comparison page through the fixed P10A1 RPC contract. */
export async function getTechnicalConfigurationComparison(
  request: TechnicalConfigurationComparisonRequest,
  signal?: AbortSignal
): Promise<TechnicalConfigurationComparisonResult> {
  const args: TechnicalConfigurationComparisonRpcArgs = {
    p_baseline_version_id: request.baselineVersionId,
    p_option_ids: request.optionIds,
    p_page: request.page,
    p_page_size: request.pageSize,
  }
  const response =
    await callTechnicalConfigurationRpc<TechnicalConfigurationComparisonWireResponse>(
      COMPARISON_READ_RPC_FUNCTIONS.getComparison,
      args,
      { signal }
    )

  return {
    data: {
      dossier: {
        id: response.data.dossier.id,
        deviceTypeName: response.data.dossier.device_type_name,
        name: response.data.dossier.name,
        revision: response.data.dossier.revision,
        archivedAt: response.data.dossier.archived_at,
      },
      baselineVersion: {
        id: response.data.baseline_version.id,
        dossierId: response.data.baseline_version.dossier_id,
        versionNumber: response.data.baseline_version.version_number,
        status: response.data.baseline_version.status,
        revision: response.data.baseline_version.revision,
      },
      options: response.data.options.map((option) => ({
        id: option.id,
        supplierId: option.supplier_id,
        supplierName: option.supplier_name,
        model: option.model,
        manufacturer: option.manufacturer,
        optionName: option.option_name,
        displayLabel: option.display_label,
      })),
      criteria: response.data.criteria.map(normalizeCriterionRow),
    },
    total: response.total,
    page: response.page,
    pageSize: response.page_size,
  }
}
