/**
 * equipment-table-columns.tsx
 *
 * Column definitions and cell renderers for the equipment table.
 * Includes status variant helpers, column labels, and a factory function
 * for creating TanStack Table column definitions.
 */

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Equipment } from "@/types/database"

/**
 * Returns badge variant based on equipment status.
 */
export function getStatusVariant(
  status: Equipment["tinh_trang_hien_tai"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Hoạt động":
      return "default"
    case "Chờ bảo trì":
    case "Chờ hiệu chuẩn/kiểm định":
      return "secondary"
    case "Chờ sửa chữa":
      return "destructive"
    case "Ngưng sử dụng":
    case "Chưa có nhu cầu sử dụng":
      return "outline"
    default:
      return "outline"
  }
}

/**
 * Returns badge variant based on NĐ98 classification.
 */
export function getClassificationVariant(
  classification: Equipment["phan_loai_theo_nd98"]
): "default" | "secondary" | "destructive" | "outline" {
  if (!classification) return "outline"
  const trimmed = classification.trim().toUpperCase()
  if (trimmed === 'A' || trimmed === 'LOẠI A') return "default"
  if (trimmed === 'B' || trimmed === 'LOẠI B' || trimmed === 'C' || trimmed === 'LOẠI C') return "secondary"
  if (trimmed === 'D' || trimmed === 'LOẠI D') return "destructive"
  return "outline"
}

/**
 * Human-readable labels for equipment table columns.
 */
export const columnLabels: Record<string, string> = {
  id: 'ID',
  ma_thiet_bi: 'Mã thiết bị',
  ten_thiet_bi: 'Tên thiết bị',
  model: 'Model',
  serial: 'Serial',
  cau_hinh_thiet_bi: 'Cấu hình',
  phu_kien_kem_theo: 'Phụ kiện kèm theo',
  hang_san_xuat: 'Hãng sản xuất',
  noi_san_xuat: 'Nơi sản xuất',
  nam_san_xuat: 'Năm sản xuất',
  ngay_nhap: 'Ngày nhập',
  ngay_dua_vao_su_dung: 'Ngày đưa vào sử dụng',
  nguon_kinh_phi: 'Nguồn kinh phí',
  gia_goc: 'Giá gốc',
  nam_tinh_hao_mon: 'Năm tính hao mòn',
  ty_le_hao_mon: 'Tỷ lệ hao mòn theo TT23',
  han_bao_hanh: 'Hạn bảo hành',
  vi_tri_lap_dat: 'Vị trí lắp đặt',
  nguoi_dang_truc_tiep_quan_ly: 'Người sử dụng',
  khoa_phong_quan_ly: 'Khoa/phòng quản lý',
  tinh_trang_hien_tai: 'Tình trạng',
  ghi_chu: 'Ghi chú',
  chu_ky_bt_dinh_ky: 'Chu kỳ BT định kỳ (ngày)',
  ngay_bt_tiep_theo: 'Ngày BT tiếp theo',
  chu_ky_hc_dinh_ky: 'Chu kỳ HC định kỳ (ngày)',
  ngay_hc_tiep_theo: 'Ngày HC tiếp theo',
  chu_ky_kd_dinh_ky: 'Chu kỳ KĐ định kỳ (ngày)',
  ngay_kd_tiep_theo: 'Ngày KĐ tiếp theo',
  phan_loai_theo_nd98: 'Phân loại theo NĐ98',
}

/**
 * Available equipment status options.
 */
export const equipmentStatusOptions = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng"
] as const

/**
 * Columns that support faceted filtering.
 */
export const filterableColumns: (keyof Equipment)[] = [
  'khoa_phong_quan_ly',
  'vi_tri_lap_dat',
  'nguoi_dang_truc_tiep_quan_ly',
  'phan_loai_theo_nd98',
  'tinh_trang_hien_tai'
]

interface CreateEquipmentColumnsConfig {
  renderActions: (equipment: Equipment) => React.ReactNode
}

/**
 * Factory function to create equipment table column definitions.
 * @param config - Configuration with action renderer callback
 * @returns Array of ColumnDef for TanStack Table
 */
export function createEquipmentColumns(
  config: CreateEquipmentColumnsConfig
): ColumnDef<Equipment>[] {
  const { renderActions } = config

  const dataColumns = (Object.keys(columnLabels) as Array<keyof Equipment>).map((key) => {
    const columnDef: ColumnDef<Equipment> = {
      accessorKey: key,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {columnLabels[key]}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const value = row.getValue(key)

        if (key === 'tinh_trang_hien_tai') {
          const statusValue = value as Equipment["tinh_trang_hien_tai"]
          if (!statusValue) {
            return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
          }
          return (
            <Badge variant={getStatusVariant(statusValue)}>
              {statusValue}
            </Badge>
          )
        }

        if (key === 'phan_loai_theo_nd98') {
          const classification = value as Equipment["phan_loai_theo_nd98"]
          if (!classification) {
            return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
          }
          return (
            <Badge variant={getClassificationVariant(classification)}>
              {classification.trim()}
            </Badge>
          )
        }

        if (key === 'gia_goc') {
          if (value === null || value === undefined) {
            return <div className="text-right italic text-muted-foreground">Chưa có dữ liệu</div>
          }
          return <div className="text-right">{Number(value).toLocaleString()}đ</div>
        }

        if (value === null || value === undefined || value === "") {
          return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
        }

        return <div className="truncate max-w-xs">{String(value)}</div>
      },
    }

    return columnDef
  })

  const actionsColumn: ColumnDef<Equipment> = {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => renderActions(row.original),
  }

  return [...dataColumns, actionsColumn]
}
