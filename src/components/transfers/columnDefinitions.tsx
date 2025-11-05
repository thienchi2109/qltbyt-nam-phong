import type { ColumnDef } from "@tanstack/react-table"
import type { ReactNode } from "react"
import {
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns"
import { vi } from "date-fns/locale"

import { Badge } from "@/components/ui/badge"
import { TRANSFER_PURPOSES, TRANSFER_STATUSES } from "@/types/database"
import type {
  TransferListItem,
  TransferStatus,
  TransferType,
} from "@/types/transfers-data-grid"

const EMPTY_PLACEHOLDER = "—"

type BadgeVariant = "default" | "secondary" | "outline" | "destructive"

const STATUS_VARIANTS: Record<TransferStatus, BadgeVariant> = {
  cho_duyet: "secondary",
  da_duyet: "default",
  dang_luan_chuyen: "destructive",
  da_ban_giao: "secondary",
  hoan_thanh: "default",
}

const parseDate = (value: string | null) => {
  if (!value) return null
  const parsedIso = parseISO(value)
  if (isValid(parsedIso)) return parsedIso
  const fallback = new Date(value)
  return isValid(fallback) ? fallback : null
}

const formatDate = (value: string | null, withTime = false) => {
  const parsed = parseDate(value)
  if (!parsed) return EMPTY_PLACEHOLDER
  return format(parsed, withTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale: vi })
}

const renderStatusBadge = (status: TransferStatus) => (
  <Badge variant={STATUS_VARIANTS[status]} className="uppercase tracking-wide text-[11px]">
    {TRANSFER_STATUSES[status] ?? status}
  </Badge>
)

const renderEquipment = (item: TransferListItem) => {
  const equipment = item.thiet_bi
  if (!equipment) {
    return <span className="text-sm text-muted-foreground">Chưa có dữ liệu thiết bị</span>
  }

  const meta = [equipment.ma_thiet_bi, equipment.model, equipment.serial]
    .filter(Boolean)
    .join(" • ")

  return (
    <div className="space-y-1">
      <p className="font-medium leading-5">{equipment.ten_thiet_bi ?? EMPTY_PLACEHOLDER}</p>
      {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
      {equipment.khoa_phong_quan_ly ? (
        <p className="text-xs text-muted-foreground">
          Khoa/phòng: {equipment.khoa_phong_quan_ly}
        </p>
      ) : null}
    </div>
  )
}

const renderFacility = (item: TransferListItem) => {
  const facility = item.thiet_bi?.facility_name
  return facility ? facility : EMPTY_PLACEHOLDER
}

const buildOverdueIndicator = (item: TransferListItem, referenceDate: Date) => {
  const dueDate = parseDate(item.ngay_du_kien_tra)
  if (!dueDate) return null

  const due = startOfDay(dueDate)
  const reference = startOfDay(referenceDate)
  const returned = parseDate(item.ngay_hoan_tra)

  if (!returned) {
    const daysLate = differenceInCalendarDays(reference, due)
    if (daysLate > 0) {
      return (
        <Badge variant="destructive" className="mt-1 w-fit">
          Quá hạn {daysLate} ngày
        </Badge>
      )
    }
    return null
  }

  const returnDay = startOfDay(returned)
  const delayDays = differenceInCalendarDays(returnDay, due)
  if (delayDays > 0) {
    return (
      <Badge variant="secondary" className="mt-1 w-fit">
        Trả trễ {delayDays} ngày
      </Badge>
    )
  }

  return null
}

export interface TransferColumnOptions {
  renderActions?: (transfer: TransferListItem) => ReactNode
  referenceDate?: Date
}

export interface TransferColumnGroups {
  common: ColumnDef<TransferListItem>[]
  noiBo: ColumnDef<TransferListItem>[]
  benNgoai: ColumnDef<TransferListItem>[]
  thanhLy: ColumnDef<TransferListItem>[]
}

const createCommonColumns = (options: TransferColumnOptions): ColumnDef<TransferListItem>[] => [
  {
    accessorKey: "ma_yeu_cau",
    header: "Mã phiếu",
    enableSorting: true,
    cell: ({ row }) => <span className="font-medium">{row.original.ma_yeu_cau}</span>,
  },
  {
    id: "equipment",
    accessorFn: (row) => row.thiet_bi?.ten_thiet_bi ?? "",
    header: "Thiết bị",
    cell: ({ row }) => renderEquipment(row.original),
    enableSorting: true,
    size: 260,
  },
  {
    accessorKey: "ly_do_luan_chuyen",
    header: "Lý do",
    enableSorting: true,
    cell: ({ row }) => (
      <p className="max-w-xs text-sm leading-5 text-muted-foreground">
        {row.original.ly_do_luan_chuyen || EMPTY_PLACEHOLDER}
      </p>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Ngày tạo",
    enableSorting: true,
    sortingFn: "datetime",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.created_at, true)}
      </span>
    ),
  },
]

const createStatusColumn = (): ColumnDef<TransferListItem> => ({
  accessorKey: "trang_thai",
  header: "Trạng thái",
  enableSorting: true,
  cell: ({ row }) => renderStatusBadge(row.original.trang_thai),
})

const createActionsColumn = (options: TransferColumnOptions): ColumnDef<TransferListItem> => ({
  id: "actions",
  header: "Thao tác",
  enableSorting: false,
  enableHiding: false,
  size: 120,
  cell: ({ row }) => options.renderActions?.(row.original) ?? null,
})

const createInternalColumns = (): ColumnDef<TransferListItem>[] => [
  {
    accessorKey: "khoa_phong_hien_tai",
    header: "Từ khoa/phòng",
    cell: ({ row }) => row.original.khoa_phong_hien_tai || EMPTY_PLACEHOLDER,
  },
  {
    accessorKey: "khoa_phong_nhan",
    header: "Đến khoa/phòng",
    cell: ({ row }) => row.original.khoa_phong_nhan || EMPTY_PLACEHOLDER,
  },
  {
    id: "receivingFacility",
    accessorFn: (row) => row.thiet_bi?.facility_name ?? "",
    header: "Đơn vị nhận",
    cell: ({ row }) => renderFacility(row.original),
    enableSorting: true,
  },
]

const createExternalColumns = (referenceDate: Date): ColumnDef<TransferListItem>[] => [
  {
    accessorKey: "don_vi_nhan",
    header: "Đơn vị nhận",
    cell: ({ row }) => row.original.don_vi_nhan || EMPTY_PLACEHOLDER,
  },
  {
    accessorKey: "nguoi_lien_he",
    header: "Người liên hệ",
    cell: ({ row }) => row.original.nguoi_lien_he || EMPTY_PLACEHOLDER,
  },
  {
    accessorKey: "so_dien_thoai",
    header: "Số điện thoại",
    cell: ({ row }) => row.original.so_dien_thoai || EMPTY_PLACEHOLDER,
  },
  {
    id: "returnTimeline",
    header: "Hoàn trả",
    cell: ({ row }) => {
      const indicator = buildOverdueIndicator(row.original, referenceDate)
      return (
        <div className="flex flex-col text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatDate(row.original.ngay_hoan_tra, false)}
          </span>
          <span className="text-xs">
            Dự kiến: {formatDate(row.original.ngay_du_kien_tra, false)}
          </span>
          {indicator}
        </div>
      )
    },
  },
]

const createLiquidationColumns = (): ColumnDef<TransferListItem>[] => [
  {
    accessorKey: "muc_dich",
    header: "Mục đích",
    cell: ({ row }) => {
      const key = row.original.muc_dich ?? null
      return key ? TRANSFER_PURPOSES[key] ?? key : EMPTY_PLACEHOLDER
    },
  },
  {
    accessorKey: "don_vi_nhan",
    header: "Đơn vị tiếp nhận",
    cell: ({ row }) => row.original.don_vi_nhan || EMPTY_PLACEHOLDER,
  },
  {
    id: "contact",
    header: "Liên hệ",
    cell: ({ row }) => {
      const contact = row.original.nguoi_lien_he
      const phone = row.original.so_dien_thoai
      if (!contact && !phone) return EMPTY_PLACEHOLDER
      return (
        <div className="text-sm">
          {contact ? <p className="font-medium">{contact}</p> : null}
          {phone ? (
            <p className="text-xs text-muted-foreground">{phone}</p>
          ) : null}
        </div>
      )
    },
  },
  {
    accessorKey: "ngay_hoan_thanh",
    header: "Ngày hoàn tất",
    enableSorting: true,
    sortingFn: "datetime",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.ngay_hoan_thanh, false)}
      </span>
    ),
  },
]

export const buildTransferColumns = (
  options: TransferColumnOptions = {},
): TransferColumnGroups => {
  const referenceDate = options.referenceDate ?? new Date()
  return {
    common: createCommonColumns(options),
    noiBo: createInternalColumns(),
    benNgoai: createExternalColumns(referenceDate),
    thanhLy: createLiquidationColumns(),
  }
}

export const getColumnsForType = (
  type: TransferType,
  options: TransferColumnOptions = {},
): ColumnDef<TransferListItem>[] => {
  const groups = buildTransferColumns(options)
  const specific =
    type === "noi_bo"
      ? groups.noiBo
      : type === "ben_ngoai"
        ? groups.benNgoai
        : groups.thanhLy

  return [...groups.common, ...specific, createStatusColumn(), createActionsColumn(options)]
}
