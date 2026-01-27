/**
 * equipment-detail-dialog.tsx
 *
 * Full-screen dialog for viewing and editing equipment details.
 * Contains tabs: Details, Attachments, History, Usage.
 * Includes inline edit form, attachment management, and history timeline.
 */

"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, FormProvider } from "react-hook-form"
import {
  Edit,
  Loader2,
  Printer,
  QrCode,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Equipment } from "@/types/database"
import {
  equipmentFormSchema,
  type EquipmentFormValues,
  type UserSession,
} from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailTypes"
import { useEquipmentHistory } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/hooks/useEquipmentHistory"
import { useEquipmentAttachments } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/hooks/useEquipmentAttachments"
import { useEquipmentUpdate } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/hooks/useEquipmentUpdate"
import { EquipmentDetailHistoryTab } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailHistoryTab"
import { EquipmentDetailUsageTab } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailUsageTab"
import { EquipmentDetailFilesTab } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFilesTab"
import { EquipmentDetailDetailsTab } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailDetailsTab"
import { EquipmentDetailEditForm } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailEditForm"

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
  // Internal state
  const [currentTab, setCurrentTab] = React.useState<string>("details")
  const [isEditingDetails, setIsEditingDetails] = React.useState(false)
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

  // Custom hooks for data fetching and mutations
  const { history, isLoading: isLoadingHistory } = useEquipmentHistory({
    equipmentId: equipment?.id,
    enabled: open,
  })

  const {
    attachments,
    isLoading: isLoadingAttachments,
    addAttachment,
    deleteAttachment,
    isAdding: isAddingAttachment,
    isDeleting: isDeletingAttachment,
  } = useEquipmentAttachments({
    equipmentId: equipment?.id,
    enabled: open,
  })

  const { updateEquipment, isPending: isUpdating } = useEquipmentUpdate({
    onSuccess: (savedPatch) => {
      setSavedValues((prev) => ({ ...prev, ...savedPatch }))
      setIsEditingDetails(false)
      onEquipmentUpdated()
    },
  })

  // Handlers
  const onSubmitInlineEdit = async (values: EquipmentFormValues) => {
    if (!equipment) return
    await updateEquipment({ id: equipment.id, patch: values })
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
            <FormProvider {...editForm}>
              <EquipmentDetailDetailsTab
                displayEquipment={displayEquipment!}
                isEditing={isEditingDetails}
              >
                <EquipmentDetailEditForm
                  formId="equipment-inline-edit-form"
                  onSubmit={onSubmitInlineEdit}
                />
              </EquipmentDetailDetailsTab>
            </FormProvider>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="flex-grow overflow-hidden">
            <EquipmentDetailFilesTab
              attachments={attachments}
              isLoading={isLoadingAttachments}
              googleDriveFolderUrl={equipment?.google_drive_folder_url}
              onAddAttachment={addAttachment}
              onDeleteAttachment={deleteAttachment}
              isAdding={isAddingAttachment}
              isDeleting={isDeletingAttachment}
            />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex-grow overflow-hidden">
            <EquipmentDetailHistoryTab history={history} isLoading={isLoadingHistory} />
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="flex-grow overflow-hidden">
            <EquipmentDetailUsageTab equipment={equipment} />
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
                      disabled={isUpdating}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      form="equipment-inline-edit-form"
                      disabled={isUpdating}
                    >
                      {isUpdating && (
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
