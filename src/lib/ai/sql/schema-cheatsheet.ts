type AiReadonlyViewName =
  | 'equipment_search'
  | 'maintenance_facts'
  | 'repair_facts'
  | 'usage_facts'
  | 'quota_facts'

type AiReadonlySchema = Record<AiReadonlyViewName, readonly string[]>

export const AI_READONLY_SCHEMA: AiReadonlySchema = {
  equipment_search: [
    'equipment_id',
    'ma_thiet_bi',
    'ten_thiet_bi',
    'model',
    'serial',
    'so_luu_hanh',
    'phan_loai_theo_nd98',
    'nhom_thiet_bi_id',
    'tinh_trang_hien_tai',
    'khoa_phong_quan_ly',
    'vi_tri_lap_dat',
    'ngay_bt_tiep_theo',
    'ngay_hc_tiep_theo',
    'ngay_kd_tiep_theo',
    'facility_id',
    'facility_code',
    'facility_name',
    'created_at',
  ],
  maintenance_facts: [
    'maintenance_task_id',
    'maintenance_plan_id',
    'equipment_id',
    'loai_cong_viec',
    'don_vi_thuc_hien',
    'diem_hieu_chuan',
    'task_notes',
    'ten_ke_hoach',
    'plan_year',
    'plan_status',
    'ngay_phe_duyet',
    'plan_facility_id',
    'ma_thiet_bi',
    'ten_thiet_bi',
    'model',
    'khoa_phong_quan_ly',
    'tinh_trang_hien_tai',
    'facility_id',
  ],
  repair_facts: [
    'repair_request_id',
    'equipment_id',
    'repair_status',
    'mo_ta_su_co',
    'hang_muc_sua_chua',
    'ngay_yeu_cau',
    'ngay_duyet',
    'ngay_hoan_thanh',
    'don_vi_thuc_hien',
    'ten_don_vi_thue',
    'chi_phi_sua_chua',
    'ma_thiet_bi',
    'ten_thiet_bi',
    'model',
    'khoa_phong_quan_ly',
    'facility_id',
    'facility_name',
  ],
  usage_facts: [
    'usage_log_id',
    'equipment_id',
    'thoi_gian_bat_dau',
    'thoi_gian_ket_thuc',
    'trang_thai',
    'tinh_trang_thiet_bi',
    'tinh_trang_ban_dau',
    'tinh_trang_ket_thuc',
    'ghi_chu',
    'duration_hours',
    'ma_thiet_bi',
    'ten_thiet_bi',
    'model',
    'khoa_phong_quan_ly',
    'facility_id',
  ],
  quota_facts: [
    'equipment_id',
    'ma_thiet_bi',
    'ten_thiet_bi',
    'model',
    'category_id',
    'category_code',
    'category_name',
    'facility_id',
    'facility_name',
    'decision_id',
    'so_quyet_dinh',
    'decision_status',
    'ngay_hieu_luc',
    'so_luong_toi_thieu',
    'so_luong_toi_da',
    'category_device_count',
    'quota_status',
    'remaining_quota',
  ],
}

export const AI_READONLY_VIEW_NAMES = Object.keys(
  AI_READONLY_SCHEMA,
) as AiReadonlyViewName[]

export const AI_READONLY_FORBIDDEN_REFERENCES = [
  'thiet_bi',
  'khoa_phong',
  'public.*',
  'auth.*',
  'pg_catalog.*',
  'set_config',
] as const

function formatSchemaSurface(): string {
  return AI_READONLY_VIEW_NAMES.map(
    viewName =>
      `ai_readonly.${viewName}(${AI_READONLY_SCHEMA[viewName].join(', ')})`,
  ).join('; ')
}

export const QUERY_DATABASE_TOOL_DESCRIPTION = [
  'Run exactly one read-only SQL SELECT on the ai_readonly semantic layer.',
  'Scope is already injected for one facility, so do not call set_config and do not assume cross-facility access.',
  `Allowed relations: ${formatSchemaSurface()}.`,
  'Department/khoa is the text column khoa_phong_quan_ly on these views; there is no separate khoa_phong table in ai_readonly.',
  `Never use raw relations or schemas: ${AI_READONLY_FORBIDDEN_REFERENCES.join(', ')}.`,
  'Example 1: SELECT khoa_phong_quan_ly, COUNT(*) AS so_luong FROM ai_readonly.equipment_search GROUP BY khoa_phong_quan_ly ORDER BY so_luong DESC;',
  'Example 2: SELECT ma_thiet_bi, ten_thiet_bi, ngay_bt_tiep_theo FROM ai_readonly.equipment_search WHERE ngay_bt_tiep_theo < CURRENT_DATE ORDER BY ngay_bt_tiep_theo;',
].join(' ')

export const QUERY_DATABASE_PROMPT_POINTER = [
  `Khi dùng \`query_database\`: chỉ viết đúng một câu \`SELECT\` trên các view ${AI_READONLY_VIEW_NAMES.join(', ')}.`,
  'Khoa/phòng nằm ở cột `khoa_phong_quan_ly`.',
  `KHÔNG dùng raw schema/tên như ${AI_READONLY_FORBIDDEN_REFERENCES.join(', ')}.`,
].join(' ')
