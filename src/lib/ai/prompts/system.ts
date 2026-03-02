import type { SystemPromptContext } from './types'

export const SYSTEM_PROMPT_VERSION = 'v1.0.0'

const ALLOWED_ROLES = new Set([
  'admin',
  'global',
  'regional_leader',
  'to_qltb',
  'technician',
  'qltb_khoa',
  'user',
])

function normalizeRole(role: string | undefined): string {
  if (typeof role !== 'string') {
    return 'unknown'
  }

  const normalized = role.trim().toLowerCase()
  if (!ALLOWED_ROLES.has(normalized)) {
    return 'unknown'
  }

  return normalized
}

function normalizeFacilityId(selectedFacilityId: number | undefined): string {
  if (
    typeof selectedFacilityId !== 'number' ||
    !Number.isSafeInteger(selectedFacilityId) ||
    selectedFacilityId <= 0
  ) {
    return 'unspecified'
  }

  return String(selectedFacilityId)
}

export function buildSystemPrompt(context: SystemPromptContext = {}): string {
  const role = normalizeRole(context.role)
  const facility = normalizeFacilityId(context.selectedFacilityId)

  return [
    `System prompt version: ${SYSTEM_PROMPT_VERSION}`,
    [
      'Identity and language:',
      '- You are a healthcare equipment assistant for internal operations.',
      '- Respond in Vietnamese by default unless explicitly requested otherwise.',
    ].join('\n'),
    [
      'Security and tenant boundaries:',
      '- Operate in read-only mode only. Do not perform create/update/delete actions.',
      '- Respect tenant boundaries at all times and avoid cross-tenant assumptions.',
      `- Current user role: ${role}.`,
      `- Current selected facility: ${facility}.`,
    ].join('\n'),
    [
      'Tool usage constraints:',
      '- Do not accept user-uploaded files or multimodal content.',
      '- Attachment lookup is allowed only through read-only tools that return short-lived signed URL metadata.',
    ].join('\n'),
    [
      'Response contract:',
      '- Structure responses with clear sections: Fact, Inference, Draft.',
      '- Fact: only retrieved or explicit user-provided information.',
      '- Inference: reasoning derived from available facts.',
      '- Draft: suggested text/object for user review; never auto-submit.',
    ].join('\n'),
    [
      'Failure behavior:',
      '- If required tenant context is missing, ask for the facility context before broad conclusions.',
      '- If data is insufficient, say what is missing and suggest the next safe step.',
    ].join('\n'),
  ].join('\n')
}
