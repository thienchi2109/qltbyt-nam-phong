import { describe, expect, it } from 'vitest'

import {
  REPAIR_REQUESTS_PATH,
  REPAIR_REQUEST_VIEW_ACTION,
  buildActiveRepairRequestQueryKey,
  buildRepairRequestCreateIntentHref,
  buildRepairRequestViewHref,
  buildRepairRequestsByEquipmentHref,
} from '../repair-request-deep-link'

describe('buildRepairRequestCreateIntentHref', () => {
  it('builds the canonical create-intent href without an equipment id', () => {
    expect(buildRepairRequestCreateIntentHref()).toBe(
      '/repair-requests?action=create',
    )
  })

  it('appends a numeric equipment id when provided', () => {
    expect(buildRepairRequestCreateIntentHref(42)).toBe(
      '/repair-requests?action=create&equipmentId=42',
    )
  })
})

describe('buildRepairRequestsByEquipmentHref', () => {
  it('builds the equipment-filtered repair requests href without create intent', () => {
    expect(buildRepairRequestsByEquipmentHref(42)).toBe(
      '/repair-requests?equipmentId=42',
    )
  })
})

describe('repair-request-deep-link :: active resolver query key', () => {
  it('returns a stable tuple keyed by equipmentId', () => {
    expect(buildActiveRepairRequestQueryKey(7)).toEqual([
      'repair_request_active_for_equipment',
      { equipmentId: 7 },
    ])
  })

  it('encodes a null equipmentId verbatim so callers can disable the query without losing key shape', () => {
    expect(buildActiveRepairRequestQueryKey(null)).toEqual([
      'repair_request_active_for_equipment',
      { equipmentId: null },
    ])
  })
})

describe('repair-request-deep-link :: view-sheet href', () => {
  it('uses the canonical action constant and stringifies the requestId', () => {
    expect(REPAIR_REQUEST_VIEW_ACTION).toBe('view')
    expect(buildRepairRequestViewHref(42)).toBe(
      `${REPAIR_REQUESTS_PATH}?action=view&requestId=42`,
    )
  })

  it('rejects non-positive integer requestIds by falling back to the list path', () => {
    expect(buildRepairRequestViewHref(0)).toBe(REPAIR_REQUESTS_PATH)
    expect(buildRepairRequestViewHref(-1)).toBe(REPAIR_REQUESTS_PATH)
    expect(buildRepairRequestViewHref(Number.NaN)).toBe(REPAIR_REQUESTS_PATH)
  })
})
