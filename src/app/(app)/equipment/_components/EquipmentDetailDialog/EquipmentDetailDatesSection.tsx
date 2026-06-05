"use client"

import * as React from "react"

import {
  EquipmentEditNullableNumberField,
  EquipmentEditTextField,
} from "@/components/equipment-edit/EquipmentEditFieldControls"

/** Renders date and finance fields in the equipment detail edit form. */
export function EquipmentDetailDatesSection() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquipmentEditTextField
          name="ngay_nhap"
          label="Ngày nhập"
          placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY"
        />
        <EquipmentEditTextField
          name="ngay_dua_vao_su_dung"
          label="Ngày đưa vào sử dụng"
          placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY"
        />
      </div>

      <EquipmentEditTextField
        name="ngay_ngung_su_dung"
        label="Ngày ngừng sử dụng"
        placeholder="DD/MM/YYYY"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquipmentEditTextField name="nguon_kinh_phi" label="Nguồn kinh phí" />
        <EquipmentEditNullableNumberField name="gia_goc" label="Giá gốc (VNĐ)" />
      </div>

      <EquipmentEditTextField
        name="han_bao_hanh"
        label="Hạn bảo hành"
        placeholder="DD/MM/YYYY"
      />
    </>
  )
}
