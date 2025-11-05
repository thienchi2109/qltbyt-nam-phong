export interface LegacyTransferItem {
  id: number
  ma_yeu_cau: string
  thiet_bi_id: number
  loai_hinh: string
  trang_thai: string
  nguoi_yeu_cau_id: number | null
  ly_do_luan_chuyen: string | null
  khoa_phong_hien_tai: string | null
  khoa_phong_nhan: string | null
  muc_dich: string | null
  don_vi_nhan: string | null
  dia_chi_don_vi: string | null
  nguoi_lien_he: string | null
  so_dien_thoai: string | null
  ngay_du_kien_tra: string | null
  ngay_ban_giao: string | null
  ngay_hoan_tra: string | null
  ngay_hoan_thanh: string | null
  nguoi_duyet_id: number | null
  ngay_duyet: string | null
  ghi_chu_duyet: string | null
  created_at: string
  updated_at: string | null
  created_by: number | null
  updated_by: number | null
  thiet_bi: {
    ten_thiet_bi: string | null
    ma_thiet_bi: string | null
    model: string | null
    serial: string | null
    khoa_phong_quan_ly: string | null
    facility_name?: string | null
    facility_id?: number | null
  } | null
}

export interface LegacyFilterParams {
  q: string | null
  statuses: string[] | null
  types: string[] | null
  facilityId: number | null
  dateFrom: string | null
  dateTo: string | null
  assigneeIds: number[] | null
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export const ALLOWED_STATUSES = [
  "cho_duyet",
  "da_duyet",
  "dang_luan_chuyen",
  "da_ban_giao",
  "hoan_thanh",
] as const

export const ALLOWED_TYPES = ["noi_bo", "ben_ngoai", "thanh_ly"] as const

export const sanitizeStatuses = (values: string[] | null) => {
  if (!values) return null
  const allowed = ALLOWED_STATUSES as readonly string[]
  const filtered = values.filter((value): value is typeof ALLOWED_STATUSES[number] => allowed.includes(value))
  return filtered.length > 0 ? filtered : null
}

export const sanitizeTypes = (values: string[] | null) => {
  if (!values) return null
  const allowed = ALLOWED_TYPES as readonly string[]
  const filtered = values.filter((value): value is typeof ALLOWED_TYPES[number] => allowed.includes(value))
  return filtered.length > 0 ? filtered : null
}

type LegacyRpcError = {
  error?: {
    code?: string
  }
}

const parseIsoDate = (value: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const matchesStringArrayFilter = (value: string | null | undefined, filters: string[] | null) => {
  if (!filters || filters.length === 0) return true
  if (!value) return false
  return filters.includes(value)
}

const matchesDateRange = (createdAt: string, dateFrom: string | null, dateTo: string | null) => {
  const createdDate = parseIsoDate(createdAt)
  if (!createdDate) return false

  if (dateFrom) {
    const start = parseIsoDate(dateFrom)
    if (start && createdDate < start) return false
  }

  if (dateTo) {
    const end = parseIsoDate(`${dateTo}T23:59:59.999Z`)
    if (end && createdDate > end) return false
  }

  return true
}

const matchesFacility = (item: LegacyTransferItem, facilityId: number | null) => {
  if (!facilityId) return true
  const facility = item.thiet_bi?.facility_id
  return facility === facilityId
}

const matchesSearch = (item: LegacyTransferItem, q: string | null) => {
  if (!q || q.trim() === "") return true
  const normalized = q.trim().toLowerCase()
  const haystack = [
    item.ma_yeu_cau,
    item.ly_do_luan_chuyen,
    item.thiet_bi?.ten_thiet_bi,
    item.thiet_bi?.ma_thiet_bi,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
  return haystack.some((value) => value.includes(normalized))
}

const matchesAssignee = (item: LegacyTransferItem, assigneeIds: number[] | null) => {
  if (!assigneeIds || assigneeIds.length === 0) return true
  if (item.nguoi_yeu_cau_id == null) return false
  return assigneeIds.includes(item.nguoi_yeu_cau_id)
}

export const isMissingFunctionError = (status: number, payload: unknown) => {
  if (status !== 404) return false
  if (!payload || typeof payload !== "object") return false
  const maybe = payload as LegacyRpcError
  return maybe.error?.code === "PGRST202"
}

export const transformLegacyItem = (item: LegacyTransferItem) => ({
  ...item,
  ly_do_luan_chuyen: item.ly_do_luan_chuyen ?? "",
  thiet_bi: item.thiet_bi
    ? {
        ...item.thiet_bi,
        facility_id: item.thiet_bi.facility_id ?? null,
        facility_name: item.thiet_bi.facility_name ?? null,
      }
    : null,
})

export const applyLegacyFilters = (data: LegacyTransferItem[], filters: LegacyFilterParams) => {
  return data.filter((item) => {
    if (!matchesStringArrayFilter(item.trang_thai, filters.statuses)) return false
    if (!matchesStringArrayFilter(item.loai_hinh, filters.types)) return false
    if (!matchesFacility(item, filters.facilityId)) return false
    if (!matchesDateRange(item.created_at, filters.dateFrom, filters.dateTo)) return false
    if (!matchesAssignee(item, filters.assigneeIds)) return false
    if (!matchesSearch(item, filters.q)) return false
    return true
  })
}

export const paginate = <T,>(items: T[], page: number, pageSize: number): PaginatedResult<T> => {
  const safePageSize = Math.max(1, pageSize)
  const safePage = Math.max(1, page)
  const offset = (safePage - 1) * safePageSize
  const sliced = items.slice(offset, offset + safePageSize)
  return {
    data: sliced,
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
  }
}

export const buildCountsFromItems = (items: LegacyTransferItem[]) => {
  const counts = {
    cho_duyet: 0,
    da_duyet: 0,
    dang_luan_chuyen: 0,
    da_ban_giao: 0,
    hoan_thanh: 0,
  }

  for (const item of items) {
    if (item.trang_thai in counts) {
      counts[item.trang_thai as keyof typeof counts] += 1
    }
  }

  const totalCount = Object.values(counts).reduce((sum, value) => sum + value, 0)

  return {
    counts,
    totalCount,
  }
}
