"use client"

import * as React from "react"

import {
  EquipmentEditNullableNumberField,
  EquipmentEditTextField,
} from "@/components/equipment-edit/EquipmentEditFieldControls"

/** Renders depreciation and maintenance schedule fields in the equipment detail edit form. */
export function EquipmentDetailLifecycleSection() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquipmentEditNullableNumberField
          name="nam_tinh_hao_mon"
          label="Năm tính hao mòn"
        />
        <EquipmentEditTextField
          name="ty_le_hao_mon"
          label="Tỷ lệ hao mòn theo TT23"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquipmentEditNullableNumberField
          name="chu_ky_bt_dinh_ky"
          label="Chu kỳ BT định kỳ (ngày)"
        />
        <EquipmentEditTextField
          name="ngay_bt_tiep_theo"
          label="Ngày BT tiếp theo"
          placeholder="DD/MM/YYYY"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquipmentEditNullableNumberField
          name="chu_ky_hc_dinh_ky"
          label="Chu kỳ HC định kỳ (ngày)"
        />
        <EquipmentEditTextField
          name="ngay_hc_tiep_theo"
          label="Ngày HC tiếp theo"
          placeholder="DD/MM/YYYY"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EquipmentEditNullableNumberField
          name="chu_ky_kd_dinh_ky"
          label="Chu kỳ KĐ định kỳ (ngày)"
        />
        <EquipmentEditTextField
          name="ngay_kd_tiep_theo"
          label="Ngày KĐ tiếp theo"
          placeholder="DD/MM/YYYY"
        />
      </div>
    </>
  )
}
