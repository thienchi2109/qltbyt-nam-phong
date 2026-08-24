import { ASSESSMENT_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-assessment-rpcs"
import {
  BASELINE_RPC_FUNCTION_NAMES,
  TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPC_NAMES,
} from "@/lib/technical-configuration-baseline-rpcs"
import { COMPARISON_READ_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-comparison-rpcs"
import { DOCUMENT_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-document-rpcs"
import { DOSSIER_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-dossier-rpcs"
import { REFERENCE_RANKING_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-ranking-rpcs"
import { REFERENCE_PRODUCT_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-reference-rpcs"
import { RESULT_EXPORT_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-result-export-rpcs"
import {
  OPTION_IMPORT_RPC_FUNCTION_NAMES,
  OPTION_RESPONSE_READ_RPC_FUNCTION_NAMES,
  OPTION_RESPONSE_RPC_FUNCTION_NAMES,
  OPTION_RPC_FUNCTION_NAMES,
  SUPPLIER_RPC_FUNCTION_NAMES,
} from "@/lib/technical-configuration-supplier-option-rpcs"

/** Complete ordered Technical Configurations RPC manifest for shared server boundaries. */
export const TECHNICAL_CONFIGURATION_RPC_FUNCTION_NAMES = [
  ...DOSSIER_RPC_FUNCTION_NAMES,
  ...BASELINE_RPC_FUNCTION_NAMES,
  ...TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPC_NAMES,
  ...REFERENCE_PRODUCT_RPC_FUNCTION_NAMES,
  ...DOCUMENT_RPC_FUNCTION_NAMES,
  ...SUPPLIER_RPC_FUNCTION_NAMES,
  ...OPTION_RPC_FUNCTION_NAMES,
  ...OPTION_RESPONSE_RPC_FUNCTION_NAMES,
  ...OPTION_RESPONSE_READ_RPC_FUNCTION_NAMES,
  ...OPTION_IMPORT_RPC_FUNCTION_NAMES,
  ...COMPARISON_READ_RPC_FUNCTION_NAMES,
  ...ASSESSMENT_RPC_FUNCTION_NAMES,
  ...REFERENCE_RANKING_RPC_FUNCTION_NAMES,
  ...RESULT_EXPORT_RPC_FUNCTION_NAMES,
] as const
