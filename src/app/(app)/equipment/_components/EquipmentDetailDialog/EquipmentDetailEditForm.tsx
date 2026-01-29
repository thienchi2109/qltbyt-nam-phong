/**
 * Edit form for equipment details
 * Uses useFormContext to access form from parent FormProvider
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailEditForm
 */

"use client"

import * as React from "react"
import { useFormContext } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { RequiredFormLabel } from "@/components/ui/required-form-label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { equipmentStatusOptions } from "@/components/equipment/equipment-table-columns"
import type { EquipmentFormValues } from "./EquipmentDetailTypes"

const CLASSIFICATION_OPTIONS = ["A", "B", "C", "D"] as const

export interface EquipmentDetailEditFormProps {
  formId: string
  onSubmit: (values: EquipmentFormValues) => void
}

export function EquipmentDetailEditForm({
  formId,
  onSubmit,
}: EquipmentDetailEditFormProps): React.ReactNode {
  const form = useFormContext<EquipmentFormValues>()

  return (
    <form
      id={formId}
      className="h-full flex flex-col overflow-hidden"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4 py-4">
          {/* Equipment ID and Name */}
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

          {/* Model and Serial */}
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

          {/* Marketing Authorization Number */}
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

          {/* Manufacturer */}
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

          {/* Year of manufacture */}
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
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === "" ? null : +event.target.value
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="ngay_nhap"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày nhập</FormLabel>
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
            <FormField
              control={form.control}
              name="ngay_dua_vao_su_dung"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày đưa vào sử dụng</FormLabel>
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
          </div>

          {/* Funding and Price */}
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
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === "" ? null : +event.target.value
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Warranty */}
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

          {/* Department and Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="khoa_phong_quan_ly"
              render={({ field }) => (
                <FormItem>
                  <RequiredFormLabel required>
                    Khoa/Phòng quản lý
                  </RequiredFormLabel>
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

          {/* Person in charge */}
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

          {/* Status */}
          <FormField
            control={form.control}
            name="tinh_trang_hien_tai"
            render={({ field }) => (
              <FormItem>
                <RequiredFormLabel required>
                  Tình trạng hiện tại
                </RequiredFormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? undefined}
                >
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

          {/* Configuration */}
          <FormField
            control={form.control}
            name="cau_hinh_thiet_bi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cấu hình thiết bị</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Accessories */}
          <FormField
            control={form.control}
            name="phu_kien_kem_theo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phụ kiện kèm theo</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Notes */}
          <FormField
            control={form.control}
            name="ghi_chu"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ghi chú</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Classification */}
          <FormField
            control={form.control}
            name="phan_loai_theo_nd98"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phân loại TB theo NĐ 98</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? undefined}
                >
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
        </div>
      </ScrollArea>
    </form>
  )
}
