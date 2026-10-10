"use client"

import * as React from "react"
import { useFormContext } from "react-hook-form"

import { RequiredFormLabel } from "@/components/ui/required-form-label"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import type { AddEquipmentTenantOption } from "./add-equipment-dialog.queries"
import { type AddEquipmentFormValues } from "./add-equipment-dialog.schema"

export { AddEquipmentAssignmentSection } from "./AddEquipmentStatusSection"

function toNullableNumber(value: string): number | null {
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

/** Renders the basic equipment fields in the add-equipment form. */
export function AddEquipmentBasicFieldsSection({
  currentTenant,
}: {
  currentTenant: AddEquipmentTenantOption | null
}) {
  const form = useFormContext<AddEquipmentFormValues>()

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
                <Input placeholder="VD: EQP-001" {...field} />
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
                <Input placeholder="VD: Máy siêu âm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Đơn vị</Label>
        <Input
          value={
            currentTenant
              ? `${currentTenant.name}${currentTenant.code ? ` (${currentTenant.code})` : ""}`
              : "Đang tải..."
          }
          disabled
          className="bg-muted text-muted-foreground cursor-not-allowed"
          placeholder="Thông tin đơn vị sẽ được tự động điền"
        />
        <p className="text-xs text-muted-foreground">
          Thiết bị sẽ thuộc về đơn vị hiện tại của bạn (không thể thay đổi)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model</FormLabel>
              <FormControl>
                <Input {...field} />
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
                <Input {...field} />
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
              <Input placeholder="VD: LH-2024-001" {...field} />
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
                <Input {...field} />
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
                <Input {...field} />
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

/** Renders date and finance fields in the add-equipment form. */
export function AddEquipmentDateFinanceSection() {
  const form = useFormContext<AddEquipmentFormValues>()

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
              <Input placeholder="DD/MM/YYYY" {...field} value={field.value ?? ""} />
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
                <Input {...field} />
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
                placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY"
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

/** Renders configuration, accessories, and notes fields in the add form. */
export function AddEquipmentAdditionalDetailsSection() {
  const form = useFormContext<AddEquipmentFormValues>()

  return (
    <>
      <FormField
        control={form.control}
        name="cau_hinh_thiet_bi"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cấu hình thiết bị</FormLabel>
            <FormControl>
              <Textarea rows={4} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="phu_kien_kem_theo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phụ kiện kèm theo</FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="ghi_chu"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ghi chú</FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
