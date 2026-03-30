import { describe, expect, it } from 'vitest'

import {
  buildRepairRequestCreateIntentHref,
  buildRepairRequestsByEquipmentHref,
} from '../repair-request-create-intent'

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
