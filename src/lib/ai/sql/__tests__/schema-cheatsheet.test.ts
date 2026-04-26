import { Buffer } from 'node:buffer'

import { describe, expect, it } from 'vitest'

import {
  AI_READONLY_FORBIDDEN_REFERENCES,
  AI_READONLY_SCHEMA,
  AI_READONLY_VIEW_NAMES,
  QUERY_DATABASE_TOOL_DESCRIPTION,
} from '../schema-cheatsheet'

const QUERY_DATABASE_TOOL_DESCRIPTION_BYTE_BUDGET = 3900

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
      'hang_san_xuat',
      'noi_san_xuat',
      'nam_san_xuat',
      'so_luu_hanh',
      'nguon_nhap',
      'nguon_kinh_phi',
      'gia_goc',
      'nam_tinh_hao_mon',
      'ty_le_hao_mon',
      'han_bao_hanh',
      'phan_loai_theo_nd98',
      'nhom_thiet_bi_id',
      'tinh_trang_hien_tai',
      'khoa_phong_quan_ly',
      'nguoi_dang_truc_tiep_quan_ly',
      'vi_tri_lap_dat',
      'chu_ky_bt_dinh_ky',
      'ngay_bt_tiep_theo',
      'chu_ky_hc_dinh_ky',
      'ngay_hc_tiep_theo',
      'chu_ky_kd_dinh_ky',
      'ngay_kd_tiep_theo',
      'ngay_nhap_raw',
      'ngay_nhap_date',
      'ngay_nhap_year',
      'ngay_nhap_month',
      'ngay_nhap_quarter',
      'ngay_dua_vao_su_dung_raw',
      'ngay_dua_vao_su_dung_date',
      'ngay_dua_vao_su_dung_year',
      'ngay_dua_vao_su_dung_month',
      'ngay_dua_vao_su_dung_quarter',
      'ngay_ngung_su_dung_raw',
      'ngay_ngung_su_dung_date',
      'ngay_ngung_su_dung_year',
      'ngay_ngung_su_dung_month',
      'ngay_ngung_su_dung_quarter',
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

  it('contains reporting-safe ai_readonly SELECT examples', () => {
    expect(QUERY_DATABASE_TOOL_DESCRIPTION).toContain(
      'SELECT nguoi_dang_truc_tiep_quan_ly, COUNT(*) AS so_luong FROM ai_readonly.equipment_search',
    )
    expect(QUERY_DATABASE_TOOL_DESCRIPTION).toContain(
      'SELECT khoa_phong_quan_ly, COUNT(*) AS so_luong FROM ai_readonly.equipment_search',
    )
    expect(QUERY_DATABASE_TOOL_DESCRIPTION).toContain(
      'SELECT ngay_dua_vao_su_dung_year, COUNT(*) AS so_luong FROM ai_readonly.equipment_search',
    )
  })

  it('maps personal-manager wording to the direct-manager column explicitly', () => {
    expect(QUERY_DATABASE_TOOL_DESCRIPTION).toContain(
      'use nguoi_dang_truc_tiep_quan_ly and do not substitute khoa_phong_quan_ly',
    )
    expect(QUERY_DATABASE_TOOL_DESCRIPTION).toContain(
      'Use khoa_phong_quan_ly only when the user explicitly asks for department, khoa, phong, or the managing unit.',
    )
  })

  it('stays within the documented byte budget', () => {
    // Wide reporting-safe grounding is allowed a slightly larger budget than the
    // original narrow surface, but still needs a hard cap for tool payload size.
    expect(Buffer.byteLength(QUERY_DATABASE_TOOL_DESCRIPTION, 'utf8')).toBeLessThanOrEqual(
      QUERY_DATABASE_TOOL_DESCRIPTION_BYTE_BUDGET,
    )
  })
})
