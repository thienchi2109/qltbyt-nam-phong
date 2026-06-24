import { describe, expect, it } from 'vitest'

import {
  buildDepartmentColorClassByLabel,
  getEquipmentDepartmentLabel,
  UNKNOWN_DEPARTMENT_LABEL,
} from '../equipment-department-grouping'

describe('equipment-department-grouping', () => {
  it('normalizes empty department labels', () => {
    expect(getEquipmentDepartmentLabel(null)).toBe(UNKNOWN_DEPARTMENT_LABEL)
    expect(getEquipmentDepartmentLabel('   ')).toBe(UNKNOWN_DEPARTMENT_LABEL)
  })

  it('keeps color assignment stable when distribution order changes', () => {
    const first = buildDepartmentColorClassByLabel([
      { label: 'Khoa Ngoại' },
      { label: 'Khoa Nội' },
    ])
    const second = buildDepartmentColorClassByLabel([
      { label: 'Khoa Nội' },
      { label: 'Khoa Ngoại' },
    ])

    expect(second['Khoa Ngoại']).toBe(first['Khoa Ngoại'])
    expect(second['Khoa Nội']).toBe(first['Khoa Nội'])
  })
})
