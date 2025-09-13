"use client" // Vì sử dụng Date, có thể không cần nếu logic thuần túy

import * as React from "react"
import { differenceInDays, parseISO, startOfDay, addDays } from "date-fns"
import type { TransferRequest } from "@/types/database" // Đảm bảo type này có thông tin thiết bị

// Các trạng thái của yêu cầu luân chuyển 'ben_ngoai' cần theo dõi ngày hoàn trả
const RELEVANT_TRANSFER_STATUSES_FOR_RETURN_ALERT: TransferRequest['trang_thai'][] = ['da_ban_giao', 'dang_luan_chuyen'];

export interface TransferAlertItem extends TransferRequest {
  daysDifference: number; // Số ngày chênh lệch so với hôm nay (âm là quá hạn, dương là còn lại)
  isOverdue: boolean;
  isUpcoming: boolean;
}

export function useTransferAlerts(allTransferRequests: TransferRequest[] | null | undefined): TransferAlertItem[] {
  const today = startOfDay(new Date());
  const nextSevenDays = addDays(today, 7);

  const alertableTransfers = React.useMemo(() => {
    if (!allTransferRequests || allTransferRequests.length === 0) {
      return [];
    }

    const filteredAndProcessed: TransferAlertItem[] = [];

    allTransferRequests.forEach(req => {
      if (
        req.loai_hinh === 'ben_ngoai' &&
        req.ngay_du_kien_tra &&
        RELEVANT_TRANSFER_STATUSES_FOR_RETURN_ALERT.includes(req.trang_thai)
      ) {
        try {
          const dueDate = startOfDay(parseISO(req.ngay_du_kien_tra));
          const daysDifference = differenceInDays(dueDate, today);

          const isOverdue = daysDifference < 0;
          // Sắp đến hạn: từ hôm nay (diff=0) đến 7 ngày tới (diff=7)
          const isUpcoming = daysDifference >= 0 && daysDifference <= 7;

          if (isOverdue || isUpcoming) {
            filteredAndProcessed.push({
              ...req,
              daysDifference,
              isOverdue,
              isUpcoming,
            });
          }
        } catch (error) {
          console.error("Invalid date format for transfer request ngay_du_kien_tra:", req.ngay_du_kien_tra, req.id, error);
        }
      }
    });

    // Sắp xếp: quá hạn lên trước, sau đó đến gần hạn nhất
    return filteredAndProcessed.sort((a, b) => a.daysDifference - b.daysDifference);

  }, [allTransferRequests, today, nextSevenDays]); // nextSevenDays thực ra không cần trong dependency vì today đã đủ

  return alertableTransfers;
}
