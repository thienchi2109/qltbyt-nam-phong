"use client"

import * as React from "react"
import { useFormContext } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { RequiredFormLabel } from "@/components/ui/required-form-label"

import type { EquipmentFormValues } from "./EquipmentDetailTypes"

export function EquipmentDetailAssignmentSection() {
  const form = useFormContext<EquipmentFormValues>()

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="khoa_phong_quan_ly"
          render={({ field }) => (
            <FormItem>
              <RequiredFormLabel required>Khoa/Phòng quản lý</RequiredFormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="vi_tri_lap_dat"
          render={({ field }) => (
            <FormItem>
              <RequiredFormLabel required>Vị trí lắp đặt</RequiredFormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="nguoi_dang_truc_tiep_quan_ly"
        render={({ field }) => (
          <FormItem>
            <RequiredFormLabel required>
              Người trực tiếp quản lý (sử dụng)
            </RequiredFormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
