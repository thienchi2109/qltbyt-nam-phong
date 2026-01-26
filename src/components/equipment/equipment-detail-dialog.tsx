/**
 * equipment-detail-dialog.tsx
 *
 * Full-screen dialog for viewing and editing equipment details.
 * Contains tabs: Details, Attachments, History, Usage.
 * Includes inline edit form, attachment management, and history timeline.
 */

"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  Edit,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Printer,
  QrCode,
  Trash2,
} from "lucide-react"

import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { RequiredFormLabel } from "@/components/ui/required-form-label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { UsageHistoryTab } from "@/components/usage-history-tab"
import {
  columnLabels,
  equipmentStatusOptions,
  getStatusVariant,
  getClassificationVariant,
} from "@/components/equipment/equipment-table-columns"
import {
  isSuspiciousDate,
  SUSPICIOUS_DATE_WARNING,
  TEXT_DATE_FIELDS,
} from "@/lib/date-utils"
import type { Equipment } from "@/types/database"
import type { Attachment, HistoryItem } from "@/app/(app)/equipment/types"
import {
  equipmentFormSchema,
  type EquipmentFormValues,
  type UserSession,
  getHistoryIcon,
} from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailTypes"

export interface EquipmentDetailDialogProps {
  equipment: Equipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserSession | null
  isRegionalLeader: boolean
  onGenerateProfileSheet: (equipment: Equipment) => void
  onGenerateDeviceLabel: (equipment: Equipment) => void
  onEquipmentUpdated: () => void
}

export function EquipmentDetailDialog({
  equipment,
  open,
  onOpenChange,
  user,
  isRegionalLeader,
  onGenerateProfileSheet,
  onGenerateDeviceLabel,
  onEquipmentUpdated,
}: EquipmentDetailDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Internal state
  const [currentTab, setCurrentTab] = React.useState<string>("details")
  const [isEditingDetails, setIsEditingDetails] = React.useState(false)
  const [newFileName, setNewFileName] = React.useState("")
  const [newFileUrl, setNewFileUrl] = React.useState("")
  const [deletingAttachmentId, setDeletingAttachmentId] = React.useState<string | null>(null)
  // Store saved values to display after save (equipment prop is stale until dialog reopens)
  const [savedValues, setSavedValues] = React.useState<Partial<EquipmentFormValues> | null>(null)

  // Form
  const editForm = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      ma_thiet_bi: "",
      ten_thiet_bi: "",
      vi_tri_lap_dat: "",
      khoa_phong_quan_ly: "",
      nguoi_dang_truc_tiep_quan_ly: "",
      tinh_trang_hien_tai: "" as any,
      model: null,
      serial: null,
      hang_san_xuat: null,
      noi_san_xuat: null,
      nguon_kinh_phi: null,
      cau_hinh_thiet_bi: null,
      phu_kien_kem_theo: null,
      ghi_chu: null,
      ngay_nhap: null,
      ngay_dua_vao_su_dung: null,
      han_bao_hanh: null,
      ngay_bt_tiep_theo: null,
      ngay_hc_tiep_theo: null,
      ngay_kd_tiep_theo: null,
      nam_san_xuat: null,
      gia_goc: null,
      chu_ky_bt_dinh_ky: null,
      chu_ky_hc_dinh_ky: null,
      chu_ky_kd_dinh_ky: null,
      phan_loai_theo_nd98: null,
    },
  })

  // Track previous equipment ID to only reset form when viewing different equipment
  const prevEquipmentIdRef = React.useRef<number | null>(null)

  // Clear state when dialog closes to ensure fresh data on reopen
  React.useEffect(() => {
    if (!open) {
      prevEquipmentIdRef.current = null
      setSavedValues(null)
    }
  }, [open])

  // Reset form only when equipment ID changes (new equipment loaded)
  // This prevents form reset when toggling edit mode, preserving user edits after save
  React.useEffect(() => {
    if (equipment && equipment.id !== prevEquipmentIdRef.current) {
      prevEquipmentIdRef.current = equipment.id
      editForm.reset({
        ma_thiet_bi: equipment.ma_thiet_bi || "",
        ten_thiet_bi: equipment.ten_thiet_bi || "",
        vi_tri_lap_dat: equipment.vi_tri_lap_dat || "",
        khoa_phong_quan_ly: equipment.khoa_phong_quan_ly || "",
        nguoi_dang_truc_tiep_quan_ly: equipment.nguoi_dang_truc_tiep_quan_ly || "",
        tinh_trang_hien_tai: equipment.tinh_trang_hien_tai || ("" as any),
        model: equipment.model || null,
        serial: equipment.serial || null,
        hang_san_xuat: equipment.hang_san_xuat || null,
        noi_san_xuat: equipment.noi_san_xuat || null,
        nguon_kinh_phi: equipment.nguon_kinh_phi || null,
        cau_hinh_thiet_bi: equipment.cau_hinh_thiet_bi || null,
        phu_kien_kem_theo: equipment.phu_kien_kem_theo || null,
        ghi_chu: equipment.ghi_chu || null,
        ngay_nhap: equipment.ngay_nhap || null,
        ngay_dua_vao_su_dung: equipment.ngay_dua_vao_su_dung || null,
        han_bao_hanh: equipment.han_bao_hanh || null,
        ngay_bt_tiep_theo: (equipment as any).ngay_bt_tiep_theo || null,
        ngay_hc_tiep_theo: (equipment as any).ngay_hc_tiep_theo || null,
        ngay_kd_tiep_theo: (equipment as any).ngay_kd_tiep_theo || null,
        nam_san_xuat: equipment.nam_san_xuat || null,
        gia_goc: equipment.gia_goc || null,
        chu_ky_bt_dinh_ky: (equipment as any).chu_ky_bt_dinh_ky || null,
        chu_ky_hc_dinh_ky: (equipment as any).chu_ky_hc_dinh_ky || null,
        chu_ky_kd_dinh_ky: (equipment as any).chu_ky_kd_dinh_ky || null,
        phan_loai_theo_nd98:
          equipment.phan_loai_theo_nd98 &&
          ["A", "B", "C", "D"].includes(String(equipment.phan_loai_theo_nd98).toUpperCase())
            ? (String(equipment.phan_loai_theo_nd98).toUpperCase() as "A" | "B" | "C" | "D")
            : null,
      })
    }
  }, [equipment, editForm])

  // Data queries
  const attachmentsQuery = useQuery({
    queryKey: ["attachments", equipment?.id],
    queryFn: async () => {
      const data = await callRpc<any[]>({
        fn: "equipment_attachments_list",
        args: { p_thiet_bi_id: equipment!.id },
      })
      return data || []
    },
    enabled: !!equipment && open,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  })

  const historyQuery = useQuery({
    queryKey: ["history", equipment?.id],
    queryFn: async () => {
      const data = await callRpc<any[]>({
        fn: "equipment_history_list",
        args: { p_thiet_bi_id: equipment!.id },
      })
      return (data || []) as HistoryItem[]
    },
    enabled: !!equipment && open,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  })

  const attachments = (attachmentsQuery.data ?? []) as Attachment[]
  const isLoadingAttachments = attachmentsQuery.isLoading
  const history = (historyQuery.data ?? []) as HistoryItem[]
  const isLoadingHistory = historyQuery.isLoading

  // Mutations
  const updateEquipmentMutation = useMutation({
    mutationFn: async (vars: { id: number; patch: Partial<EquipmentFormValues> }) => {
      await callRpc<void>({
        fn: "equipment_update",
        args: { p_id: vars.id, p_patch: vars.patch },
      })
      return vars.patch // Return patch for use in onSuccess
    },
    onSuccess: (savedPatch) => {
      toast({ title: "Thành công", description: "Đã cập nhật thiết bị." })
      // Store saved values to display in detail view
      setSavedValues((prev) => ({ ...prev, ...savedPatch }))
      setIsEditingDetails(false)
      onEquipmentUpdated()
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể cập nhật thiết bị. " + (error?.message || ""),
      })
    },
  })

  const addAttachmentMutation = useMutation({
    mutationFn: async (vars: { id: number; name: string; url: string }) => {
      await callRpc<string>({
        fn: "equipment_attachment_create",
        args: { p_thiet_bi_id: vars.id, p_ten_file: vars.name, p_duong_dan: vars.url },
      })
    },
    onSuccess: (_res, vars) => {
      toast({ title: "Thành công", description: "Đã thêm liên kết mới." })
      setNewFileName("")
      setNewFileUrl("")
      queryClient.invalidateQueries({ queryKey: ["attachments", vars.id] })
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Lỗi thêm liên kết", description: error?.message })
    },
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (vars: { attachmentId: string }) => {
      await callRpc<void>({
        fn: "equipment_attachment_delete",
        args: { p_id: String(vars.attachmentId) },
      })
    },
    onSuccess: async () => {
      toast({ title: "Đã xóa", description: "Đã xóa liên kết thành công." })
      if (equipment) {
        await queryClient.invalidateQueries({ queryKey: ["attachments", equipment.id] })
      }
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Lỗi xóa liên kết", description: error?.message })
    },
  })

  // Handlers
  const onSubmitInlineEdit = async (values: EquipmentFormValues) => {
    if (!equipment) return
    await updateEquipmentMutation.mutateAsync({ id: equipment.id, patch: values })
  }

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFileName || !newFileUrl || !equipment) return

    try {
      new URL(newFileUrl)
    } catch (_) {
      toast({
        variant: "destructive",
        title: "URL không hợp lệ",
        description: "Vui lòng nhập một đường dẫn URL hợp lệ.",
      })
      return
    }

    await addAttachmentMutation.mutateAsync({ id: equipment.id, name: newFileName, url: newFileUrl })
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!equipment || deletingAttachmentId) return
    if (!confirm("Bạn có chắc chắn muốn xóa file đính kèm này không?")) return
    setDeletingAttachmentId(attachmentId)
    try {
      await deleteAttachmentMutation.mutateAsync({ attachmentId })
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  const handleDialogOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        onOpenChange(true)
        return
      }
      if (isEditingDetails && editForm.formState.isDirty) {
        const ok = confirm("Bạn có chắc muốn đóng? Các thay đổi chưa lưu sẽ bị mất.")
        if (!ok) return
      }
      setIsEditingDetails(false)
      onOpenChange(false)
    },
    [isEditingDetails, editForm.formState.isDirty, onOpenChange]
  )

  const requestClose = React.useCallback(() => handleDialogOpenChange(false), [handleDialogOpenChange])

  // Merge equipment prop with saved values for display
  // After save, savedValues contains updated data while equipment prop is stale
  const displayEquipment = React.useMemo(() => {
    if (!equipment) return null
    if (!savedValues) return equipment
    return {
      ...equipment,
      ...savedValues,
    } as Equipment
  }, [equipment, savedValues])

  // RBAC check
  const canEdit =
    user &&
    (user.role === "global" ||
      user.role === "admin" ||
      user.role === "to_qltb" ||
      (user.role === "qltb_khoa" && user.khoa_phong === equipment?.khoa_phong_quan_ly))

  if (!equipment) return null

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Chi tiết thiết bị: {equipment.ten_thiet_bi}</DialogTitle>
          <DialogDescription>Mã thiết bị: {equipment.ma_thiet_bi}</DialogDescription>
        </DialogHeader>
        <Tabs
          value={currentTab}
          onValueChange={setCurrentTab}
          className="flex-grow flex flex-col overflow-hidden"
        >
          <TabsList className="shrink-0">
            <TabsTrigger value="details">Thông tin chi tiết</TabsTrigger>
            <TabsTrigger value="files">File đính kèm</TabsTrigger>
            <TabsTrigger value="history">Lịch sử</TabsTrigger>
            <TabsTrigger value="usage">Nhật ký sử dụng</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-grow overflow-hidden">
            {isEditingDetails ? (
              <Form {...editForm}>
                <form
                  id="equipment-inline-edit-form"
                  className="h-full flex flex-col overflow-hidden"
                  onSubmit={editForm.handleSubmit(onSubmitInlineEdit)}
                >
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="ma_thiet_bi"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mã thiết bị</FormLabel>
                              <FormControl>
                                <Input placeholder="VD: EQP-001" {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editForm.control}
                          name="ten_thiet_bi"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tên thiết bị</FormLabel>
                              <FormControl>
                                <Input placeholder="VD: Máy siêu âm" {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
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
                          control={editForm.control}
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
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
                          control={editForm.control}
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
                        control={editForm.control}
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
                                  field.onChange(event.target.value === "" ? null : +event.target.value)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="ngay_nhap"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ngày nhập</FormLabel>
                              <FormControl>
                                <Input placeholder="DD/MM/YYYY" {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editForm.control}
                          name="ngay_dua_vao_su_dung"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ngày đưa vào sử dụng</FormLabel>
                              <FormControl>
                                <Input placeholder="DD/MM/YYYY" {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
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
                          control={editForm.control}
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
                                    field.onChange(event.target.value === "" ? null : +event.target.value)
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={editForm.control}
                        name="han_bao_hanh"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hạn bảo hành</FormLabel>
                            <FormControl>
                              <Input placeholder="DD/MM/YYYY" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
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
                          control={editForm.control}
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
                        control={editForm.control}
                        name="nguoi_dang_truc_tiep_quan_ly"
                        render={({ field }) => (
                          <FormItem>
                            <RequiredFormLabel required>Người trực tiếp quản lý (sử dụng)</RequiredFormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
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

                      <FormField
                        control={editForm.control}
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
                      <FormField
                        control={editForm.control}
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
                      <FormField
                        control={editForm.control}
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

                      <FormField
                        control={editForm.control}
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
                                {["A", "B", "C", "D"].map((type) => (
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
              </Form>
            ) : (
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 py-4">
                  {(Object.keys(columnLabels) as Array<keyof Equipment>).map((key) => {
                    if (key === "id") return null

                    const renderValue = () => {
                      const value = displayEquipment?.[key]
                      if (key === "tinh_trang_hien_tai") {
                        const statusValue = value as Equipment["tinh_trang_hien_tai"]
                        return statusValue ? (
                          <Badge variant={getStatusVariant(statusValue)}>{statusValue}</Badge>
                        ) : (
                          <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
                        )
                      }
                      if (key === "phan_loai_theo_nd98") {
                        const classification = value as Equipment["phan_loai_theo_nd98"]
                        return classification ? (
                          <Badge variant={getClassificationVariant(classification)}>
                            {classification.trim()}
                          </Badge>
                        ) : (
                          <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
                        )
                      }
                      if (key === "gia_goc") {
                        return value ? (
                          `${Number(value).toLocaleString()} đ`
                        ) : (
                          <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
                        )
                      }
                      // TEXT date fields that may contain suspicious dates from Excel import
                      if (TEXT_DATE_FIELDS.has(key)) {
                        if (value === null || value === undefined || value === "") {
                          return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
                        }
                        const dateStr = String(value)
                        if (isSuspiciousDate(dateStr)) {
                          return (
                            <div className="flex items-center gap-2">
                              <span>{dateStr}</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center">
                                      <AlertTriangle className="h-4 w-4 text-amber-500 cursor-help" aria-hidden="true" />
                                      <span className="sr-only">{SUSPICIOUS_DATE_WARNING}</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>{SUSPICIOUS_DATE_WARNING}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )
                        }
                        return dateStr
                      }
                      if (value === null || value === undefined || value === "") {
                        return <div className="italic text-muted-foreground">Chưa có dữ liệu</div>
                      }
                      return String(value)
                    }

                    return (
                      <div key={key} className="border-b pb-2">
                        <p className="text-xs font-medium text-muted-foreground">{columnLabels[key]}</p>
                        <div className="font-semibold break-words">{renderValue()}</div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="flex-grow overflow-hidden">
            <div className="h-full flex flex-col gap-4 py-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Thêm file đính kèm mới</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddAttachment} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="file-name">Tên file</Label>
                      <Input
                        id="file-name"
                        placeholder="VD: Giấy chứng nhận hiệu chuẩn"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        required
                        disabled={addAttachmentMutation.isPending}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="file-url">Đường dẫn (URL)</Label>
                      <Input
                        id="file-url"
                        type="url"
                        placeholder="https://..."
                        value={newFileUrl}
                        onChange={(e) => setNewFileUrl(e.target.value)}
                        required
                        disabled={addAttachmentMutation.isPending}
                      />
                    </div>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Làm thế nào để lấy URL?</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <div>
                          Tải file của bạn lên thư mục Drive chia sẻ của đơn vị, sau đó lấy link chia sẻ
                          công khai và dán vào đây.
                        </div>
                        {equipment?.google_drive_folder_url && (
                          <Button type="button" variant="outline" size="sm" asChild className="mt-2">
                            <a
                              href={equipment.google_drive_folder_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Mở thư mục chung
                            </a>
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                    <Button
                      type="submit"
                      disabled={addAttachmentMutation.isPending || !newFileName || !newFileUrl}
                    >
                      {addAttachmentMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Lưu liên kết
                    </Button>
                  </form>
                </CardContent>
              </Card>
              <div className="flex-grow overflow-hidden">
                <p className="font-medium mb-2">Danh sách file đã đính kèm</p>
                <ScrollArea className="h-full pr-4">
                  {isLoadingAttachments ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : attachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-4">
                      Chưa có file nào được đính kèm.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
                        >
                          <Link
                            href={file.duong_dan_luu_tru}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:underline truncate"
                          >
                            <LinkIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{file.ten_file}</span>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteAttachment(file.id)}
                            disabled={!!deletingAttachmentId || deleteAttachmentMutation.isPending}
                          >
                            {deletingAttachmentId === file.id || deleteAttachmentMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-4 py-4">
              {isLoadingHistory ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <p className="font-semibold">Chưa có lịch sử</p>
                  <p className="text-sm">Mọi hoạt động sửa chữa, bảo trì sẽ được ghi lại tại đây.</p>
                </div>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-0 top-0 h-full w-0.5 bg-border -translate-x-1/2 ml-3"></div>
                  {history.map((item) => (
                    <div key={item.id} className="relative mb-8 last:mb-0">
                      <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-background -translate-x-1/2 ml-3"></div>
                      <div className="pl-2">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                            {getHistoryIcon(item.loai_su_kien)}
                          </div>
                          <div>
                            <p className="font-semibold">{item.loai_su_kien}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(item.ngay_thuc_hien), "dd/MM/yyyy HH:mm", { locale: vi })}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 ml-10 p-3 rounded-md bg-muted/50 border">
                          <p className="text-sm font-medium">{item.mo_ta}</p>
                          {item.chi_tiet?.mo_ta_su_co && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Sự cố: {item.chi_tiet.mo_ta_su_co}
                            </p>
                          )}
                          {item.chi_tiet?.hang_muc_sua_chua && (
                            <p className="text-sm text-muted-foreground">
                              Hạng mục: {item.chi_tiet.hang_muc_sua_chua}
                            </p>
                          )}
                          {item.chi_tiet?.nguoi_yeu_cau && (
                            <p className="text-sm text-muted-foreground">
                              Người yêu cầu: {item.chi_tiet.nguoi_yeu_cau}
                            </p>
                          )}
                          {item.chi_tiet?.ten_ke_hoach && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Kế hoạch: {item.chi_tiet.ten_ke_hoach}
                            </p>
                          )}
                          {item.chi_tiet?.thang && (
                            <p className="text-sm text-muted-foreground">
                              Tháng: {item.chi_tiet.thang}/{item.chi_tiet.nam}
                            </p>
                          )}
                          {item.chi_tiet?.ma_yeu_cau && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Mã yêu cầu: {item.chi_tiet.ma_yeu_cau}
                            </p>
                          )}
                          {item.chi_tiet?.loai_hinh && (
                            <p className="text-sm text-muted-foreground">
                              Loại hình:{" "}
                              {item.chi_tiet.loai_hinh === "noi_bo"
                                ? "Nội bộ"
                                : item.chi_tiet.loai_hinh === "ben_ngoai"
                                ? "Bên ngoài"
                                : "Thanh lý"}
                            </p>
                          )}
                          {item.chi_tiet?.khoa_phong_hien_tai && item.chi_tiet?.khoa_phong_nhan && (
                            <p className="text-sm text-muted-foreground">
                              Từ: {item.chi_tiet.khoa_phong_hien_tai} → {item.chi_tiet.khoa_phong_nhan}
                            </p>
                          )}
                          {item.chi_tiet?.don_vi_nhan && (
                            <p className="text-sm text-muted-foreground">
                              Đơn vị nhận: {item.chi_tiet.don_vi_nhan}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="flex-grow overflow-hidden">
            <div className="h-full py-4">
              <UsageHistoryTab equipment={equipment} />
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter className="shrink-0 pt-4 border-t">
          <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {canEdit &&
                (!isEditingDetails ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentTab("details")
                      setIsEditingDetails(true)
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Sửa thông tin
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setIsEditingDetails(false)}
                      disabled={updateEquipmentMutation.isPending}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      form="equipment-inline-edit-form"
                      disabled={updateEquipmentMutation.isPending}
                    >
                      {updateEquipmentMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Lưu thay đổi
                    </Button>
                  </>
                ))}
            </div>
            <div className="flex items-center gap-2">
              {!isRegionalLeader && (
                <>
                  <Button variant="secondary" onClick={() => onGenerateDeviceLabel(equipment)}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Tạo nhãn thiết bị
                  </Button>
                  <Button onClick={() => onGenerateProfileSheet(equipment)}>
                    <Printer className="mr-2 h-4 w-4" />
                    In lý lịch
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={requestClose}>
                Đóng
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
