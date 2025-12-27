import { callRpc } from "@/lib/rpc-client"
import type { RepairRequestWithEquipment, RepairUnit } from "../types"
import type { AuthUser } from "../_components/repair-requests-columns"

/** Workflow dialog state for approval */
export interface WorkflowApprovalState {
  requestToApprove: RepairRequestWithEquipment | null
  approvalRepairUnit: RepairUnit
  approvalExternalCompanyName: string
}

/** Workflow dialog state for completion */
export interface WorkflowCompletionState {
  requestToComplete: RepairRequestWithEquipment | null
  completionType: 'Hoàn thành' | 'Không HT' | null
  completionResult: string
  nonCompletionReason: string
}

/** External dependencies for workflows */
export interface WorkflowDeps {
  user: AuthUser | null | undefined
  invalidateCacheAndRefetch: () => void
  toast: ReturnType<typeof import("@/hooks/use-toast").useToast>['toast']
}

/** Loading state setters for workflows */
export interface WorkflowLoadingSetters {
  setIsApproving: (loading: boolean) => void
  setIsCompleting: (loading: boolean) => void
}

/** Dialog state setters for approval workflow */
export interface WorkflowApprovalSetters {
  setRequestToApprove: (req: RepairRequestWithEquipment | null) => void
  setApprovalRepairUnit: (u: RepairUnit) => void
  setApprovalExternalCompanyName: (v: string) => void
}

/** Dialog state setters for completion workflow */
export interface WorkflowCompletionSetters {
  setRequestToComplete: (req: RepairRequestWithEquipment | null) => void
  setCompletionType: (t: 'Hoàn thành' | 'Không HT' | null) => void
  setCompletionResult: (v: string) => void
  setNonCompletionReason: (v: string) => void
}

/** Returned workflow handlers */
export interface WorkflowActions {
  /** Open approval dialog and reset form */
  handleApproveRequest: (request: RepairRequestWithEquipment) => void
  /** Confirm and execute approval */
  handleConfirmApproval: () => Promise<void>
  /** Open completion dialog and reset form */
  handleCompletion: (request: RepairRequestWithEquipment, type: 'Hoàn thành' | 'Không HT') => void
  /** Confirm and execute completion */
  handleConfirmCompletion: () => Promise<void>
}

/**
 * Hook for repair request workflow actions (Approve, Complete)
 *
 * @param approvalState - Current approval dialog state
 * @param completionState - Current completion dialog state
 * @param deps - External dependencies (user, toast, cache invalidator)
 * @param loadingSetters - Loading state setters
 * @param approvalSetters - Approval dialog state setters
 * @param completionSetters - Completion dialog state setters
 * @returns Workflow handlers
 */
export function useRepairRequestWorkflows(
  approvalState: WorkflowApprovalState,
  completionState: WorkflowCompletionState,
  deps: WorkflowDeps,
  loadingSetters: WorkflowLoadingSetters,
  approvalSetters: WorkflowApprovalSetters,
  completionSetters: WorkflowCompletionSetters
): WorkflowActions {
  const {
    requestToApprove,
    approvalRepairUnit,
    approvalExternalCompanyName,
  } = approvalState

  const {
    requestToComplete,
    completionType,
    completionResult,
    nonCompletionReason,
  } = completionState

  const { user, invalidateCacheAndRefetch, toast } = deps

  const {
    setIsApproving,
    setIsCompleting,
  } = loadingSetters

  const {
    setRequestToApprove,
    setApprovalRepairUnit,
    setApprovalExternalCompanyName,
  } = approvalSetters

  const {
    setRequestToComplete,
    setCompletionType,
    setCompletionResult,
    setNonCompletionReason,
  } = completionSetters

  const handleApproveRequest = (request: RepairRequestWithEquipment): void => {
    setRequestToApprove(request)
    setApprovalRepairUnit('noi_bo')
    setApprovalExternalCompanyName('')
  }

  const handleConfirmApproval = async (): Promise<void> => {
    if (!requestToApprove) return

    // Validate external company name when repair unit is external
    if (approvalRepairUnit === 'thue_ngoai' && !approvalExternalCompanyName.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập tên đơn vị được thuê sửa chữa.",
      })
      return
    }

    setIsApproving(true)

    try {
      await callRpc({
        fn: 'repair_request_approve',
        args: {
          p_id: requestToApprove.id,
          p_nguoi_duyet: user?.full_name || user?.username || '',
          p_don_vi_thuc_hien: approvalRepairUnit,
          p_ten_don_vi_thue: approvalRepairUnit === 'thue_ngoai' ? approvalExternalCompanyName.trim() : null
        }
      })
    } catch (requestError: unknown) {
      const errorMessage = requestError instanceof Error ? requestError.message : ''
      toast({
        variant: "destructive",
        title: "Lỗi duyệt yêu cầu",
        description: "Không thể duyệt yêu cầu. " + errorMessage,
      })
      setIsApproving(false)
      return
    }

    toast({ title: "Thành công", description: "Đã duyệt yêu cầu." })

    setRequestToApprove(null)
    setApprovalRepairUnit('noi_bo')
    setApprovalExternalCompanyName('')
    setIsApproving(false)
    invalidateCacheAndRefetch()
  }

  const handleCompletion = (request: RepairRequestWithEquipment, newStatus: 'Hoàn thành' | 'Không HT'): void => {
    setRequestToComplete(request)
    setCompletionType(newStatus)
    setCompletionResult('')
    setNonCompletionReason('')
  }

  const handleConfirmCompletion = async (): Promise<void> => {
    if (!requestToComplete || !completionType) return

    // Validate input based on completion type
    if (completionType === 'Hoàn thành' && !completionResult.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập kết quả sửa chữa.",
      })
      return
    }

    if (completionType === 'Không HT' && !nonCompletionReason.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập lý do không hoàn thành.",
      })
      return
    }

    setIsCompleting(true)

    try {
      await callRpc({
        fn: 'repair_request_complete',
        args: {
          p_id: requestToComplete.id,
          p_completion: completionType === 'Hoàn thành' ? completionResult.trim() : null,
          p_reason: completionType === 'Không HT' ? nonCompletionReason.trim() : null,
        }
      })
    } catch (requestError: unknown) {
      const errorMessage = requestError instanceof Error ? requestError.message : ''
      toast({ variant: "destructive", title: "Lỗi cập nhật yêu cầu", description: errorMessage })
      setIsCompleting(false)
      return
    }

    toast({ title: "Thành công", description: `Đã cập nhật trạng thái yêu cầu thành "${completionType}".` })

    setRequestToComplete(null)
    setCompletionType(null)
    setCompletionResult('')
    setNonCompletionReason('')
    setIsCompleting(false)
    invalidateCacheAndRefetch()
  }

  return {
    handleApproveRequest,
    handleConfirmApproval,
    handleCompletion,
    handleConfirmCompletion,
  }
}
