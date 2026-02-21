import { describe, it, expect } from 'vitest'
import { buildStatusDonutData } from '@/components/equipment-distribution-summary.utils'

describe('buildStatusDonutData', () => {
  it('keeps only count > 0 and maps to donut shape', () => {
    const input = [
      { key: 'hoat_dong', label: 'Hoạt động', count: 8, percentage: 80, color: '#22c55e' },
      { key: 'cho_sua_chua', label: 'Chờ sửa chữa', count: 2, percentage: 20, color: '#ef4444' },
      { key: 'ngung_su_dung', label: 'Ngừng sử dụng', count: 0, percentage: 0, color: '#6b7280' },
    ]

    expect(buildStatusDonutData(input)).toEqual([
      { name: 'Hoạt động', value: 8, percent: 80, color: '#22c55e', key: 'hoat_dong' },
      { name: 'Chờ sửa chữa', value: 2, percent: 20, color: '#ef4444', key: 'cho_sua_chua' },
    ])
  })
})
