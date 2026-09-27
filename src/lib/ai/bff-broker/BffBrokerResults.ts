import { z } from "zod"

import { BrokerRequestError, type BrokerRpc } from "./BffBrokerContracts"

const equipmentResultItem = z
  .object({
    id: z.number().int().positive().nullable().optional(),
    ma_thiet_bi: z.string().nullable().optional(),
    ten_thiet_bi: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    serial: z.string().nullable().optional(),
    so_luu_hanh: z.string().nullable().optional(),
    tinh_trang_hien_tai: z.string().nullable().optional(),
    khoa_phong_quan_ly: z.string().nullable().optional(),
    vi_tri_lap_dat: z.string().nullable().optional(),
    phan_loai_theo_nd98: z.string().nullable().optional(),
    ngay_bt_tiep_theo: z.string().nullable().optional(),
    ngay_hc_tiep_theo: z.string().nullable().optional(),
    ngay_kd_tiep_theo: z.string().nullable().optional(),
    don_vi: z.number().int().positive().nullable().optional(),
    facility_name: z.string().nullable().optional(),
  })
  .strict()

const appliedFilters = z
  .object({
    equipmentCode: z.string().optional(),
    status: z.string().optional(),
    department: z.string().optional(),
    location: z.string().optional(),
    classification: z.string().optional(),
    model: z.string().optional(),
    serial: z.string().optional(),
  })
  .partial()
  .strict()

const equipmentResult = z.union([
  z
    .object({
      data: z.array(equipmentResultItem).max(50),
      total: z.number().int().nonnegative(),
      limit: z.number().int().min(1).max(50),
      appliedFilters: appliedFilters.optional(),
    })
    .strict(),
  z.object({ error: z.string(), limit: z.number().int().min(1).max(50) }).strict(),
])

const maintenanceTask = z
  .object({
    task_id: z.number().int().positive().optional(),
    loai_cong_viec: z.string().nullable().optional(),
    don_vi_thuc_hien: z.string().nullable().optional(),
    plan_id: z.number().int().positive().nullable().optional(),
    ten_ke_hoach: z.string().nullable().optional(),
    nam: z.number().int().nullable().optional(),
    plan_status: z.string().nullable().optional(),
    ngay_phe_duyet: z.string().nullable().optional(),
    equipment_id: z.number().int().positive().nullable().optional(),
    ma_thiet_bi: z.string().nullable().optional(),
    ten_thiet_bi: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
  })
  .strict()

const maintenanceResult = z
  .object({
    totalTasks: z.number().int().nonnegative(),
    totalPlans: z.number().int().nonnegative(),
    statusCounts: z.record(z.number()),
    taskTypeCounts: z.record(z.number()),
    recentTasks: z.array(maintenanceTask).max(20),
    fromDate: z.string().nullable().optional(),
    toDate: z.string().nullable().optional(),
  })
  .strict()

const planResult = z
  .object({
    equipment: z
      .object({
        id: z.number().int().positive(),
        ma_thiet_bi: z.string(),
        ten_thiet_bi: z.string(),
        model: z.string().nullable().optional(),
        don_vi: z.number().int().positive().nullable().optional(),
      })
      .strict()
      .nullable(),
    plans: z
      .array(
        z
          .object({
            plan_id: z.number().int().positive(),
            ten_ke_hoach: z.string().nullable().optional(),
            nam: z.number().int().optional(),
            loai_cong_viec: z.string().nullable().optional(),
            plan_trang_thai: z.string().nullable().optional(),
            ngay_phe_duyet: z.string().nullable().optional(),
            task_id: z.number().int().positive().nullable().optional(),
            don_vi_thuc_hien: z.string().nullable().optional(),
            diem_hieu_chuan: z.number().nullable().optional(),
            thang_1: z.unknown().optional(),
            thang_2: z.unknown().optional(),
            thang_3: z.unknown().optional(),
            thang_4: z.unknown().optional(),
            thang_5: z.unknown().optional(),
            thang_6: z.unknown().optional(),
            thang_7: z.unknown().optional(),
            thang_8: z.unknown().optional(),
            thang_9: z.unknown().optional(),
            thang_10: z.unknown().optional(),
            thang_11: z.unknown().optional(),
            thang_12: z.unknown().optional(),
            thang_1_hoan_thanh: z.unknown().optional(),
            thang_2_hoan_thanh: z.unknown().optional(),
            thang_3_hoan_thanh: z.unknown().optional(),
            thang_4_hoan_thanh: z.unknown().optional(),
            thang_5_hoan_thanh: z.unknown().optional(),
            thang_6_hoan_thanh: z.unknown().optional(),
            thang_7_hoan_thanh: z.unknown().optional(),
            thang_8_hoan_thanh: z.unknown().optional(),
            thang_9_hoan_thanh: z.unknown().optional(),
            thang_10_hoan_thanh: z.unknown().optional(),
            thang_11_hoan_thanh: z.unknown().optional(),
            thang_12_hoan_thanh: z.unknown().optional(),
            ghi_chu: z.string().nullable().optional(),
            equipment_id: z.number().int().positive().optional(),
            ma_thiet_bi: z.string().optional(),
            ten_thiet_bi: z.string().optional(),
            model: z.string().nullable().optional(),
            don_vi: z.number().int().positive().nullable().optional(),
          })
          .strict()
      )
      .max(100),
    totalPlans: z.number().int().nonnegative(),
    yearFilter: z.number().int().nullable().optional(),
  })
  .strict()

const repairResult = z
  .object({
    totalRequests: z.number().int().nonnegative(),
    openRequests: z.number().int().nonnegative(),
    statusCounts: z.record(z.number()),
    recentRequests: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            thiet_bi_id: z.number().int().positive().nullable().optional(),
            ngay_yeu_cau: z.string().nullable().optional(),
            trang_thai: z.string().nullable().optional(),
            mo_ta_su_co: z.string().nullable().optional(),
            hang_muc_sua_chua: z.string().nullable().optional(),
            ngay_hoan_thanh: z.string().nullable().optional(),
            don_vi_thuc_hien: z.string().nullable().optional(),
            ten_don_vi_thue: z.string().nullable().optional(),
            ma_thiet_bi: z.string().nullable().optional(),
            ten_thiet_bi: z.string().nullable().optional(),
            model: z.string().nullable().optional(),
            khoa_phong_quan_ly: z.string().nullable().optional(),
            don_vi: z.number().int().positive().nullable().optional(),
            facility_name: z.string().nullable().optional(),
          })
          .strict()
      )
      .max(20),
    statusFilter: z.string().nullable().optional(),
  })
  .strict()

const conditionCounts = z
  .record(z.number())
  .refine((value) => Object.keys(value).length <= 100, "condition_counts exceeds 100 keys")

const usageResult = z.union([
  z
    .object({
      thiet_bi_id: z.number().int().positive(),
      total_sessions: z.number().int().nonnegative(),
      avg_duration_hours: z.number().nonnegative().nullable(),
      sessions_last_30_days: z.number().int().nonnegative(),
      sessions_last_90_days: z.number().int().nonnegative(),
      condition_counts: conditionCounts,
      earliest_session: z.string().nullable(),
      latest_session: z.string().nullable(),
      months_range: z.number().int().positive(),
      error: z.string().nullable().optional(),
    })
    .strict(),
  z.object({ error: z.string(), thiet_bi_id: z.number().int().positive() }).strict(),
])

const attachmentResult = z.union([
  z
    .object({
      kind: z.string(),
      thiet_bi_id: z.number().int().positive(),
      attachments: z
        .array(
          z
            .object({
              id: z.number().int().positive(),
              ten_file: z.string(),
              access_type: z.string(),
              url: z.string().nullable(),
              ngay_tai_len: z.string().nullable().optional(),
            })
            .strict()
        )
        .max(20),
      total_count: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ error: z.string(), thiet_bi_id: z.number().int().positive() }).strict(),
])

const deviceQuotaResult = z
  .object({
    kind: z.string().optional(),
    status: z.string().optional(),
    evidence_status: z.string().optional(),
    reason: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
    device: z
      .object({
        id: z.number().int().positive(),
        ma_thiet_bi: z.string(),
        ten_thiet_bi: z.string(),
      })
      .strict()
      .nullable()
      .optional(),
    scope: z
      .object({ mode: z.string(), don_vi_id: z.number().int().positive() })
      .strict()
      .nullable()
      .optional(),
    decision: z
      .object({
        id: z.number().int().positive(),
        so_quyet_dinh: z.string(),
        trang_thai: z.string(),
        ngay_hieu_luc: z.string(),
      })
      .strict()
      .nullable()
      .optional(),
    category: z
      .object({ id: z.number().int().positive(), ma_nhom: z.string(), ten_nhom: z.string() })
      .strict()
      .nullable()
      .optional(),
    quota: z
      .object({
        so_luong_toi_da: z.number().nonnegative(),
        so_luong_toi_thieu: z.number().nonnegative(),
        so_luong_hien_co: z.number().nonnegative(),
        remaining: z.number(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict()

const complianceResult = z
  .object({
    kind: z.string().optional(),
    scope: z
      .object({ mode: z.string(), don_vi_id: z.number().int().positive(), label: z.string() })
      .strict()
      .nullable()
      .optional(),
    decision: z
      .object({
        id: z.number().int().positive().nullable().optional(),
        so_quyet_dinh: z.string().nullable().optional(),
        trang_thai: z.string().nullable().optional(),
        ngay_hieu_luc: z.string().nullable().optional(),
      })
      .strict()
      .nullable()
      .optional(),
    summary: z
      .object({
        total_categories: z.number().int().nonnegative(),
        dat_count: z.number().int().nonnegative(),
        thieu_count: z.number().int().nonnegative(),
        vuot_count: z.number().int().nonnegative(),
        unmapped_equipment: z.number().int().nonnegative(),
      })
      .strict()
      .nullable()
      .optional(),
    evidence_status: z.string().optional(),
    suggested_follow_ups: z.array(z.string()).max(10).optional(),
    error: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
  })
  .strict()

const categoryResult = z
  .object({
    data: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            ma_nhom: z.string(),
            ten_nhom: z.string(),
            phan_loai: z.string().nullable().optional(),
            parent_name: z.string().nullable().optional(),
            match_reason: z.string().nullable().optional(),
          })
          .strict()
      )
      .max(10),
    total: z.number().int().nonnegative(),
  })
  .strict()

const departmentResult = z
  .object({
    data: z
      .array(z.object({ name: z.string(), equipment_count: z.number().nonnegative() }).strict())
      .max(50),
    total: z.number().int().nonnegative(),
  })
  .strict()

const auditResult = z.literal(true)
const reserveRow = z
  .object({
    allowed: z.boolean(),
    reservation_id: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
  })
  .strict()
const reserveResult = z.union([reserveRow, z.array(reserveRow).max(1)])
const finalizeResult = z.union([z.object({}).strict(), z.null()])
const killSwitchResult = z.union([
  z
    .object({
      enabled: z.boolean(),
      reason: z.string().nullable(),
      updated_at: z.string().nullable(),
    })
    .strict(),
  z
    .array(
      z
        .object({
          enabled: z.boolean(),
          reason: z.string().nullable(),
          updated_at: z.string().nullable(),
        })
        .strict()
    )
    .max(1),
])

const BROKER_RESULT_SCHEMAS: Readonly<Record<BrokerRpc, z.ZodType<unknown>>> = {
  ai_equipment_lookup: equipmentResult,
  ai_maintenance_summary: maintenanceResult,
  ai_maintenance_plan_lookup: planResult,
  ai_repair_summary: repairResult,
  ai_usage_summary: usageResult,
  ai_attachment_metadata: attachmentResult,
  ai_device_quota_lookup: deviceQuotaResult,
  ai_quota_compliance_summary: complianceResult,
  ai_category_suggestion: categoryResult,
  ai_department_list: departmentResult,
  assistant_query_database_audit_log: auditResult,
  ai_quota_reserve: reserveResult,
  ai_quota_finalize: finalizeResult,
  ai_kill_switch_status: killSwitchResult,
}

/** Validates an upstream RPC result against its allowlisted schema. */
export function validateBrokerResult(rpc: BrokerRpc, result: unknown): unknown {
  const parsed = BROKER_RESULT_SCHEMAS[rpc].safeParse(result)
  if (!parsed.success) throw new BrokerRequestError(502, "result_too_large")
  return parsed.data
}
