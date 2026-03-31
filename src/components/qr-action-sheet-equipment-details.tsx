"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { Equipment } from "@/lib/data"
import { formatCurrency, getStatusColor } from "./qr-action-sheet-config"

interface QRActionSheetEquipmentDetailsProps {
  equipment: Equipment
}

export function QRActionSheetEquipmentDetails({
  equipment,
}: QRActionSheetEquipmentDetailsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">{equipment.ten_thiet_bi}</h3>
        <p className="text-sm text-muted-foreground">
          {equipment.model} • {equipment.hang_san_xuat}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={getStatusColor(equipment.tinh_trang_hien_tai || null)}
        >
          {equipment.tinh_trang_hien_tai || "Chưa xác định"}
        </Badge>
      </div>

      <Separator />

      <div className="grid gap-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Mã thiết bị:</span>
          <span className="font-mono font-semibold">{equipment.ma_thiet_bi}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Serial:</span>
          <span className="font-mono">{equipment.serial}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Vị trí:</span>
          <span>{equipment.vi_tri_lap_dat}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Khoa/Phòng:</span>
          <span>{equipment.khoa_phong_quan_ly}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Năm sản xuất:</span>
          <span>{equipment.nam_san_xuat}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Giá gốc:</span>
          <span className="font-semibold">
            {equipment.gia_goc != null ? formatCurrency(equipment.gia_goc) : "N/A"}
          </span>
        </div>
      </div>
    </div>
  )
}
