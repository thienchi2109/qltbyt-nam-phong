"use client"

import * as React from "react"
import { differenceInDays, parseISO, startOfDay } from "date-fns"

// Các trạng thái được coi là chưa hoàn thành
const UNCOMPLETED_REPAIR_STATUSES = ['Chờ xử lý', 'Đã duyệt'];

// Interface cơ bản cho repair request 
interface MinimalRepairRequest {
  id: number;
  ngay_mong_muon_hoan_thanh: string | null;
  trang_thai: string;
}

export type RepairAlertItem<T = MinimalRepairRequest> = T & {
  daysDifference: number; // Số ngày chênh lệch so với hôm nay (âm là quá hạn, dương là còn lại)
  isOverdue: boolean;
  isUpcoming: boolean;
}

export function useRepairAlerts<T extends MinimalRepairRequest>(
  allRepairRequests: T[] | null | undefined
): RepairAlertItem<T>[] {
  const today = startOfDay(new Date());

  const alertableRequests = React.useMemo(() => {
    if (!allRepairRequests || allRepairRequests.length === 0) {
      return [];
    }

    const filteredAndProcessed: RepairAlertItem<T>[] = [];

    allRepairRequests.forEach(req => {
      if (!UNCOMPLETED_REPAIR_STATUSES.includes(req.trang_thai)) {
        return; // Bỏ qua nếu đã hoàn thành hoặc ở trạng thái không cần cảnh báo
      }
      if (!req.ngay_mong_muon_hoan_thanh) {
        return; // Bỏ qua nếu không có ngày mong muốn
      }
      try {
        const dueDate = startOfDay(parseISO(req.ngay_mong_muon_hoan_thanh));
        const daysDifference = differenceInDays(dueDate, today);

        const isOverdue = daysDifference < 0;
        // Sắp đến hạn: từ hôm nay (diff=0) đến 7 ngày tới (diff=7)
        const isUpcoming = daysDifference >= 0 && daysDifference <= 7;

        if (isOverdue || isUpcoming) {
          filteredAndProcessed.push({
            ...req, // Giữ lại tất cả các trường của T
            daysDifference,
            isOverdue,
            isUpcoming,
          } as RepairAlertItem<T>);
        }
      } catch (error) {
        console.error("Invalid date format for repair request ngay_mong_muon_hoan_thanh:", req.ngay_mong_muon_hoan_thanh, req.id, error);
      }
    });

    // Sắp xếp: quá hạn lên trước, sau đó đến gần hạn nhất
    return filteredAndProcessed.sort((a, b) => a.daysDifference - b.daysDifference);

  }, [allRepairRequests, today]);

  return alertableRequests;
}
