import { describe, expect, it } from 'vitest'
import {
  isRpcNotFoundError,
  mapDepartmentNames,
  mapExportedInventoryItems,
  mapFacilityIds,
  mapImportedInventoryItems,
  mapInventorySummary,
} from '../use-inventory-data.types'

describe('use-inventory-data.types', () => {
  it('maps facility ids from unknown payloads', () => {
    expect(
      mapFacilityIds([
        { id: 1 },
        { id: '2' },
        { id: null },
        { name: 'ignored' },
      ])
    ).toEqual([1, 2])
  })

  it('normalizes inventory summary with zero fallbacks', () => {
    expect(mapInventorySummary({ totalImported: 4, currentStock: '6' })).toEqual({
      totalImported: 4,
      totalExported: 0,
      currentStock: 6,
      netChange: 0,
    })
  })

  it('maps department names from mixed rows', () => {
    expect(
      mapDepartmentNames([
        { name: 'Khoa Noi' },
        { name: '' },
        { name: null },
        { label: 'ignored' },
      ])
    ).toEqual(['Khoa Noi'])
  })

  it('maps imported equipment rows inside the selected date range', () => {
    expect(
      mapImportedInventoryItems(
        [
          {
            id: 1,
            ma_thiet_bi: 'EQ-001',
            ten_thiet_bi: 'May Sieu Am',
            model: null,
            serial: 'SER-1',
            khoa_phong_quan_ly: 'Khoa Noi',
            created_at: '2026-03-10T10:00:00.000Z',
            nguon_nhap: 'excel',
            gia_goc: 1200000,
          },
          {
            id: 2,
            ma_thiet_bi: 'EQ-002',
            ten_thiet_bi: 'Ngoai range',
            created_at: '2026-02-28T10:00:00.000Z',
          },
        ],
        '2026-03-01',
        '2026-03-31'
      )
    ).toEqual([
      {
        id: 1,
        ma_thiet_bi: 'EQ-001',
        ten_thiet_bi: 'May Sieu Am',
        model: undefined,
        serial: 'SER-1',
        khoa_phong_quan_ly: 'Khoa Noi',
        ngay_nhap: '2026-03-10T10:00:00.000Z',
        created_at: '2026-03-10T10:00:00.000Z',
        type: 'import',
        source: 'excel',
        quantity: 1,
        value: 1200000,
      },
    ])
  })

  it('maps transfer and liquidation rows to exported inventory items', () => {
    expect(
      mapExportedInventoryItems(
        [
          {
            id: 11,
            loai_hinh: 'noi_bo',
            ngay_ban_giao: '2026-03-12T09:00:00.000Z',
            created_at: '2026-03-01T09:00:00.000Z',
            ly_do_luan_chuyen: 'Dieu chuyen noi bo',
            khoa_phong_nhan: 'Khoa Ngoai',
            thiet_bi: {
              ma_thiet_bi: 'EQ-010',
              ten_thiet_bi: 'Monitor',
              model: 'M1',
              serial: 'SER-10',
              khoa_phong_quan_ly: 'Khoa Noi',
            },
          },
          {
            id: 12,
            loai_hinh: 'thanh_ly',
            trang_thai: 'hoan_thanh',
            ngay_hoan_thanh: '2026-03-15T09:00:00.000Z',
            created_at: '2026-03-05T09:00:00.000Z',
            ly_do_luan_chuyen: 'Hong',
            thiet_bi: {
              ma_thiet_bi: 'EQ-011',
              ten_thiet_bi: 'Pump',
              model: null,
              serial: null,
              khoa_phong_quan_ly: 'Khoa Hoi suc',
            },
          },
        ],
        '2026-03-01',
        '2026-03-31'
      )
    ).toEqual([
      {
        id: 11,
        ma_thiet_bi: 'EQ-010',
        ten_thiet_bi: 'Monitor',
        model: 'M1',
        serial: 'SER-10',
        khoa_phong_quan_ly: 'Khoa Noi',
        ngay_nhap: '2026-03-12T09:00:00.000Z',
        created_at: '2026-03-01T09:00:00.000Z',
        type: 'export',
        source: 'transfer_internal',
        quantity: 1,
        reason: 'Dieu chuyen noi bo',
        destination: 'Khoa Ngoai',
      },
      {
        id: 12,
        ma_thiet_bi: 'EQ-011',
        ten_thiet_bi: 'Pump',
        model: undefined,
        serial: undefined,
        khoa_phong_quan_ly: 'Khoa Hoi suc',
        ngay_nhap: '2026-03-15T09:00:00.000Z',
        created_at: '2026-03-05T09:00:00.000Z',
        type: 'export',
        source: 'liquidation',
        quantity: 1,
        reason: 'Hong',
        destination: 'Thanh lý',
      },
    ])
  })

  it('keeps pending liquidation rows on the transfer path when handover date is in range', () => {
    expect(
      mapExportedInventoryItems(
        [
          {
            id: 13,
            loai_hinh: 'thanh_ly',
            trang_thai: 'cho_duyet',
            ngay_ban_giao: '2026-03-18T09:00:00.000Z',
            ngay_hoan_thanh: null,
            created_at: '2026-03-10T09:00:00.000Z',
            ly_do_luan_chuyen: 'Thanh ly cho duyet',
            don_vi_nhan: 'Don vi xu ly',
            thiet_bi: {
              ma_thiet_bi: 'EQ-012',
              ten_thiet_bi: 'Ventilator',
              model: 'V1',
              serial: 'SER-12',
              khoa_phong_quan_ly: 'Khoa Cap cuu',
            },
          },
        ],
        '2026-03-01',
        '2026-03-31'
      )
    ).toEqual([
      {
        id: 13,
        ma_thiet_bi: 'EQ-012',
        ten_thiet_bi: 'Ventilator',
        model: 'V1',
        serial: 'SER-12',
        khoa_phong_quan_ly: 'Khoa Cap cuu',
        ngay_nhap: '2026-03-18T09:00:00.000Z',
        created_at: '2026-03-10T09:00:00.000Z',
        type: 'export',
        source: 'transfer_external',
        quantity: 1,
        reason: 'Thanh ly cho duyet',
        destination: 'Don vi xu ly',
      },
    ])
  })

  it('detects RPC not-found errors for empty-transfer fallback', () => {
    expect(isRpcNotFoundError(new Error('RPC transfer_request_list_enhanced failed (404)'))).toBe(true)
    expect(isRpcNotFoundError(new Error('Function not found'))).toBe(true)
    expect(isRpcNotFoundError({ message: 'RPC transfer_request_list_enhanced failed (404)' })).toBe(true)
    expect(isRpcNotFoundError('Function not found')).toBe(true)
    expect(isRpcNotFoundError(new Error('Permission denied'))).toBe(false)
  })
})
