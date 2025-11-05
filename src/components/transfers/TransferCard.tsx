"use client"

import * as React from "react"
import {
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns"
import { vi } from "date-fns/locale"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  TRANSFER_PURPOSES,
  TRANSFER_STATUSES,
  TRANSFER_TYPES,
} from "@/types/database"
import type {
  TransferListItem,
  TransferStatus,
  TransferType,
} from "@/types/transfers-data-grid"

const EMPTY_PLACEHOLDER = "—"

const TYPE_VARIANTS: Record<TransferType, "default" | "secondary" | "destructive"> = {
  noi_bo: "default",
  ben_ngoai: "secondary",
  thanh_ly: "destructive",
}

const STATUS_VARIANTS: Record<
  TransferStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  cho_duyet: "secondary",
  da_duyet: "default",
  dang_luan_chuyen: "destructive",
  da_ban_giao: "secondary",
  hoan_thanh: "default",
}

const formatDate = (value: string | null, withTime = false) => {
  if (!value) return EMPTY_PLACEHOLDER
  const parsedIso = parseISO(value)
  if (isValid(parsedIso)) {
    return format(parsedIso, withTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale: vi })
  }
  const fallback = new Date(value)
  if (!isValid(fallback)) return EMPTY_PLACEHOLDER
  return format(fallback, withTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale: vi })
}

const getOverdueBadge = (transfer: TransferListItem, referenceDate: Date) => {
  if (transfer.loai_hinh !== "ben_ngoai") return null

  const dueRaw = transfer.ngay_du_kien_tra
  if (!dueRaw) return null

  const dueParsed = parseISO(dueRaw)
  if (!isValid(dueParsed)) return null

  const referenceDay = startOfDay(referenceDate)
  const dueDay = startOfDay(dueParsed)

  if (transfer.ngay_hoan_tra) {
    const returned = parseISO(transfer.ngay_hoan_tra)
    if (isValid(returned)) {
      const returnDay = startOfDay(returned)
      const delayDays = differenceInCalendarDays(returnDay, dueDay)
      if (delayDays > 0) {
        return (
          <Badge variant="secondary" className="mt-1 w-fit">
            Trả trễ {delayDays} ngày
          </Badge>
        )
      }
    }
    return null
  }

  const daysLate = differenceInCalendarDays(referenceDay, dueDay)
  if (daysLate > 0) {
    return (
      <Badge variant="destructive" className="mt-1 w-fit">
        Quá hạn {daysLate} ngày
      </Badge>
    )
  }

  return null
}

interface TransferCardProps {
  transfer: TransferListItem
  onClick?: (transfer: TransferListItem) => void
  actions?: React.ReactNode
  referenceDate?: Date
}

export function TransferCard({
  transfer,
  onClick,
  actions,
  referenceDate = new Date(),
}: TransferCardProps) {
  const handleClick = React.useCallback(() => {
    onClick?.(transfer)
  }, [onClick, transfer])

  const overdueBadge = React.useMemo(
    () => getOverdueBadge(transfer, referenceDate),
    [referenceDate, transfer],
  )

  return (
    <Card
      className="cursor-pointer shadow-sm transition-shadow hover:shadow-md"
      onClick={handleClick}
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold leading-none">{transfer.ma_yeu_cau}</p>
            <Badge variant={TYPE_VARIANTS[transfer.loai_hinh]}>
              {TRANSFER_TYPES[transfer.loai_hinh]}
            </Badge>
          </div>
          <Badge
            variant={STATUS_VARIANTS[transfer.trang_thai]}
            className="self-start text-[11px] uppercase tracking-wide"
          >
            {TRANSFER_STATUSES[transfer.trang_thai]}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Thiết bị</p>
            <p className="text-sm font-medium leading-5">
              {transfer.thiet_bi?.ma_thiet_bi
                ? `${transfer.thiet_bi.ma_thiet_bi} – ${transfer.thiet_bi.ten_thiet_bi ?? EMPTY_PLACEHOLDER}`
                : transfer.thiet_bi?.ten_thiet_bi ?? EMPTY_PLACEHOLDER}
            </p>
            {transfer.thiet_bi?.model ? (
              <p className="text-xs text-muted-foreground">Model: {transfer.thiet_bi.model}</p>
            ) : null}
            {transfer.thiet_bi?.khoa_phong_quan_ly ? (
              <p className="text-xs text-muted-foreground">
                Quản lý: {transfer.thiet_bi.khoa_phong_quan_ly}
              </p>
            ) : null}
            {transfer.thiet_bi?.facility_name ? (
              <p className="text-xs text-muted-foreground">
                Cơ sở: {transfer.thiet_bi.facility_name}
              </p>
            ) : null}
          </div>

          <TypeSpecificDetails transfer={transfer} overdueBadge={overdueBadge} />

          <div>
            <p className="text-xs text-muted-foreground">Lý do</p>
            <p className="text-sm leading-5 text-muted-foreground">
              {transfer.ly_do_luan_chuyen || EMPTY_PLACEHOLDER}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Tạo lúc {formatDate(transfer.created_at, true)}
          </p>
          {actions ? (
            <div
              className="flex flex-wrap items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

interface TypeSpecificDetailsProps {
  transfer: TransferListItem
  overdueBadge: React.ReactNode
}

function TypeSpecificDetails({ transfer, overdueBadge }: TypeSpecificDetailsProps) {
  if (transfer.loai_hinh === "noi_bo") {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Từ → Đến</p>
        <p className="text-sm">
          {(transfer.khoa_phong_hien_tai || EMPTY_PLACEHOLDER) +
            " → " +
            (transfer.khoa_phong_nhan || EMPTY_PLACEHOLDER)}
        </p>
      </div>
    )
  }

  if (transfer.loai_hinh === "ben_ngoai") {
    return (
      <div className="space-y-2">
        <div>
          <p className="text-xs text-muted-foreground">Đơn vị nhận</p>
          <p className="text-sm">{transfer.don_vi_nhan || EMPTY_PLACEHOLDER}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Dự kiến hoàn trả</p>
          <p className="text-sm">
            {transfer.ngay_du_kien_tra ? formatDate(transfer.ngay_du_kien_tra) : EMPTY_PLACEHOLDER}
          </p>
          {overdueBadge}
        </div>
        {transfer.nguoi_lien_he || transfer.so_dien_thoai ? (
          <div>
            <p className="text-xs text-muted-foreground">Liên hệ</p>
            <p className="text-sm">
              {[transfer.nguoi_lien_he, transfer.so_dien_thoai]
                .filter(Boolean)
                .join(" • ") || EMPTY_PLACEHOLDER}
            </p>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs text-muted-foreground">Mục đích</p>
        <p className="text-sm">
          {transfer.muc_dich
            ? TRANSFER_PURPOSES[transfer.muc_dich] ?? transfer.muc_dich
            : EMPTY_PLACEHOLDER}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Ngày hoàn tất</p>
        <p className="text-sm">
          {transfer.ngay_hoan_thanh ? formatDate(transfer.ngay_hoan_thanh) : EMPTY_PLACEHOLDER}
        </p>
      </div>
    </div>
  )
}
