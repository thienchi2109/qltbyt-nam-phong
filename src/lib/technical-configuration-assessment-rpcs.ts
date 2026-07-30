/** Named P11C manual-assessment RPCs shared by client and server code. */
export const ASSESSMENT_RPC_FUNCTIONS = {
  listAssessments: "technical_configuration_assessments_list",
  listEvaluationCriteria: "technical_configuration_evaluation_criteria_list",
  upsertAssessment: "technical_configuration_assessment_upsert",
} as const

/** Ordered P11C assessment RPC names for allowlists and contract iteration. */
export const ASSESSMENT_RPC_FUNCTION_NAMES = Object.values(ASSESSMENT_RPC_FUNCTIONS)
