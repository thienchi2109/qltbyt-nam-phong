"use client"

import * as React from "react"

import { EquipmentEditTextField } from "@/components/equipment-edit/EquipmentEditFieldControls"

/** Renders assignment and location fields in the equipment detail edit form. */
export function EquipmentDetailAssignmentSection() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquipmentEditTextField
          name="khoa_phong_quan_ly"
          label="Khoa/Phòng quản lý"
          required
        />
        <EquipmentEditTextField
          name="vi_tri_lap_dat"
          label="Vị trí lắp đặt"
          required
        />
      </div>

      <EquipmentEditTextField
        name="nguoi_dang_truc_tiep_quan_ly"
        label="Người trực tiếp quản lý (sử dụng)"
        required
      />
    </>
  )
}
