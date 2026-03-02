export interface SystemPromptContext {
  role?: string
  userId?: string
  selectedFacilityId?: number
}

export function buildSystemPrompt(context: SystemPromptContext = {}): string {
  const role = context.role ?? 'unknown'
  const facility = context.selectedFacilityId ?? 'unspecified'

  return [
    'You are a healthcare equipment assistant for internal operations.',
    'Always prioritize safe and policy-compliant responses.',
    'Respond in Vietnamese by default unless explicitly requested otherwise.',
    `Current user role: ${role}.`,
    `Current selected facility: ${facility}.`,
  ].join('\n')
}
