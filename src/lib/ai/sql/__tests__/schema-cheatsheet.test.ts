import { Buffer } from 'node:buffer'

import { describe, expect, it } from 'vitest'

import {
  AI_READONLY_FORBIDDEN_REFERENCES,
  AI_READONLY_SCHEMA,
  AI_READONLY_VIEW_NAMES,
  QUERY_DATABASE_TOOL_DESCRIPTION,
} from '../schema-cheatsheet'

describe('query_database schema cheatsheet contract', () => {
  it('exports the canonical ai_readonly view names', () => {
    expect(AI_READONLY_VIEW_NAMES).toEqual([
      'equipment_search',
      'maintenance_facts',
      'repair_facts',
      'usage_facts',
      'quota_facts',
    ])
  })

  it('keeps the expected live columns for each ai_readonly view', () => {
    expect(AI_READONLY_SCHEMA.equipment_search).toEqual([
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
    ])
    expect(AI_READONLY_SCHEMA.maintenance_facts).toEqual([
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
    ])
    expect(AI_READONLY_SCHEMA.repair_facts).toEqual([
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
    ])
    expect(AI_READONLY_SCHEMA.usage_facts).toEqual([
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
    ])
    expect(AI_READONLY_SCHEMA.quota_facts).toEqual([
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
    ])
  })

  it('embeds every view name and the canonical department column in the description', () => {
    for (const viewName of AI_READONLY_VIEW_NAMES) {
      expect(QUERY_DATABASE_TOOL_DESCRIPTION).toContain(`ai_readonly.${viewName}`)
    }

    expect(QUERY_DATABASE_TOOL_DESCRIPTION).toContain('khoa_phong_quan_ly')
  })

  it('includes the explicit forbidden raw-schema references', () => {
    expect(AI_READONLY_FORBIDDEN_REFERENCES).toEqual([
      'thiet_bi',
      'khoa_phong',
      'public.*',
      'auth.*',
      'pg_catalog.*',
      'set_config',
    ])

    for (const ref of AI_READONLY_FORBIDDEN_REFERENCES) {
      expect(QUERY_DATABASE_TOOL_DESCRIPTION).toContain(ref)
    }
  })

  it('contains two ai_readonly SELECT examples', () => {
    expect(QUERY_DATABASE_TOOL_DESCRIPTION).toContain(
      'SELECT khoa_phong_quan_ly, COUNT(*) AS so_luong FROM ai_readonly.equipment_search',
    )
    expect(QUERY_DATABASE_TOOL_DESCRIPTION).toContain(
      'SELECT ma_thiet_bi, ten_thiet_bi, ngay_bt_tiep_theo FROM ai_readonly.equipment_search',
    )
  })

  it('stays within the documented byte budget', () => {
    expect(Buffer.byteLength(QUERY_DATABASE_TOOL_DESCRIPTION, 'utf8')).toBeLessThanOrEqual(2600)
  })
})
