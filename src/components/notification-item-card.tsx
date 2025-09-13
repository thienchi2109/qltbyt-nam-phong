"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight, CalendarClock, Wrench, ArrowLeftRight } from "lucide-react"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import { cn } from "@/lib/utils" // shadcn/ui utility for conditional classes

export type NotificationType = "repair" | "transfer";

// Interface chung cho props, có thể mở rộng sau
export interface NotificationItemProps {
  id: number | string;
  title: string; // Ví dụ: Tên thiết bị (Mã TB) hoặc Mã YC Luân chuyển
  description?: string; // Ví dụ: Mô tả sự cố ngắn hoặc Loại hình luân chuyển
  statusText: string; // Ví dụ: "Quá hạn 5 ngày" hoặc "Còn 2 ngày"
  statusClassName?: string; // Class màu cho statusText (ví dụ: "text-red-600 font-semibold")
  timestamp?: string; // Ngày tạo yêu cầu hoặc ngày liên quan khác
  linkHref: string; // Đường dẫn khi nhấp vào
  type: NotificationType;
  details?: Record<string, any>; // Thông tin chi tiết bổ sung nếu cần
}

export function NotificationItemCard({
  id,
  title,
  description,
  statusText,
  statusClassName,
  timestamp,
  linkHref,
  type,
  details,
}: NotificationItemProps) {
  const IconComponent = type === "repair" ? Wrench : ArrowLeftRight;

  return (
    <Link href={linkHref} passHref legacyBehavior>
      <a className="block p-3 hover:bg-muted/50 rounded-md transition-colors border border-transparent hover:border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/50">
        <div className="flex items-start space-x-3">
          <div className={cn(
            "flex-shrink-0 p-1.5 rounded-full mt-1",
            type === "repair" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
          )}>
            <IconComponent className="h-4 w-4" />
          </div>
          <div className="flex-grow space-y-0.5">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold truncate pr-2" title={title}>{title}</h4>
              {statusText && (
                <span className={cn("text-xs font-medium whitespace-nowrap", statusClassName)}>
                  {statusText}
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground truncate" title={description}>
                {description}
              </p>
            )}
            {timestamp && (
              <p className="text-xs text-muted-foreground">
                {format(parseISO(timestamp), "dd/MM/yyyy HH:mm", { locale: vi })}
              </p>
            )}
            {/* Có thể hiển thị thêm details nếu cần */}
            {/* {details && details.nguoi_yeu_cau && (
              <p className="text-xs text-muted-foreground">Người YC: {details.nguoi_yeu_cau}</p>
            )} */}
          </div>
          {/* <div className="flex-shrink-0 self-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </div> */}
        </div>
      </a>
    </Link>
  );
}
