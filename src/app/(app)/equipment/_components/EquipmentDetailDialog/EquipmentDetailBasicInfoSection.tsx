"use client"

import * as React from "react"

import {
  EquipmentEditNullableNumberField,
  EquipmentEditTextField,
} from "@/components/equipment-edit/EquipmentEditFieldControls"

/** Renders core identifying and manufacturing fields in the equipment detail edit form. */
export function EquipmentDetailBasicInfoSection() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquipmentEditTextField
          name="ma_thiet_bi"
          label="Mã thiết bị"
          placeholder="VD: EQP-001"
        />
        <EquipmentEditTextField
          name="ten_thiet_bi"
          label="Tên thiết bị"
          placeholder="VD: Máy siêu âm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquipmentEditTextField name="model" label="Model" />
        <EquipmentEditTextField name="serial" label="Serial" />
      </div>

      <EquipmentEditTextField
        name="so_luu_hanh"
        label="Số lưu hành"
        placeholder="VD: LH-2024-001"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquipmentEditTextField name="hang_san_xuat" label="Hãng sản xuất" />
        <EquipmentEditTextField name="noi_san_xuat" label="Nơi sản xuất" />
      </div>

      <EquipmentEditNullableNumberField name="nam_san_xuat" label="Năm sản xuất" />
    </>
  )
}
