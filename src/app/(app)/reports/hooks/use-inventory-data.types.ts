import { getUnknownErrorMessage } from '@/lib/error-utils'
import { isRecord, toNumber, toStringValue, isWithinDateRange } from '@/lib/rpc-normalize'

/** Row shape returned by get_facilities_with_equipment_count */
export interface FacilityRow {
  id: number
  [key: string]: unknown
}

/** Row shape returned by equipment_aggregates_for_reports */
export interface EquipmentAggregateRow {
  totalImported?: number
  totalExported?: number
  currentStock?: number
  netChange?: number
  [key: string]: unknown
}

/** Row shape returned by departments_list_for_facilities / departments_list_for_tenant */
export interface DepartmentRow {
  name: string
  [key: string]: unknown
}

/** Row shape returned by equipment_list_for_reports */
export interface EquipmentReportRow {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  model?: string
  serial?: string
  khoa_phong_quan_ly?: string
  created_at: string
  nguon_nhap?: string
  gia_goc?: number
  [key: string]: unknown
}

/** Row shape returned by transfer_request_list_enhanced */
export interface TransferReportRow {
  id: number
  loai_hinh: string
  trang_thai?: string
  created_at: string
  ngay_ban_giao?: string
  ngay_hoan_thanh?: string
  ly_do_luan_chuyen?: string
  khoa_phong_nhan?: string
  don_vi_nhan?: string
  thiet_bi: {
    ma_thiet_bi: string
    ten_thiet_bi: string
    model?: string
    serial?: string
    khoa_phong_quan_ly?: string
  }
  [key: string]: unknown
}

/** Typed filter interface for inventory query keys */
export interface InventoryDataFilters {
  dateRange: { from: string; to: string }
  selectedDepartment: string
  searchTerm: string
  tenant: string
  isMultiFacility: boolean
}


export interface InventoryItem {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  model?: string
  serial?: string
  khoa_phong_quan_ly?: string
  ngay_nhap: string
  created_at: string
  type: 'import' | 'export'
  source: 'manual' | 'excel' | 'transfer_internal' | 'transfer_external' | 'liquidation'
  quantity: number
  value?: number
  reason?: string
  destination?: string
}

export interface InventorySummary {
  totalImported: number
  totalExported: number
  currentStock: number
  netChange: number
}

export function mapFacilityIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((row) => {
    if (!isRecord(row)) {
      return []
    }

    const id = toNumber(row.id)
    return id === undefined ? [] : [id]
  })
}

export function mapInventorySummary(value: unknown): InventorySummary {
  const row = isRecord(value) ? value : {}

  return {
    totalImported: toNumber(row.totalImported) ?? 0,
    totalExported: toNumber(row.totalExported) ?? 0,
    currentStock: toNumber(row.currentStock) ?? 0,
    netChange: toNumber(row.netChange) ?? 0,
  }
}

export function mapDepartmentNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((row) => {
    if (!isRecord(row)) {
      return []
    }

    const name = toStringValue(row.name)?.trim()
    return name ? [name] : []
  })
}

export function mapImportedInventoryItems(
  value: unknown,
  fromDate: string,
  toDate: string
): InventoryItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((row) => {
    if (!isRecord(row) || !isWithinDateRange(row.created_at, fromDate, toDate)) {
      return []
    }

    const id = toNumber(row.id)
    const maThietBi = toStringValue(row.ma_thiet_bi)
    const tenThietBi = toStringValue(row.ten_thiet_bi)
    const createdAt = toStringValue(row.created_at)

    if (id === undefined || !maThietBi || !tenThietBi || !createdAt) {
      return []
    }

    return [
      {
        id,
        ma_thiet_bi: maThietBi,
        ten_thiet_bi: tenThietBi,
        model: toStringValue(row.model),
        serial: toStringValue(row.serial),
        khoa_phong_quan_ly: toStringValue(row.khoa_phong_quan_ly),
        ngay_nhap: createdAt,
        created_at: createdAt,
        type: 'import',
        source: row.nguon_nhap === 'excel' ? 'excel' : 'manual',
        quantity: 1,
        value: toNumber(row.gia_goc),
      },
    ]
  })
}

export function mapExportedInventoryItems(
  value: unknown,
  fromDate: string,
  toDate: string
): InventoryItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  const items: InventoryItem[] = []

  for (const row of value) {
    if (!isRecord(row) || !isRecord(row.thiet_bi)) {
      continue
    }

    const equipment = row.thiet_bi
    const id = toNumber(row.id)
    const maThietBi = toStringValue(equipment.ma_thiet_bi)
    const tenThietBi = toStringValue(equipment.ten_thiet_bi)
    const createdAt = toStringValue(row.created_at)

    if (id === undefined || !maThietBi || !tenThietBi || !createdAt) {
      continue
    }

    const baseItem = {
      id,
      ma_thiet_bi: maThietBi,
      ten_thiet_bi: tenThietBi,
      model: toStringValue(equipment.model),
      serial: toStringValue(equipment.serial),
      khoa_phong_quan_ly: toStringValue(equipment.khoa_phong_quan_ly),
      created_at: createdAt,
      type: 'export' as const,
      quantity: 1,
      reason: toStringValue(row.ly_do_luan_chuyen),
    }

    if (row.loai_hinh === 'thanh_ly') {
      if (row.trang_thai === 'hoan_thanh') {
        if (isWithinDateRange(row.ngay_hoan_thanh, fromDate, toDate)) {
          const completedAt = toStringValue(row.ngay_hoan_thanh)
          if (!completedAt) {
            continue
          }

          items.push({
            ...baseItem,
            ngay_nhap: completedAt,
            source: 'liquidation',
            destination: 'Thanh lý',
          })
        }

        continue
      }

      if (isWithinDateRange(row.ngay_ban_giao, fromDate, toDate)) {
        const handedOverAt = toStringValue(row.ngay_ban_giao)
        if (!handedOverAt) {
          continue
        }

        items.push({
          ...baseItem,
          ngay_nhap: handedOverAt,
          source: 'liquidation',
          destination: 'Thanh lý',
        })
      }

      continue
    }

    if (!isWithinDateRange(row.ngay_ban_giao, fromDate, toDate)) {
      continue
    }

    const handedOverAt = toStringValue(row.ngay_ban_giao)
    if (!handedOverAt) {
      continue
    }

    const isInternalTransfer = row.loai_hinh === 'noi_bo'

    items.push({
      ...baseItem,
      ngay_nhap: handedOverAt,
      source: isInternalTransfer ? 'transfer_internal' : 'transfer_external',
      destination: isInternalTransfer
        ? toStringValue(row.khoa_phong_nhan)
        : toStringValue(row.don_vi_nhan),
    })
  }

  return items
}

export function isRpcNotFoundError(error: unknown): boolean {
  const message = getUnknownErrorMessage(error).toLowerCase()
  return message.includes('404') || message.includes('not found')
}
