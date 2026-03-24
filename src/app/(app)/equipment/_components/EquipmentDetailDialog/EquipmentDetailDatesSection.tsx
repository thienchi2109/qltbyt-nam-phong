"use client"

import * as React from "react"
import { useFormContext } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

import type { EquipmentFormValues } from "./EquipmentDetailTypes"

function toNullableNumber(value: string): number | null {
  return value === "" ? null : Number(value)
}

export function EquipmentDetailDatesSection() {
  const form = useFormContext<EquipmentFormValues>()

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="ngay_nhap"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ngày nhập</FormLabel>
              <FormControl>
                <Input
                  placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ngay_dua_vao_su_dung"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ngày đưa vào sử dụng</FormLabel>
              <FormControl>
                <Input
                  placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="ngay_ngung_su_dung"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ngày ngừng sử dụng</FormLabel>
            <FormControl>
              <Input
                placeholder="DD/MM/YYYY"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="nguon_kinh_phi"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nguồn kinh phí</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gia_goc"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Giá gốc (VNĐ)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(toNullableNumber(event.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="han_bao_hanh"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Hạn bảo hành</FormLabel>
            <FormControl>
              <Input
                placeholder="DD/MM/YYYY"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
