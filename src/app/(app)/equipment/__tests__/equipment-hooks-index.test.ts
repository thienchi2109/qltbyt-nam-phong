import * as EquipmentHooks from '@/app/(app)/equipment/_hooks'

describe('equipment hooks barrel public API', () => {
  it.each([
    'useEquipmentAuth',
    'useEquipmentFilters',
    'useEquipmentData',
    'useEquipmentTable',
    'useEquipmentExport',
    'useEquipmentRouteSync',
    'useEquipmentContext',
  ])('does not expose %s', (name) => {
    expect(name in EquipmentHooks).toBe(false)
  })
})
