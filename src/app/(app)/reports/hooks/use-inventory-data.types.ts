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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getDateOnly(value: unknown): string | undefined {
  const raw = toStringValue(value)
  return raw ? raw.split('T')[0] : undefined
}

function getErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Error) {
    return value.message
  }

  if (!isRecord(value)) {
    return undefined
  }

  return toStringValue(value.message)
}

function isWithinDateRange(value: unknown, fromDate: string, toDate: string): boolean {
  const dateOnly = getDateOnly(value)
  return !!dateOnly && dateOnly >= fromDate && dateOnly <= toDate
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
      if (row.trang_thai !== 'hoan_thanh' || !isWithinDateRange(row.ngay_hoan_thanh, fromDate, toDate)) {
        continue
      }

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
  const message = getErrorMessage(error)?.toLowerCase() ?? ''
  return message.includes('404') || message.includes('not found')
}
