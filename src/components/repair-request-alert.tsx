"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ChevronDown } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { differenceInDays, parseISO, startOfDay, format } from "date-fns"
import { vi } from 'date-fns/locale'

import type { RepairRequestWithEquipment } from "@/app/(app)/repair-requests/types"


interface RepairRequestAlertProps {
  requests: RepairRequestWithEquipment[];
}

// Các trạng thái được coi là chưa hoàn thành
const UNCOMPLETED_STATUSES = ['Chờ xử lý', 'Đã duyệt'];

export function RepairRequestAlert({ requests }: RepairRequestAlertProps) {
  const today = startOfDay(new Date());

  const overdueAndUpcomingRequests = React.useMemo(() => {
    if (!requests || requests.length === 0) {
      return [];
    }
    return requests.filter(req => {
      if (!UNCOMPLETED_STATUSES.includes(req.trang_thai)) {
        return false;
      }
      if (!req.ngay_mong_muon_hoan_thanh) {
        return false;
      }
      try {
        const dueDate = startOfDay(parseISO(req.ngay_mong_muon_hoan_thanh));
        const daysDifference = differenceInDays(dueDate, today);
        return daysDifference <= 7; // Quá hạn (daysDifference < 0) hoặc sắp đến hạn trong vòng 7 ngày (0 <= daysDifference <= 7)
      } catch (error) {
        console.error("Invalid date format for ngay_mong_muon_hoan_thanh:", req.ngay_mong_muon_hoan_thanh, req.id, error);
        return false;
      }
    }).sort((a, b) => { // Sắp xếp: quá hạn lên trước, sau đó đến gần hạn nhất
        const dueDateA = startOfDay(parseISO(a.ngay_mong_muon_hoan_thanh!));
        const dueDateB = startOfDay(parseISO(b.ngay_mong_muon_hoan_thanh!));
        return differenceInDays(dueDateA, today) - differenceInDays(dueDateB, today);
    });
  }, [requests, today]);

  if (overdueAndUpcomingRequests.length === 0) {
    return null;
  }

  const count = overdueAndUpcomingRequests.length;
  const alertTitle = `Có ${count} yêu cầu sửa chữa sắp/quá hạn cần chú ý!`;

  const getDueDateStatus = (dueDateString: string | null): { text: string; className: string } => {
    if (!dueDateString) return { text: "Không có MMHT", className: "text-gray-500" };
    try {
        const dueDate = startOfDay(parseISO(dueDateString));
        const diff = differenceInDays(dueDate, today);

        if (diff < 0) return { text: `Quá hạn ${Math.abs(diff)} ngày`, className: "text-red-600 font-semibold" };
        if (diff === 0) return { text: "Đến hạn hôm nay", className: "text-orange-600 font-semibold" };
        if (diff <= 7) return { text: `Còn ${diff} ngày`, className: "text-yellow-600 font-semibold" };
        return { text: format(dueDate, 'dd/MM/yyyy', { locale: vi }), className: "" }; // Should not happen based on filter
    } catch {
        return { text: "Ngày không hợp lệ", className: "text-gray-500" };
    }
  };

  return (
    <Accordion type="single" collapsible className="w-full mb-4">
      <AccordionItem value="repair-alert" className="border border-destructive/50 bg-destructive/5 shadow-lg rounded-lg">
        <AccordionTrigger className="px-4 py-3 text-destructive hover:no-underline">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span className="font-semibold">{alertTitle}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pt-0 pb-3">
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {overdueAndUpcomingRequests.map((req) => {
              const dueDateStatus = getDueDateStatus(req.ngay_mong_muon_hoan_thanh);
              return (
                <div key={req.id} className="p-3 bg-background/50 rounded-md border">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-sm">
                      {req.thiet_bi?.ten_thiet_bi || 'Không rõ thiết bị'}
                      {req.thiet_bi?.ma_thiet_bi && ` (${req.thiet_bi.ma_thiet_bi})`}
                    </h4>
                    <Badge variant={dueDateStatus.text.includes("Quá hạn") || dueDateStatus.text.includes("hôm nay") ? "destructive" : "secondary"} className="whitespace-nowrap">
                        {dueDateStatus.text}
                    </Badge>
                  </div>
                  {req.mo_ta_su_co && (
                    <p className="text-xs text-muted-foreground truncate mb-1">
                      Mô tả: {req.mo_ta_su_co}
                    </p>
                  )}
                  {req.nguoi_yeu_cau && (
                     <p className="text-xs text-muted-foreground">Người YC: {req.nguoi_yeu_cau}</p>
                  )}
                </div>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
