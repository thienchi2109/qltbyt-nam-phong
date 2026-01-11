import { format } from "date-fns"
import { callRpc } from "@/lib/rpc-client"
import type { RepairRequestWithEquipment, RepairUnit, EquipmentSelectItem, AuthUser } from "../types"

/** Form state for creating new repair requests */
export interface MutationFormState {
  selectedEquipment: EquipmentSelectItem | null
  issueDescription: string
  repairItems: string
  desiredDate: Date | undefined
  repairUnit: RepairUnit
  externalCompanyName: string
}

/** Form state for editing existing repair requests */
export interface MutationEditState {
  editingRequest: RepairRequestWithEquipment | null
  editIssueDescription: string
  editRepairItems: string
  editDesiredDate: Date | undefined
  editRepairUnit: RepairUnit
  editExternalCompanyName: string
  requestToDelete: RepairRequestWithEquipment | null
}

/** External dependencies for mutations */
export interface MutationDeps {
  user: AuthUser | null | undefined
  canSetRepairUnit: boolean
  invalidateCacheAndRefetch: () => void
  toast: ReturnType<typeof import("@/hooks/use-toast").useToast>['toast']
}

/** Loading state setters for mutations */
export interface MutationLoadingSetters {
  setIsSubmitting: (loading: boolean) => void
  setIsEditSubmitting: (loading: boolean) => void
  setIsDeleting: (loading: boolean) => void
}

/** Form state setters for create form */
export interface MutationFormSetters {
  setSelectedEquipment: (eq: EquipmentSelectItem | null) => void
  setSearchQuery: (q: string) => void
  setIssueDescription: (v: string) => void
  setRepairItems: (v: string) => void
  setDesiredDate: (d: Date | undefined) => void
  setRepairUnit: (u: RepairUnit) => void
  setExternalCompanyName: (v: string) => void
}

/** Dialog state setters for edit/delete */
export interface MutationDialogSetters {
  setEditingRequest: (req: RepairRequestWithEquipment | null) => void
  setRequestToDelete: (req: RepairRequestWithEquipment | null) => void
}

/** Returned mutation handlers */
export interface MutationActions {
  /** Create a new repair request */
  handleSubmit: (e: React.FormEvent) => Promise<void>
  /** Update an existing repair request */
  handleUpdateRequest: () => Promise<void>
  /** Delete a repair request */
  handleDeleteRequest: () => Promise<void>
}

/**
 * Hook for repair request CRUD mutations (Create, Update, Delete)
 *
 * @param formState - Current create form state
 * @param editState - Current edit form state
 * @param deps - External dependencies (user, toast, cache invalidator)
 * @param loadingSetters - Loading state setters for each mutation
 * @param formSetters - Create form state setters
 * @param dialogSetters - Dialog state setters for edit/delete
 * @returns Mutation handlers
 */
export function useRepairRequestMutations(
  formState: MutationFormState,
  editState: MutationEditState,
  deps: MutationDeps,
  loadingSetters: MutationLoadingSetters,
  formSetters: MutationFormSetters,
  dialogSetters: MutationDialogSetters
): MutationActions {
  const {
    selectedEquipment,
    issueDescription,
    repairItems,
    desiredDate,
    repairUnit,
    externalCompanyName,
  } = formState

  const {
    editingRequest,
    editIssueDescription,
    editRepairItems,
    editDesiredDate,
    editRepairUnit,
    editExternalCompanyName,
    requestToDelete,
  } = editState

  const { user, canSetRepairUnit, invalidateCacheAndRefetch, toast } = deps

  const {
    setIsSubmitting,
    setIsEditSubmitting,
    setIsDeleting,
  } = loadingSetters

  const {
    setSelectedEquipment,
    setSearchQuery,
    setIssueDescription,
    setRepairItems,
    setDesiredDate,
    setRepairUnit,
    setExternalCompanyName,
  } = formSetters

  const { setEditingRequest, setRequestToDelete } = dialogSetters

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!selectedEquipment || !issueDescription || !repairItems) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ các trường bắt buộc.",
      })
      return
    }

    // Validate external company name when repair unit is external
    if (repairUnit === 'thue_ngoai' && !externalCompanyName.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập tên đơn vị được thuê sửa chữa.",
      })
      return
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại."
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Create repair request via RPC; server-side enforces tenant/role
      await callRpc({
        fn: 'repair_request_create',
        args: {
          p_thiet_bi_id: selectedEquipment.id,
          p_mo_ta_su_co: issueDescription,
          p_hang_muc_sua_chua: repairItems,
          p_ngay_mong_muon_hoan_thanh: desiredDate ? format(desiredDate, "yyyy-MM-dd") : null,
          p_nguoi_yeu_cau: user.full_name || user.username,
          p_don_vi_thuc_hien: canSetRepairUnit ? repairUnit : null,
          p_ten_don_vi_thue: canSetRepairUnit && repairUnit === 'thue_ngoai' ? externalCompanyName.trim() : null,
        }
      })

      toast({
        title: "Thành công",
        description: "Yêu cầu sửa chữa của bạn đã được gửi đi.",
      })
      // Reset form
      setSelectedEquipment(null)
      setSearchQuery("")
      setIssueDescription("")
      setRepairItems("")
      setDesiredDate(undefined)
      setRepairUnit('noi_bo')
      setExternalCompanyName("")
      // Invalidate cache and refetch requests
      invalidateCacheAndRefetch()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Không thể tạo yêu cầu sửa chữa. Vui lòng thử lại.'
      console.error("Repair request creation failed:", error)
      toast({
        variant: "destructive",
        title: "Gửi yêu cầu thất bại",
        description: errorMessage,
      })
    }

    setIsSubmitting(false)
  }

  const handleUpdateRequest = async (): Promise<void> => {
    if (!editingRequest || !editIssueDescription || !editRepairItems) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Mô tả sự cố và hạng mục không được để trống."
      })
      return
    }

    // Validate external company name when repair unit is external
    if (editRepairUnit === 'thue_ngoai' && !editExternalCompanyName.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập tên đơn vị được thuê sửa chữa."
      })
      return
    }

    setIsEditSubmitting(true)

    // Update via RPC
    try {
      await callRpc({
        fn: 'repair_request_update',
        args: {
          p_id: editingRequest.id,
          p_mo_ta_su_co: editIssueDescription,
          p_hang_muc_sua_chua: editRepairItems,
          p_ngay_mong_muon_hoan_thanh: editDesiredDate ? format(editDesiredDate, "yyyy-MM-dd") : null,
          p_don_vi_thuc_hien: canSetRepairUnit ? editRepairUnit : editingRequest.don_vi_thuc_hien,
          p_ten_don_vi_thue: canSetRepairUnit && editRepairUnit === 'thue_ngoai'
            ? editExternalCompanyName.trim()
            : (canSetRepairUnit ? null : editingRequest.ten_don_vi_thue),
        }
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Không thể cập nhật yêu cầu'
      toast({ variant: "destructive", title: "Lỗi cập nhật", description: errorMessage })
      setIsEditSubmitting(false)
      return
    }

    toast({ title: "Thành công", description: "Đã cập nhật yêu cầu." })
    setEditingRequest(null)
    invalidateCacheAndRefetch()
    setIsEditSubmitting(false)
  }

  const handleDeleteRequest = async (): Promise<void> => {
    if (!requestToDelete) return

    setIsDeleting(true)

    try {
      await callRpc({ fn: 'repair_request_delete', args: { p_id: requestToDelete.id } })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Không thể xóa yêu cầu'
      toast({ variant: "destructive", title: "Lỗi xóa yêu cầu", description: errorMessage })
      setIsDeleting(false)
      setRequestToDelete(null)
      return
    }

    toast({ title: "Đã xóa", description: "Yêu cầu đã được xóa thành công." })
    invalidateCacheAndRefetch()

    setIsDeleting(false)
    setRequestToDelete(null)
  }

  return { handleSubmit, handleUpdateRequest, handleDeleteRequest }
}
