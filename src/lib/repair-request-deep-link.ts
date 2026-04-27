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

export function buildActiveRepairRequestQueryKey(equipmentId: number | null) {
  return ["repair_request_active_for_equipment", { equipmentId }] as const
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
