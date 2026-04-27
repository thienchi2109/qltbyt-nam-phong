export const REPAIR_REQUESTS_PATH = "/repair-requests"
export const REPAIR_REQUEST_CREATE_ACTION = "create"

function isValidEquipmentId(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

export function buildRepairRequestCreateIntentHref(equipmentId?: number | null) {
  const params = new URLSearchParams({
    action: REPAIR_REQUEST_CREATE_ACTION,
  })

  if (isValidEquipmentId(equipmentId)) {
    params.set("equipmentId", String(equipmentId))
  }

  return `${REPAIR_REQUESTS_PATH}?${params.toString()}`
}

export function buildRepairRequestsByEquipmentHref(equipmentId: number) {
  const params = new URLSearchParams()

  if (isValidEquipmentId(equipmentId)) {
    params.set("equipmentId", String(equipmentId))
  }

  return params.size
    ? `${REPAIR_REQUESTS_PATH}?${params.toString()}`
    : REPAIR_REQUESTS_PATH
}

export const REPAIR_REQUEST_VIEW_ACTION = "view"

/**
 * Canonical TanStack Query key for the active repair request resolver.
 *
 * Shape: `["repair", "active", equipmentId]`. The leading `"repair"` element
 * is intentional — it matches `repairKeys.all` from `@/hooks/use-cached-repair`
 * so that mutations invalidating `repairKeys.all` (create/update/assign/
 * complete/delete) automatically invalidate this query family by prefix.
 *
 * Do not change the leading prefix without updating `repairKeys.all` and the
 * invalidation contract test in `src/hooks/__tests__/use-cached-repair.invalidation.test.ts`.
 */
export function buildActiveRepairRequestQueryKey(equipmentId: number | null) {
  return ["repair", "active", equipmentId] as const
}

export function buildRepairRequestViewHref(requestId: number) {
  if (!isValidEquipmentId(requestId)) {
    return REPAIR_REQUESTS_PATH
  }

  const params = new URLSearchParams({
    action: REPAIR_REQUEST_VIEW_ACTION,
    requestId: String(requestId),
  })

  return `${REPAIR_REQUESTS_PATH}?${params.toString()}`
}
