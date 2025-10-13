/**
 * Transfer Data Normalization Utilities
 * Purpose: Provide backward-compatible data shape transformation
 * for TransferCard component to support both:
 * - Old API: TransferRequest (nested thiet_bi object)
 * - New Kanban API: TransferKanbanItem (flattened thiet_bi_* fields)
 */

import type { TransferRequest } from '@/types/database'
import type { TransferKanbanItem } from '@/types/transfer-kanban'

/**
 * Union type representing both data shapes
 */
export type TransferData = TransferRequest | TransferKanbanItem

/**
 * Type guard to check if data is from new Kanban API (flattened)
 */
export function isKanbanItem(transfer: TransferData): transfer is TransferKanbanItem {
  return 'thiet_bi_ma' in transfer && 'thiet_bi_ten' in transfer
}

/**
 * Type guard to check if data is from old API (nested)
 */
export function isTransferRequest(transfer: TransferData): transfer is TransferRequest {
  return 'thiet_bi' in transfer || !('thiet_bi_ma' in transfer)
}

/**
 * Normalize transfer data to consistent TransferRequest shape
 * Converts flattened TransferKanbanItem to nested structure
 * 
 * @param transfer - Transfer data from either old or new API
 * @returns Normalized transfer with nested thiet_bi object
 */
export function normalizeTransferData(transfer: TransferData): TransferRequest {
  // If already in correct shape, return as-is
  if (isTransferRequest(transfer)) {
    return transfer
  }

  // Convert flattened Kanban item to nested structure
  const kanbanItem = transfer as TransferKanbanItem
  
  const normalized: TransferRequest = {
    id: kanbanItem.id,
    ma_yeu_cau: kanbanItem.ma_yeu_cau,
    thiet_bi_id: kanbanItem.thiet_bi_id,
    loai_hinh: kanbanItem.loai_hinh,
    trang_thai: kanbanItem.trang_thai,
    nguoi_yeu_cau_id: kanbanItem.nguoi_yeu_cau_id ?? undefined,
    ly_do_luan_chuyen: kanbanItem.ly_do_luan_chuyen,
    khoa_phong_hien_tai: kanbanItem.khoa_phong_hien_tai ?? undefined,
    khoa_phong_nhan: kanbanItem.khoa_phong_nhan ?? undefined,
    muc_dich: kanbanItem.muc_dich ?? undefined,
    don_vi_nhan: kanbanItem.don_vi_nhan ?? undefined,
    dia_chi_don_vi: kanbanItem.dia_chi_don_vi ?? undefined,
    nguoi_lien_he: kanbanItem.nguoi_lien_he ?? undefined,
    so_dien_thoai: kanbanItem.so_dien_thoai ?? undefined,
    ngay_du_kien_tra: kanbanItem.ngay_du_kien_tra ?? undefined,
    ngay_ban_giao: kanbanItem.ngay_ban_giao ?? undefined,
    ngay_hoan_tra: kanbanItem.ngay_hoan_tra ?? undefined,
    ngay_hoan_thanh: kanbanItem.ngay_hoan_thanh ?? undefined,
    nguoi_duyet_id: kanbanItem.nguoi_duyet_id ?? undefined,
    ngay_duyet: kanbanItem.ngay_duyet ?? undefined,
    ghi_chu_duyet: kanbanItem.ghi_chu_duyet ?? undefined,
    created_at: kanbanItem.created_at,
    updated_at: kanbanItem.updated_at ?? '',
    created_by: kanbanItem.created_by ?? undefined,
    updated_by: kanbanItem.updated_by ?? undefined,
    
    // Reconstruct nested thiet_bi object from flattened fields
    thiet_bi: {
      id: kanbanItem.thiet_bi_id,
      ma_thiet_bi: kanbanItem.thiet_bi_ma,
      ten_thiet_bi: kanbanItem.thiet_bi_ten,
      model: kanbanItem.thiet_bi_model,
      don_vi: kanbanItem.thiet_bi_don_vi,
    },
  }

  return normalized
}

/**
 * React hook for normalized transfer data
 * Ensures component always receives consistent data shape
 * 
 * @param transfer - Transfer data from any source
 * @returns Normalized transfer data
 */
export function useNormalizedTransfer(transfer: TransferData): TransferRequest {
  return normalizeTransferData(transfer)
}
