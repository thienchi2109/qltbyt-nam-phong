/** Named P14A1/P14A2/P14A4 result-export RPCs shared by the proxy and typed clients. */
export const RESULT_EXPORT_RPC_FUNCTIONS = {
  getManifest: "technical_configuration_result_export_manifest_get",
  listRanking: "technical_configuration_result_export_ranking_list",
  listMatrix: "technical_configuration_result_export_matrix_list",
  listOptionAxis: "technical_configuration_result_export_option_axis_list",
  listCriterionAxis: "technical_configuration_result_export_criterion_axis_list",
} as const

/** Ordered P14 result-export RPC names for allowlists and contract iteration. */
export const RESULT_EXPORT_RPC_FUNCTION_NAMES = Object.values(RESULT_EXPORT_RPC_FUNCTIONS)
