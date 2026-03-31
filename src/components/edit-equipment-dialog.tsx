"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { RequiredFormLabel } from "@/components/ui/required-form-label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { type Equipment } from "@/types/database"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useQueryClient } from "@tanstack/react-query"
import { useDecommissionDateAutofill } from "@/components/equipment-decommission-form"
import { equipmentStatusOptions } from "@/components/equipment/equipment-table-columns"
import {
  equipmentToFormValues,
} from "@/components/equipment-edit/EquipmentEditFormDefaults"
import {
  equipmentFormSchema,
  type EquipmentFormValues,
} from "@/components/equipment-edit/EquipmentEditTypes"
import { useEquipmentEditUpdate } from "@/components/equipment-edit/useEquipmentEditUpdate"

interface EditEquipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  equipment: Equipment | null
}

export function EditEquipmentDialog({ open, onOpenChange, onSuccess, equipment }: EditEquipmentDialogProps) {
  const queryClient = useQueryClient()

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {},
  })

  useDecommissionDateAutofill({
    control: form.control,
    setValue: form.setValue,
    initialStatus: equipment?.tinh_trang_hien_tai ?? null,
  })

  React.useEffect(() => {
    if (!open) {
      form.reset(equipmentToFormValues(null))
      return
    }

    form.reset(equipmentToFormValues(equipment))
  }, [equipment, form, open])

  const { updateEquipment, isPending } = useEquipmentEditUpdate({
    successMessage: "Đã cập nhật thông tin thiết bị.",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment_list"] })
      onSuccess()
      onOpenChange(false)
    },
  })

  async function onSubmit(values: EquipmentFormValues) {
    if (!equipment) return
    try {
      await updateEquipment({ id: equipment.id, patch: values })
    } catch {
      // The mutation toast is handled in onError; avoid leaking a rejected promise from the submit handler.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Sửa thông tin thiết bị</DialogTitle>
          <DialogDescription>
            Chỉnh sửa các thông tin bên dưới. Nhấn lưu để hoàn tất.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] pr-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="ma_thiet_bi"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Mã thiết bị</FormLabel>
                        <FormControl>
                            <Input placeholder="VD: EQP-001" {...field} value={field.value ?? ''} />
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
                            <Input placeholder="VD: Máy siêu âm" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="model" render={({ field }) => (
                        <FormItem><FormLabel>Model</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="serial" render={({ field }) => (
                        <FormItem><FormLabel>Serial</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="so_luu_hanh" render={({ field }) => (
                    <FormItem><FormLabel>Số lưu hành</FormLabel><FormControl><Input placeholder="VD: LH-2024-001" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="hang_san_xuat" render={({ field }) => (
                        <FormItem><FormLabel>Hãng sản xuất</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="noi_san_xuat" render={({ field }) => (
                        <FormItem><FormLabel>Nơi sản xuất</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <FormField control={form.control} name="nam_san_xuat" render={({ field }) => (
                    <FormItem><FormLabel>Năm sản xuất</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={event => field.onChange(event.target.value === '' ? null : +event.target.value)} /></FormControl><FormMessage /></FormItem>
                )} />

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="ngay_nhap" render={({ field }) => (
                        <FormItem><FormLabel>Ngày nhập</FormLabel><FormControl><Input placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="ngay_dua_vao_su_dung" render={({ field }) => (
                        <FormItem><FormLabel>Ngày đưa vào sử dụng</FormLabel><FormControl><Input placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="ngay_ngung_su_dung" render={({ field }) => (
                    <FormItem><FormLabel>Ngày ngừng sử dụng</FormLabel><FormControl><Input placeholder="DD/MM/YYYY" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="nguon_kinh_phi" render={({ field }) => (
                        <FormItem><FormLabel>Nguồn kinh phí</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="gia_goc" render={({ field }) => (
                        <FormItem><FormLabel>Giá gốc (VNĐ)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={event => field.onChange(event.target.value === '' ? null : +event.target.value)}/></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                
                <FormField control={form.control} name="han_bao_hanh" render={({ field }) => (
                    <FormItem><FormLabel>Hạn bảo hành</FormLabel><FormControl><Input placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="khoa_phong_quan_ly" render={({ field }) => (
                        <FormItem><RequiredFormLabel required>Khoa/Phòng quản lý</RequiredFormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="vi_tri_lap_dat" render={({ field }) => (
                        <FormItem><RequiredFormLabel required>Vị trí lắp đặt</RequiredFormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <FormField control={form.control} name="nguoi_dang_truc_tiep_quan_ly" render={({ field }) => (
                    <FormItem><RequiredFormLabel required>Người trực tiếp quản lý (sử dụng)</RequiredFormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
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
                            {equipmentStatusOptions.map(status => (
                                <SelectItem key={status!} value={status!}>
                                {status}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField control={form.control} name="cau_hinh_thiet_bi" render={({ field }) => (
                    <FormItem><FormLabel>Cấu hình thiết bị</FormLabel><FormControl><Textarea rows={4} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phu_kien_kem_theo" render={({ field }) => (
                    <FormItem><FormLabel>Phụ kiện kèm theo</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="ghi_chu" render={({ field }) => (
                    <FormItem><FormLabel>Ghi chú</FormLabel><FormControl><Textarea rows={3} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
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
                            {['A', 'B', 'C', 'D'].map(type => (
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
            <DialogFooter className="pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Hủy
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
