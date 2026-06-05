"use client"

import * as React from "react"
import { useFormContext } from "react-hook-form"

import { EquipmentEditTextareaField } from "@/components/equipment-edit/EquipmentEditFieldControls"
import { equipmentStatusOptions } from "@/components/equipment/equipment-table-columns"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { RequiredFormLabel } from "@/components/ui/required-form-label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { EquipmentFormValues } from "./EquipmentDetailTypes"

const CLASSIFICATION_OPTIONS = ["A", "B", "C", "D"] as const

/** Renders status, notes, and classification fields in the equipment detail edit form. */
export function EquipmentDetailStatusSection() {
  const form = useFormContext<EquipmentFormValues>()

  return (
    <>
      <FormField
        control={form.control}
        name="tinh_trang_hien_tai"
        render={({ field }) => (
          <FormItem>
            <RequiredFormLabel required>Tình trạng hiện tại</RequiredFormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tình trạng" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {equipmentStatusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <EquipmentEditTextareaField name="ghi_chu" label="Ghi chú" rows={3} />

      <FormField
        control={form.control}
        name="phan_loai_theo_nd98"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phân loại TB theo NĐ 98</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phân loại" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {CLASSIFICATION_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {`Loại ${type}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
