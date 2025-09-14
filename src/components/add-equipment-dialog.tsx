"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
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
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { type Equipment } from "@/types/database"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

const equipmentStatusOptions = [
    "Hoạt động", 
    "Chờ sửa chữa", 
    "Chờ bảo trì", 
    "Chờ hiệu chuẩn/kiểm định", 
    "Ngưng sử dụng", 
    "Chưa có nhu cầu sử dụng"
] as const;


const equipmentFormSchema = z.object({
  ma_thiet_bi: z.string().min(1, "Mã thiết bị là bắt buộc"),
  ten_thiet_bi: z.string().min(1, "Tên thiết bị là bắt buộc"),
  model: z.string().optional(),
  serial: z.string().optional(),
  hang_san_xuat: z.string().optional(),
  noi_san_xuat: z.string().optional(),
  nam_san_xuat: z.coerce.number().optional().nullable(),
  ngay_nhap: z.string().optional(),
  ngay_dua_vao_su_dung: z.string().optional(),
  nguon_kinh_phi: z.string().optional(),
  gia_goc: z.coerce.number().optional().nullable(),
  han_bao_hanh: z.string().optional(),
  vi_tri_lap_dat: z.string().min(1, "Vị trí lắp đặt là bắt buộc"),
  khoa_phong_quan_ly: z.string().min(1, "Khoa/Phòng quản lý là bắt buộc"),
  nguoi_dang_truc_tiep_quan_ly: z.string().min(1, "Người trực tiếp quản lý (sử dụng) là bắt buộc"),
  tinh_trang_hien_tai: z.enum(equipmentStatusOptions, { required_error: "Tình trạng hiện tại là bắt buộc" }),
  cau_hinh_thiet_bi: z.string().optional(),
  phu_kien_kem_theo: z.string().optional(),
  ghi_chu: z.string().optional(),
});

type EquipmentFormValues = z.infer<typeof equipmentFormSchema>

interface AddEquipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddEquipmentDialog({ open, onOpenChange, onSuccess }: AddEquipmentDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [departments, setDepartments] = React.useState<string[]>([])
  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      ma_thiet_bi: "",
      ten_thiet_bi: "",
      model: "",
      serial: "",
      hang_san_xuat: "",
      noi_san_xuat: "",
      nam_san_xuat: null,
      ngay_nhap: "",
      ngay_dua_vao_su_dung: "",
      nguon_kinh_phi: "",
      gia_goc: null,
      han_bao_hanh: "",
      vi_tri_lap_dat: "",
      khoa_phong_quan_ly: "",
      nguoi_dang_truc_tiep_quan_ly: "",
      tinh_trang_hien_tai: "" as any,
      cau_hinh_thiet_bi: "",
      phu_kien_kem_theo: "",
      ghi_chu: "",
    },
  })

  React.useEffect(() => {
    if (open) {
      fetchDepartments();
    } else {
      form.reset();
    }
  }, [open, form])

  const fetchDepartments = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('thiet_bi')
        .select('khoa_phong_quan_ly')
        .not('khoa_phong_quan_ly', 'is', null);

      if (error) throw error;
      
      const uniqueDepartments = Array.from(new Set(data.map(item => item.khoa_phong_quan_ly).filter(Boolean)));
      setDepartments(uniqueDepartments.sort());
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi tải danh sách khoa phòng",
        description: error.message,
      });
    }
  };

  async function onSubmit(values: EquipmentFormValues) {
    setIsSubmitting(true)
    if (!supabase) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Lỗi kết nối cơ sở dữ liệu."
      })
      setIsSubmitting(false);
      return;
    }
    try {
      const { error } = await supabase.from("thiet_bi").insert([values])

      if (error) {
        throw error
      }

      toast({
        title: "Thành công",
        description: "Đã thêm thiết bị mới vào danh mục.",
      })
      onSuccess()
      onOpenChange(false)
      form.reset()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể thêm thiết bị. " + error.message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Thêm thiết bị mới</DialogTitle>
          <DialogDescription>
            Điền các thông tin chi tiết cho thiết bị. Nhấn lưu để hoàn tất.
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="model" render={({ field }) => (
                        <FormItem><FormLabel>Model</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="serial" render={({ field }) => (
                        <FormItem><FormLabel>Serial</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="hang_san_xuat" render={({ field }) => (
                        <FormItem><FormLabel>Hãng sản xuất</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="noi_san_xuat" render={({ field }) => (
                        <FormItem><FormLabel>Nơi sản xuất</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <FormField control={form.control} name="nam_san_xuat" render={({ field }) => (
                    <FormItem><FormLabel>Năm sản xuất</FormLabel><FormControl><Input 
                        type="number" 
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={event => {
                            const val = parseInt(event.target.value, 10);
                            field.onChange(isNaN(val) ? null : val);
                        }} 
                    /></FormControl><FormMessage /></FormItem>
                )} />

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="ngay_nhap" render={({ field }) => (
                        <FormItem><FormLabel>Ngày nhập</FormLabel><FormControl><Input placeholder="DD/MM/YYYY" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="ngay_dua_vao_su_dung" render={({ field }) => (
                        <FormItem><FormLabel>Ngày đưa vào sử dụng</FormLabel><FormControl><Input placeholder="DD/MM/YYYY" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="nguon_kinh_phi" render={({ field }) => (
                        <FormItem><FormLabel>Nguồn kinh phí</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="gia_goc" render={({ field }) => (
                        <FormItem><FormLabel>Giá gốc (VNĐ)</FormLabel><FormControl><Input 
                            type="number" 
                            {...field} 
                            value={field.value ?? ''}
                            onChange={event => {
                                const val = parseInt(event.target.value, 10);
                                field.onChange(isNaN(val) ? null : val);
                            }}
                        /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                
                <FormField control={form.control} name="han_bao_hanh" render={({ field }) => (
                    <FormItem><FormLabel>Hạn bảo hành</FormLabel><FormControl><Input placeholder="DD/MM/YYYY" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="khoa_phong_quan_ly"
                      render={({ field }) => (
                        <FormItem>
                          <RequiredFormLabel required>Khoa/Phòng quản lý</RequiredFormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nhập hoặc chọn khoa/phòng"/>
                          </FormControl>
                          <ScrollArea className="h-20 w-full rounded-md border p-2 mt-2">
                            <div className="flex flex-wrap gap-2">
                              {departments.map((dep) => (
                                <Badge
                                  key={dep}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-blue-100 hover:border-blue-500 hover:text-blue-800"
                                  onClick={() => form.setValue("khoa_phong_quan_ly", dep, { shouldValidate: true })}
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
                    <FormField control={form.control} name="vi_tri_lap_dat" render={({ field }) => (
                        <FormItem><RequiredFormLabel required>Vị trí lắp đặt</RequiredFormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <FormField control={form.control} name="nguoi_dang_truc_tiep_quan_ly" render={({ field }) => (
                    <FormItem><RequiredFormLabel required>Người trực tiếp quản lý (sử dụng)</RequiredFormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
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
                            {equipmentStatusOptions.map(status => (
                                <SelectItem key={status} value={status!}>
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
                    <FormItem><FormLabel>Cấu hình thiết bị</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phu_kien_kem_theo" render={({ field }) => (
                    <FormItem><FormLabel>Phụ kiện kèm theo</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="ghi_chu" render={({ field }) => (
                    <FormItem><FormLabel>Ghi chú</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                )} />

              </div>
            </ScrollArea>
            <DialogFooter className="pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thiết bị
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
