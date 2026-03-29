import type { TaskType } from '@/lib/data'

export type MaintenanceKeyFilters = Record<string, unknown>

export interface MaintenancePlanListResponse {
  data: MaintenancePlan[]
  total: number
  page: number
  pageSize: number
}

export interface MaintenancePlan {
  id: number
  ten_ke_hoach: string
  nam: number
  loai_cong_viec: TaskType
  khoa_phong: string | null
  nguoi_lap_ke_hoach: string | null
  trang_thai: 'Bản nháp' | 'Đã duyệt' | 'Không duyệt'
  ngay_phe_duyet: string | null
  nguoi_duyet: string | null
  ly_do_khong_duyet: string | null
  created_at: string
  don_vi: number | null
  facility_name: string | null
}

export interface MaintenancePlanMutationInput {
  ten_ke_hoach: string
  nam: number
  loai_cong_viec: TaskType
  khoa_phong?: string | null
  nguoi_lap_ke_hoach?: string | null
}

export type MaintenanceScheduleFilters = MaintenanceKeyFilters & {
  search?: string
  phong_ban?: string
  trang_thai?: string
  loai_bao_tri?: string
  dateFrom?: string
  dateTo?: string
}

export type MaintenanceHistoryFilters = MaintenanceKeyFilters & {
  thiet_bi_id?: string
  dateFrom?: string
  dateTo?: string
}
