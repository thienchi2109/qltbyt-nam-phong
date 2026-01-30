"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"

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
import { type Equipment } from "@/types/database"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { normalizePartialDateForForm, isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE } from "@/lib/date-utils"

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
  so_luu_hanh: z.string().optional(),
  hang_san_xuat: z.string().optional(),
  noi_san_xuat: z.string().optional(),
  nam_san_xuat: z.coerce.number().optional().nullable(),
  ngay_nhap: z.string().optional().nullable().refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE).transform(normalizePartialDateForForm),
  ngay_dua_vao_su_dung: z.string().optional().nullable().refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE).transform(normalizePartialDateForForm),
  nguon_kinh_phi: z.string().optional(),
  gia_goc: z.coerce.number().optional().nullable(),
  han_bao_hanh: z.string().optional().nullable().refine(isValidPartialDate, PARTIAL_DATE_ERROR_MESSAGE).transform(normalizePartialDateForForm),
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
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as any
  const isRegionalLeader = (user?.role ?? '') === 'regional_leader'
  const isGlobal = user?.role === 'global' || user?.role === 'admin'
  
  // Use TanStack Query for departments with proper caching
  const { data: departments = [] } = useQuery({
    queryKey: ['departments_list'],
    queryFn: async () => {
      const list = await callRpc<{ name: string }[]>({ fn: 'departments_list', args: {} })
      return (list || []).map(x => x.name).filter(Boolean)
    },
    enabled: open, // Only fetch when dialog is open
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
  
  // Use TanStack Query for tenants with proper caching
  const { data: tenantList = [] } = useQuery({
    queryKey: ['tenant_list'],
    queryFn: async () => {
      const list = await callRpc<any[]>({ fn: 'tenant_list', args: {} })
      return (list || []).map(t => ({ id: t.id, code: t.code, name: t.name }))
    },
    enabled: open, // Fetch for all users when dialog is open (needed to display current tenant)
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
  
  // Find current user's tenant
  const currentTenant = React.useMemo(() => {
    const userDonVi = user?.don_vi
    if (!userDonVi) return null
    if (!tenantList.length) return null
    return tenantList.find(t => t.id === Number(userDonVi)) || null
  }, [user?.don_vi, tenantList])
  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      ma_thiet_bi: "",
      ten_thiet_bi: "",
      model: "",
      serial: "",
      so_luu_hanh: "",
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
    if (!open) {
      form.reset();
    }
  }, [open, form])

  const createMutation = useMutation({
    mutationFn: async (payload: EquipmentFormValues) => {
      await callRpc<any>({ fn: 'equipment_create', args: { p_payload: payload as any } })
    },
    onSuccess: () => {
      toast({ title: 'Thành công', description: 'Đã thêm thiết bị mới vào danh mục.' })
      // Invalidate all equipment-related queries to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: ['equipment_list'] })
      queryClient.invalidateQueries({ queryKey: ['equipment_list_enhanced'] })
      // Also invalidate equipment count and stats if they exist
      queryClient.invalidateQueries({ queryKey: ['equipment_count'] })
      queryClient.invalidateQueries({ queryKey: ['equipment_count_enhanced'] })
      onSuccess()
      onOpenChange(false)
      form.reset()
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể thêm thiết bị. ' + (error?.message || '') })
    },
  })

  async function onSubmit(values: EquipmentFormValues) {
    if (isRegionalLeader) {
      toast({
        variant: "destructive",
        title: "Không có quyền",
        description: "Tài khoản khu vực chỉ được phép xem dữ liệu thiết bị.",
      })
      return
    }
    await createMutation.mutateAsync(values)
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
                
                {/* Read-only Đơn vị field */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Đơn vị</Label>
                  <Input 
                    value={currentTenant ? `${currentTenant.name}${currentTenant.code ? ` (${currentTenant.code})` : ''}` : 'Đang tải...'}
                    disabled
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                    placeholder="Thông tin đơn vị sẽ được tự động điền"
                  />
                  <p className="text-xs text-muted-foreground">
                    Thiết bị sẽ thuộc về đơn vị hiện tại của bạn (không thể thay đổi)
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="model" render={({ field }) => (
                        <FormItem><FormLabel>Model</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="serial" render={({ field }) => (
                        <FormItem><FormLabel>Serial</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="so_luu_hanh" render={({ field }) => (
                    <FormItem><FormLabel>Số lưu hành</FormLabel><FormControl><Input placeholder="VD: LH-2024-001" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
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
                        <FormItem><FormLabel>Ngày nhập</FormLabel><FormControl><Input placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="ngay_dua_vao_su_dung" render={({ field }) => (
                        <FormItem><FormLabel>Ngày đưa vào sử dụng</FormLabel><FormControl><Input placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
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
                    <FormItem><FormLabel>Hạn bảo hành</FormLabel><FormControl><Input placeholder="DD/MM/YYYY hoặc MM/YYYY hoặc YYYY" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
                Hủy
              </Button>
              <Button type="submit" disabled={createMutation.isPending || isRegionalLeader}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
