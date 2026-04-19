export type AssistantSqlErrorCode =
  | 'audit_error'
  | 'configuration_error'
  | 'execution_error'
  | 'forbidden_function'
  | 'forbidden_keyword'
  | 'forbidden_schema'
  | 'invalid_statement'
  | 'payload_limit_exceeded'
  | 'row_limit_exceeded'
  | 'scope_required'
  | 'timeout'

export class AssistantSqlError extends Error {
  readonly code: AssistantSqlErrorCode

  constructor(code: AssistantSqlErrorCode, message: string) {
    super(message)
    this.name = 'AssistantSqlError'
    this.code = code
  }
}

export function isAssistantSqlError(error: unknown): error is AssistantSqlError {
  return error instanceof AssistantSqlError
}
