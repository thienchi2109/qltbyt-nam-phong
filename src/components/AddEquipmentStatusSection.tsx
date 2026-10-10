"use client"
import { useFormContext } from "react-hook-form"
import { RequiredFormLabel } from "@/components/ui/required-form-label"
import { Badge } from "@/components/ui/badge"
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEquipmentStatusCatalog } from "@/hooks/use-equipment-status-catalog"
import type { AddEquipmentFormValues } from "./add-equipment-dialog.schema"

/** Renders department assignment and status fields in the add-equipment form. */
export function AddEquipmentAssignmentSection({ departments }: { departments: string[] }) {
  const form = useFormContext<AddEquipmentFormValues>()
  const statusCatalog = useEquipmentStatusCatalog()

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
                <Input {...field} placeholder="Nhập hoặc chọn khoa/phòng" />
              </FormControl>
              <ScrollArea className="h-20 w-full rounded-md border p-2 mt-2">
                <div className="flex flex-wrap gap-2">
                  {departments.map((dep) => (
                    <Badge
                      key={dep}
                      variant="outline"
                      className="cursor-pointer hover:bg-blue-100 hover:border-blue-500 hover:text-blue-800"
                      onClick={() =>
                        form.setValue("khoa_phong_quan_ly", dep, { shouldValidate: true })
                      }
                    >
                      {dep}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
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
                <Input {...field} />
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
            <RequiredFormLabel required>Người trực tiếp quản lý (sử dụng)</RequiredFormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="tinh_trang_hien_tai"
        render={({ field }) => (
          <FormItem>
            <RequiredFormLabel required>Tình trạng hiện tại</RequiredFormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tình trạng" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {statusCatalog.activeValues.map((status) => (
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
    </>
  )
}
