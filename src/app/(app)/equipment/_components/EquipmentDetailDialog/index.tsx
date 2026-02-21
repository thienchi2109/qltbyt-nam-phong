/**
 * EquipmentDetailDialog/index.tsx
 *
 * Main entry point for the Equipment Detail Dialog.
 * Full-screen dialog for viewing and editing equipment details.
 * Contains tabs: Details, Attachments, History, Usage.
 *
 * @module equipment/_components/EquipmentDetailDialog
 */

"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, FormProvider } from "react-hook-form"
import { Edit, Loader2, Printer, QrCode, Trash2 } from "lucide-react"

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Equipment } from "@/types/database"

import {
  equipmentFormSchema,
  type EquipmentFormValues,
  type EquipmentStatus,
  type UserSession,
} from "./EquipmentDetailTypes"
import { formatPartialDateToDisplay } from "@/lib/date-utils"
import { isEquipmentManagerRole } from "@/lib/rbac"
import { useEquipmentHistory } from "./hooks/useEquipmentHistory"
import { useEquipmentAttachments } from "./hooks/useEquipmentAttachments"
import { useEquipmentUpdate } from "./hooks/useEquipmentUpdate"
import { EquipmentDetailHistoryTab } from "./EquipmentDetailHistoryTab"
import { EquipmentDetailUsageTab } from "./EquipmentDetailUsageTab"
import { EquipmentDetailFilesTab } from "./EquipmentDetailFilesTab"
import { EquipmentDetailDetailsTab } from "./EquipmentDetailDetailsTab"
import { EquipmentDetailConfigTab } from "./EquipmentDetailConfigTab"
import { EquipmentDetailEditForm } from "./EquipmentDetailEditForm"
import { useDeleteEquipment } from "@/hooks/use-cached-equipment"

const DEFAULT_FORM_VALUES = {
  ma_thiet_bi: "",
  ten_thiet_bi: "",
  vi_tri_lap_dat: "",
  khoa_phong_quan_ly: "",
  nguoi_dang_truc_tiep_quan_ly: "",
  tinh_trang_hien_tai: null,
  model: null,
  serial: null,
  hang_san_xuat: null,
  noi_san_xuat: null,
  nguon_kinh_phi: null,
  cau_hinh_thiet_bi: null,
  phu_kien_kem_theo: null,
  so_luu_hanh: null,
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
}

/**
 * Converts equipment data to form values
 */
function equipmentToFormValues(equipment: Equipment) {
  const classification = equipment.phan_loai_theo_nd98
  const normalizedClassification =
    classification && ["A", "B", "C", "D"].includes(String(classification).toUpperCase())
      ? (String(classification).toUpperCase() as "A" | "B" | "C" | "D")
      : null

  return {
    ma_thiet_bi: equipment.ma_thiet_bi || "",
    ten_thiet_bi: equipment.ten_thiet_bi || "",
    vi_tri_lap_dat: equipment.vi_tri_lap_dat || "",
    khoa_phong_quan_ly: equipment.khoa_phong_quan_ly || "",
    nguoi_dang_truc_tiep_quan_ly: equipment.nguoi_dang_truc_tiep_quan_ly || "",
    tinh_trang_hien_tai: (equipment.tinh_trang_hien_tai as EquipmentStatus) || null,
    model: equipment.model || null,
    serial: equipment.serial || null,
    hang_san_xuat: equipment.hang_san_xuat || null,
    noi_san_xuat: equipment.noi_san_xuat || null,
    nguon_kinh_phi: equipment.nguon_kinh_phi || null,
    cau_hinh_thiet_bi: equipment.cau_hinh_thiet_bi || null,
    phu_kien_kem_theo: equipment.phu_kien_kem_theo || null,
    so_luu_hanh: equipment.so_luu_hanh || null,
    ghi_chu: equipment.ghi_chu || null,
    // Partial date fields: convert ISO to Vietnamese format for display in form
    ngay_nhap: formatPartialDateToDisplay(equipment.ngay_nhap) || null,
    ngay_dua_vao_su_dung: formatPartialDateToDisplay(equipment.ngay_dua_vao_su_dung) || null,
    han_bao_hanh: formatPartialDateToDisplay(equipment.han_bao_hanh) || null,
    ngay_bt_tiep_theo: (equipment as Equipment & { ngay_bt_tiep_theo?: string }).ngay_bt_tiep_theo || null,
    ngay_hc_tiep_theo: (equipment as Equipment & { ngay_hc_tiep_theo?: string }).ngay_hc_tiep_theo || null,
    ngay_kd_tiep_theo: (equipment as Equipment & { ngay_kd_tiep_theo?: string }).ngay_kd_tiep_theo || null,
    // Use ?? for numeric fields to preserve 0 as valid value
    nam_san_xuat: equipment.nam_san_xuat ?? null,
    gia_goc: equipment.gia_goc ?? null,
    chu_ky_bt_dinh_ky: (equipment as Equipment & { chu_ky_bt_dinh_ky?: number }).chu_ky_bt_dinh_ky ?? null,
    chu_ky_hc_dinh_ky: (equipment as Equipment & { chu_ky_hc_dinh_ky?: number }).chu_ky_hc_dinh_ky ?? null,
    chu_ky_kd_dinh_ky: (equipment as Equipment & { chu_ky_kd_dinh_ky?: number }).chu_ky_kd_dinh_ky ?? null,
    phan_loai_theo_nd98: normalizedClassification,
  }
}

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
}: EquipmentDetailDialogProps): React.ReactNode {
  // Internal state
  const [currentTab, setCurrentTab] = React.useState<string>("details")
  const [isEditingDetails, setIsEditingDetails] = React.useState(false)
  // Store saved values to display after save (equipment prop is stale until dialog reopens)
  const [savedValues, setSavedValues] = React.useState<Partial<EquipmentFormValues> | null>(null)
  // Ref for scrolling active tab into view on mobile
  const tabsScrollRef = React.useRef<HTMLDivElement>(null)

  // Delete confirm dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)

  // Scroll active tab into view when tab changes (mobile accessibility)
  React.useEffect(() => {
    const scrollContainer = tabsScrollRef.current
    if (!scrollContainer) return
    const activeTab = scrollContainer.querySelector('[data-state="active"]') as HTMLElement
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [currentTab])

  // Form
  const editForm = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: DEFAULT_FORM_VALUES as EquipmentFormValues,
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
      editForm.reset(equipmentToFormValues(equipment))
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

  const { mutate: deleteEquipment, isPending: isDeleting } = useDeleteEquipment()

  // Handlers
  const onSubmitInlineEdit = async (values: EquipmentFormValues): Promise<void> => {
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
    !!user &&
    (isEquipmentManagerRole(user.role) ||
      (user.role === "qltb_khoa" && user.khoa_phong === equipment?.khoa_phong_quan_ly))

  const handleDeleteEquipment = React.useCallback(() => {
    if (!equipment || !canEdit || isDeleting) return
    deleteEquipment(String(equipment.id), {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        onOpenChange(false) // Close the detail dialog too after deletion
      }
    })
  }, [equipment, canEdit, isDeleting, deleteEquipment, onOpenChange])

  if (!equipment) return null

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Chi tiết thiết bị: {displayEquipment?.ten_thiet_bi}</DialogTitle>
          <DialogDescription>Mã thiết bị: {displayEquipment?.ma_thiet_bi}</DialogDescription>
        </DialogHeader>
        <Tabs
          value={currentTab}
          onValueChange={setCurrentTab}
          className="flex-grow flex flex-col overflow-hidden"
        >
          <div ref={tabsScrollRef} className="overflow-x-auto flex-shrink-0">
            <TabsList className="w-max">
              <TabsTrigger value="details">Thông tin chi tiết</TabsTrigger>
              <TabsTrigger value="config">Cấu hình & Phụ kiện</TabsTrigger>
              <TabsTrigger value="files">File đính kèm</TabsTrigger>
              <TabsTrigger value="history">Lịch sử</TabsTrigger>
              <TabsTrigger value="usage">Nhật ký sử dụng</TabsTrigger>
            </TabsList>
          </div>

          <FormProvider {...editForm}>
            {/* Details Tab - forceMount when editing to keep form in DOM for submit */}
            <TabsContent
              value="details"
              className={`flex-grow overflow-hidden ${currentTab !== "details" && isEditingDetails ? "hidden" : ""}`}
              forceMount={isEditingDetails ? true : undefined}
            >
              <EquipmentDetailDetailsTab
                displayEquipment={displayEquipment!}
                isEditing={isEditingDetails}
              >
                <EquipmentDetailEditForm
                  formId="equipment-inline-edit-form"
                  onSubmit={onSubmitInlineEdit}
                />
              </EquipmentDetailDetailsTab>
            </TabsContent>

            {/* Config Tab */}
            <TabsContent value="config" className="flex-grow overflow-hidden">
              <EquipmentDetailConfigTab
                displayEquipment={displayEquipment!}
                isEditing={isEditingDetails}
              />
            </TabsContent>
          </FormProvider>

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
          <TooltipProvider>
            <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {canEdit &&
                  (!isEditingDetails ? (
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setIsEditingDetails(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Sửa thông tin</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Sửa thông tin</TooltipContent>
                    </Tooltip>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => {
                          if (displayEquipment) {
                            editForm.reset(equipmentToFormValues(displayEquipment))
                          }
                          setIsEditingDetails(false)
                        }}
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
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => onGenerateDeviceLabel(displayEquipment!)}>
                          <QrCode className="h-4 w-4" />
                          <span className="sr-only">Tạo nhãn thiết bị</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Tạo nhãn thiết bị</TooltipContent>
                    </Tooltip>

                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => onGenerateProfileSheet(displayEquipment!)}>
                          <Printer className="h-4 w-4" />
                          <span className="sr-only">In lý lịch</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>In lý lịch</TooltipContent>
                    </Tooltip>
                  </>
                )}

                <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>

                {canEdit && (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Xóa thiết bị</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Xóa thiết bị</TooltipContent>
                  </Tooltip>
                )}

                <Button variant="default" onClick={() => handleDialogOpenChange(false)}>
                  Đóng
                </Button>
              </div>
            </div>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa thiết bị này không?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ chuyển thiết bị vào thùng rác (xóa mềm).
              Bạn có thể khôi phục lại sau nếu cần.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDeleteEquipment()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
