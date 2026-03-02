export interface SystemPromptContext {
  role?: string
  userId?: string
  selectedFacilityId?: number
}

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
    'You are a healthcare equipment assistant for internal operations.',
    'Always prioritize safe and policy-compliant responses.',
    'Respond in Vietnamese by default unless explicitly requested otherwise.',
    `Current user role: ${role}.`,
    `Current selected facility: ${facility}.`,
  ].join('\n')
}
