"use client"

import * as React from "react"
import { useFormContext } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

import type { EquipmentFormValues } from "./EquipmentDetailTypes"

function toNullableNumber(value: string): number | null {
  return value === "" ? null : Number(value)
}

export function EquipmentDetailBasicInfoSection() {
  const form = useFormContext<EquipmentFormValues>()

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="ma_thiet_bi"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mã thiết bị</FormLabel>
              <FormControl>
                <Input
                  placeholder="VD: EQP-001"
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
          name="ten_thiet_bi"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên thiết bị</FormLabel>
              <FormControl>
                <Input
                  placeholder="VD: Máy siêu âm"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="serial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Serial</FormLabel>
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
        name="so_luu_hanh"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Số lưu hành</FormLabel>
            <FormControl>
              <Input
                placeholder="VD: LH-2024-001"
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
          name="hang_san_xuat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hãng sản xuất</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="noi_san_xuat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nơi sản xuất</FormLabel>
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
        name="nam_san_xuat"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Năm sản xuất</FormLabel>
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
    </>
  )
}
