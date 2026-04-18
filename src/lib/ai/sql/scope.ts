import { isGlobalRole, isPrivilegedRole, ROLES, type Role } from '@/lib/rbac'

const DEFAULT_FACILITY_REQUIRED_MESSAGE =
  'Anh/chị vui lòng chọn cơ sở y tế tại bộ lọc đơn vị trên thanh điều hướng (phía trên bên trái màn hình) trước khi sử dụng trợ lý tra cứu.'
const DEFAULT_UNRESOLVED_FACILITY_MESSAGE =
  'Unable to resolve facility context for tool execution.'

export type AssistantSqlFacilitySource = 'selected' | 'session'

export interface AssistantSqlScope {
  effectiveFacilityId: number
  facilitySource: AssistantSqlFacilitySource
  normalizedRole?: Role
  rawRole?: string
  requestedFacilityId?: number
  sessionFacilityId?: number
  userId: string
}

export interface ResolveAssistantScopeParams {
  facilityRequiredMessage?: string
  requireFacilityScope: boolean
  requestedFacilityId: number | undefined
  unresolvedFacilityMessage?: string
  user: Record<string, unknown>
}

export type AssistantScopeResolutionResult =
  | {
      ok: true
      assistantSqlScope: AssistantSqlScope | undefined
      promptUserId: string | undefined
      selectedFacilityId: number | undefined
      usageUserId: string
    }
  | {
      ok: false
      message: string
    }

function toFacilityId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }

    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function toUserId(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined
}

function normalizeAssistantRole(role: string | undefined): Role | undefined {
  if (role === undefined) {
    return undefined
  }

  const normalized = role.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  if (isGlobalRole(normalized)) {
    return ROLES.GLOBAL
  }

  if (Object.values(ROLES).includes(normalized as Role)) {
    return normalized as Role
  }

  return undefined
}

export function resolveAssistantScope({
  facilityRequiredMessage = DEFAULT_FACILITY_REQUIRED_MESSAGE,
  requireFacilityScope,
  requestedFacilityId,
  unresolvedFacilityMessage = DEFAULT_UNRESOLVED_FACILITY_MESSAGE,
  user,
}: ResolveAssistantScopeParams): AssistantScopeResolutionResult {
  const rawRole = typeof user.role === 'string' ? user.role : undefined
  const normalizedRole = normalizeAssistantRole(rawRole)
  const sessionFacilityId = toFacilityId(user.don_vi)
  const promptUserId = toUserId(user.id)
  const usageUserId = promptUserId ?? 'unknown-session'
  const privileged = isPrivilegedRole(rawRole)
  let selectedFacilityId = sessionFacilityId
  let facilitySource: AssistantSqlFacilitySource = 'session'

  if (privileged) {
    if (requireFacilityScope && requestedFacilityId === undefined) {
      return { ok: false, message: facilityRequiredMessage }
    }

    if (requestedFacilityId !== undefined) {
      selectedFacilityId = requestedFacilityId
      facilitySource = 'selected'
    }
  }

  if (requireFacilityScope && selectedFacilityId === undefined) {
    return { ok: false, message: unresolvedFacilityMessage }
  }

  const assistantSqlScope =
    selectedFacilityId === undefined
      ? undefined
      : {
          effectiveFacilityId: selectedFacilityId,
          facilitySource,
          normalizedRole,
          rawRole,
          requestedFacilityId,
          sessionFacilityId,
          userId: usageUserId,
        }

  return {
    ok: true,
    assistantSqlScope,
    promptUserId,
    selectedFacilityId,
    usageUserId,
  }
}
