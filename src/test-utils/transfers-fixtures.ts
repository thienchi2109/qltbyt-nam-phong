import type { TransferListItem } from "@/types/transfers-data-grid"

/**
 * Shared test fixture for a TransferListItem with sensible defaults.
 * Use from vitest test files to avoid duplicating the long list of fields.
 */
export function makeTransferItem(
  overrides: Partial<TransferListItem> = {},
): TransferListItem {
  return {
    id: overrides.id ?? 1,
    ma_yeu_cau: overrides.ma_yeu_cau ?? "LC-0001",
    thiet_bi_id: overrides.thiet_bi_id ?? 1,
    loai_hinh: overrides.loai_hinh ?? "noi_bo",
    trang_thai: overrides.trang_thai ?? "cho_duyet",
    nguoi_yeu_cau_id: overrides.nguoi_yeu_cau_id ?? 1,
    ly_do_luan_chuyen: overrides.ly_do_luan_chuyen ?? "Transfer",
    khoa_phong_hien_tai: overrides.khoa_phong_hien_tai ?? "Dept A",
    khoa_phong_nhan: overrides.khoa_phong_nhan ?? "Dept B",
    muc_dich: overrides.muc_dich ?? null,
    don_vi_nhan: overrides.don_vi_nhan ?? null,
    dia_chi_don_vi: overrides.dia_chi_don_vi ?? null,
    nguoi_lien_he: overrides.nguoi_lien_he ?? null,
    so_dien_thoai: overrides.so_dien_thoai ?? null,
    ngay_du_kien_tra: overrides.ngay_du_kien_tra ?? null,
    ngay_ban_giao: overrides.ngay_ban_giao ?? null,
    ngay_hoan_tra: overrides.ngay_hoan_tra ?? null,
    ngay_hoan_thanh: overrides.ngay_hoan_thanh ?? null,
    nguoi_duyet_id: overrides.nguoi_duyet_id ?? null,
    ngay_duyet: overrides.ngay_duyet ?? null,
    ghi_chu_duyet: overrides.ghi_chu_duyet ?? null,
    created_at: overrides.created_at ?? "2026-05-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? null,
    created_by: overrides.created_by ?? 1,
    updated_by: overrides.updated_by ?? null,
    thiet_bi: overrides.thiet_bi ?? {
      ten_thiet_bi: "Device",
      ma_thiet_bi: "TB-001",
      model: "Model",
      serial: "SER-001",
      khoa_phong_quan_ly: "Dept A",
      facility_name: "Facility",
      facility_id: 1,
    },
  }
}
