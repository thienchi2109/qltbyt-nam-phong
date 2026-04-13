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
import { type TransferRequest } from "@/types/database"
import { useTransferEquipmentSearch } from "@/components/transfer-dialog.data"
import {
  buildUpdateTransferPayload,
  createEmptyTransferDialogFormData,
  createTransferDialogFormDataFromTransfer,
  getSelectedEquipmentFromTransfer,
  getTransferDialogErrorMessage,
  normalizeSessionUserId,
  type TransferEquipmentOption,
} from "@/components/transfer-dialog.shared"
import { TransferDialogEquipmentSearch } from "@/components/transfer-dialog.equipment-search"
import {
  TransferExternalFields,
  TransferInternalInputFields,
  TransferReasonField,
  TransferTypeField,
} from "@/components/transfer-dialog.form-sections"

interface EditTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  transfer: TransferRequest | null
}

export function EditTransferDialog({ open, onOpenChange, onSuccess, transfer }: EditTransferDialogProps) {
  const { toast } = useToast()
  const { data: session } = useSession()
  const currentUserId = normalizeSessionUserId(session?.user)
  const isRegionalLeader = isRegionalLeaderRole(session?.user?.role)
  const [isLoading, setIsLoading] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedEquipment, setSelectedEquipment] = React.useState<TransferEquipmentOption | null>(null)
  const [formData, setFormData] = React.useState(createEmptyTransferDialogFormData)

  // Check if editing is allowed based on status
  const canEdit = Boolean(
    transfer && (transfer.trang_thai === 'cho_duyet' || transfer.trang_thai === 'da_duyet')
  )

  const resetForm = React.useCallback(() => {
    setFormData(createEmptyTransferDialogFormData())
    setSelectedEquipment(null)
    setSearchTerm("")
  }, [])

  // Load transfer data when dialog opens
  React.useEffect(() => {
    if (open && transfer) {
      setFormData(createTransferDialogFormDataFromTransfer(transfer))

      const equipment = getSelectedEquipmentFromTransfer(transfer)
      setSelectedEquipment(equipment)
      if (equipment) {
        setSearchTerm(`${equipment.ten_thiet_bi} (${equipment.ma_thiet_bi})`)
      }
    } else if (!open) {
      resetForm()
    }
  }, [open, transfer, resetForm])

  const selectedValueLabel = selectedEquipment
    ? `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`
    : ""

  const canSearchEquipment = Boolean(canEdit && !isRegionalLeader)
  const {
    equipmentResults,
    isEquipmentLoading,
    trimmedSearch,
  } = useTransferEquipmentSearch({
    open,
    canSearch: canSearchEquipment,
    searchTerm,
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

  const isSelectedValueActive = Boolean(selectedEquipment && searchTerm === selectedValueLabel)
  const showResultsDropdown =
    canSearchEquipment &&
    trimmedSearch.length >= 2 &&
    !isEquipmentLoading &&
    filteredEquipment.length > 0
  const showNoResults =
    canSearchEquipment &&
    trimmedSearch.length >= 2 &&
    !isEquipmentLoading &&
    filteredEquipment.length === 0 &&
    !isSelectedValueActive
  const showMinCharsHint =
    canSearchEquipment &&
    trimmedSearch.length > 0 &&
    trimmedSearch.length < 2

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canSearchEquipment) {
      return
    }

    const value = e.target.value
    setSearchTerm(value)
    if (selectedEquipment && value !== selectedValueLabel) {
      setSelectedEquipment(null)
      setFormData((prev) => ({
        ...prev,
        thiet_bi_id: 0,
        khoa_phong_hien_tai: "",
      }))
    }
  }

  const handleSelectEquipment = (equipment: TransferEquipmentOption) => {
    if (!canSearchEquipment) {
      return
    }

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
    
    if (!transfer || !canEdit) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể chỉnh sửa yêu cầu này."
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

    setIsLoading(true)

    try {
      const payload = buildUpdateTransferPayload({ formData, currentUserId })
      await callRpc({ fn: 'transfer_request_update', args: { p_id: transfer.id, p_data: payload } })

      toast({
        title: "Thành công",
        description: "Đã cập nhật yêu cầu luân chuyển."
      })

      onSuccess()
      onOpenChange(false)
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: getTransferDialogErrorMessage(
          error,
          "Có lỗi xảy ra khi cập nhật yêu cầu.",
        ),
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!transfer) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa yêu cầu luân chuyển</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin yêu cầu luân chuyển thiết bị - {transfer.ma_yeu_cau}
            {!canEdit && (
              <span className="text-destructive block mt-1">
                ⚠️ Chỉ có thể chỉnh sửa yêu cầu ở trạng thái "Chờ duyệt" hoặc "Đã duyệt"
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <TransferDialogEquipmentSearch
              disabled={isLoading || !canSearchEquipment}
              canSearch={canSearchEquipment}
              searchTerm={searchTerm}
              trimmedSearch={trimmedSearch}
              selectedEquipment={selectedEquipment}
              isEquipmentLoading={isEquipmentLoading}
              showResultsDropdown={showResultsDropdown}
              showNoResults={showNoResults}
              showMinCharsHint={showMinCharsHint}
              filteredEquipment={filteredEquipment}
              noSearchMessage="Không thể thay đổi thiết bị đối với vai trò hiện tại."
              onSearchChange={handleSearchChange}
              onSelectEquipment={handleSelectEquipment}
            />

            <TransferTypeField
              disabled={isLoading || !canEdit}
              formData={formData}
              setFormData={setFormData}
            />

            {formData.loai_hinh === 'noi_bo' && (
              <TransferInternalInputFields
                disabled={isLoading || !canEdit}
                formData={formData}
                setFormData={setFormData}
              />
            )}

            {formData.loai_hinh === 'ben_ngoai' && (
              <TransferExternalFields
                disabled={isLoading || !canEdit}
                formData={formData}
                setFormData={setFormData}
              />
            )}

            <TransferReasonField
              disabled={isLoading || !canEdit}
              formData={formData}
              setFormData={setFormData}
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
            <Button type="submit" disabled={isLoading || !canEdit || isRegionalLeader}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cập nhật
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 
