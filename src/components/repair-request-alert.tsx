"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'

import type { RepairRequestOverdueSummary } from "@/app/(app)/repair-requests/types"


interface RepairRequestAlertProps {
  summary: RepairRequestOverdueSummary | undefined;
  isLoading: boolean;
}

export function RepairRequestAlert({ summary, isLoading }: RepairRequestAlertProps) {
  if (isLoading || !summary || summary.total === 0) {
    return null;
  }

  const alertTitle = `Có ${summary.total} yêu cầu sửa chữa sắp/quá hạn cần chú ý!`;

  const getDueDateStatus = (
    daysDifference: number,
    dueDateString: string | null
  ): { text: string; className: string } => {
    if (!dueDateString) return { text: "Không có MMHT", className: "text-gray-500" };
    try {
        const dueDate = parseISO(dueDateString);

        if (daysDifference < 0) return { text: `Quá hạn ${Math.abs(daysDifference)} ngày`, className: "text-red-600 font-semibold" };
        if (daysDifference === 0) return { text: "Đến hạn hôm nay", className: "text-orange-600 font-semibold" };
        if (daysDifference <= 7) return { text: `Còn ${daysDifference} ngày`, className: "text-yellow-600 font-semibold" };
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
            {summary.items.map((req) => {
              const dueDateStatus = getDueDateStatus(
                req.days_difference,
                req.ngay_mong_muon_hoan_thanh
              );
              return (
                <div key={req.id} className="p-3 bg-background/50 rounded-md border">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-sm">
                      {req.thiet_bi?.ten_thiet_bi || 'Không rõ thiết bị'}
                      {req.thiet_bi?.ma_thiet_bi && ` (${req.thiet_bi.ma_thiet_bi})`}
                    </h4>
                    <Badge variant={req.days_difference <= 0 ? "destructive" : "secondary"} className="whitespace-nowrap">
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
