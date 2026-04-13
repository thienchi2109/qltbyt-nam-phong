"use client"

import * as React from "react"
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
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { isRegionalLeaderRole } from "@/lib/rbac"
import { useSession } from "next-auth/react"
import {
  useTransferDepartments,
  useTransferEquipmentSearch,
} from "@/components/transfer-dialog.data"
import {
  buildCreateTransferPayload,
  createEmptyTransferDialogFormData,
  getTransferDialogErrorMessage,
  normalizeSessionUserId,
  type TransferEquipmentOption,
} from "@/components/transfer-dialog.shared"
import { TransferDialogEquipmentSearch } from "@/components/transfer-dialog.equipment-search"
import {
  TransferExternalFields,
  TransferInternalSelectFields,
  TransferReasonField,
  TransferTypeField,
} from "@/components/transfer-dialog.form-sections"

interface AddTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddTransferDialog({ open, onOpenChange, onSuccess }: AddTransferDialogProps) {
  const { toast } = useToast()
  const { data: session } = useSession()
  const currentUserId = normalizeSessionUserId(session?.user)
  const isRegionalLeader = isRegionalLeaderRole(session?.user?.role)
  const [isLoading, setIsLoading] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedEquipment, setSelectedEquipment] = React.useState<TransferEquipmentOption | null>(null)
  const [formData, setFormData] = React.useState(createEmptyTransferDialogFormData)

  const resetForm = React.useCallback(() => {
    setFormData(createEmptyTransferDialogFormData())
    setSelectedEquipment(null)
    setSearchTerm("")
  }, [])

  React.useEffect(() => {
    if (!open) {
      resetForm()
      return
    }
  }, [open, resetForm])

  const { departments, isLoadingDepartments } = useTransferDepartments({ open })
  const selectedValueLabel = selectedEquipment
    ? `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`
    : ""
  const isSelectedValueActive = Boolean(
    selectedEquipment && searchTerm.trim() === selectedValueLabel,
  )
  const {
    equipmentResults,
    isEquipmentLoading,
    trimmedSearch,
  } = useTransferEquipmentSearch({
    open,
    canSearch: true,
    searchTerm,
    skipSearch: isSelectedValueActive,
  })

  const filteredEquipment = React.useMemo(() => {
    if (trimmedSearch.length < 2) {
      return [] as TransferEquipmentOption[]
    }

    if (selectedEquipment && searchTerm === selectedValueLabel) {
      return [] as TransferEquipmentOption[]
    }

    return equipmentResults
  }, [equipmentResults, trimmedSearch, searchTerm, selectedEquipment, selectedValueLabel])

  const showResultsDropdown =
    trimmedSearch.length >= 2 && !isEquipmentLoading && filteredEquipment.length > 0
  const showNoResults =
    trimmedSearch.length >= 2 && !isEquipmentLoading && filteredEquipment.length === 0 && !isSelectedValueActive
  const showMinCharsHint =
    trimmedSearch.length > 0 && trimmedSearch.length < 2

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (selectedEquipment) {
      setSelectedEquipment(null)
      setFormData((prev) => ({
        ...prev,
        thiet_bi_id: 0,
        khoa_phong_hien_tai: "",
      }))
    }
  }

  const handleSelectEquipment = (equipment: TransferEquipmentOption) => {
    setSelectedEquipment(equipment)
    setSearchTerm(`${equipment.ten_thiet_bi} (${equipment.ma_thiet_bi})`)
    setFormData((prev) => ({
      ...prev,
      thiet_bi_id: equipment.id,
      khoa_phong_hien_tai: equipment.khoa_phong_quan_ly || "",
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isRegionalLeader) {
      toast({
        variant: "destructive",
        title: "Không thể thực hiện",
        description: "Vai trò Trưởng vùng chỉ được xem yêu cầu luân chuyển."
      })
      return
    }
    
    if (!formData.thiet_bi_id || !formData.loai_hinh || !formData.ly_do_luan_chuyen) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc."
      })
      return
    }

    // Validate internal transfer fields
    if (formData.loai_hinh === 'noi_bo' && (!formData.khoa_phong_hien_tai || !formData.khoa_phong_nhan)) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin khoa/phòng cho luân chuyển nội bộ."
      })
      return
    }

    // Validate external transfer fields
    if (formData.loai_hinh === 'ben_ngoai' && (!formData.muc_dich || !formData.don_vi_nhan)) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin đơn vị nhận cho luân chuyển bên ngoài."
      })
      return
    }

    // Thanh lý không cần validate thêm vì đã có default values

    setIsLoading(true)

    try {
      const payload = buildCreateTransferPayload({ formData, currentUserId })
      await callRpc({ fn: 'transfer_request_create', args: { p_data: payload } })

      toast({
        title: "Thành công",
        description: formData.loai_hinh === 'thanh_ly' 
          ? "Đã tạo yêu cầu thanh lý thiết bị."
          : "Đã tạo yêu cầu luân chuyển mới."
      })

      onSuccess()
      onOpenChange(false)
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: getTransferDialogErrorMessage(
          error,
          "Có lỗi xảy ra khi tạo yêu cầu.",
        ),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo yêu cầu luân chuyển mới</DialogTitle>
          <DialogDescription>
            Tạo yêu cầu luân chuyển thiết bị giữa các bộ phận hoặc với đơn vị bên ngoài.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <TransferDialogEquipmentSearch
              disabled={isLoading}
              required
              searchTerm={searchTerm}
              trimmedSearch={trimmedSearch}
              selectedEquipment={selectedEquipment}
              isEquipmentLoading={isEquipmentLoading}
              showResultsDropdown={showResultsDropdown}
              showNoResults={showNoResults}
              showMinCharsHint={showMinCharsHint}
              filteredEquipment={filteredEquipment}
              onSearchChange={handleSearchChange}
              onSelectEquipment={handleSelectEquipment}
            />

            <TransferTypeField
              disabled={isLoading}
              formData={formData}
              setFormData={setFormData}
              includeDisposalStyle
            />

            {formData.loai_hinh === 'thanh_ly' && (
              <div className="p-3 mt-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <p><strong>Lưu ý:</strong> Khi chọn "Thanh lý", thiết bị sẽ được chuyển về cho <strong>Tổ QLTB</strong> để xử lý. Sau khi hoàn tất, trạng thái thiết bị sẽ được cập nhật thành "Ngưng sử dụng".</p>
              </div>
            )}

            {formData.loai_hinh === 'noi_bo' && (
              <TransferInternalSelectFields
                departments={departments}
                disabled={isLoading || isLoadingDepartments}
                formData={formData}
                setFormData={setFormData}
                lockCurrentDepartment={Boolean(selectedEquipment)}
              />
            )}

            {formData.loai_hinh === 'ben_ngoai' && (
              <TransferExternalFields
                disabled={isLoading}
                formData={formData}
                setFormData={setFormData}
              />
            )}

            <TransferReasonField
              disabled={isLoading}
              formData={formData}
              setFormData={setFormData}
              allowDisposalCopy
            />
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading || isRegionalLeader}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo yêu cầu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 
