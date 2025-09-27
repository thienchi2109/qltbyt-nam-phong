"use client"

import * as React from "react"
import { Loader2, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { useSession } from "next-auth/react"
import {
  TRANSFER_TYPES,
  TRANSFER_PURPOSES,
  type TransferType,
  type TransferPurpose,
  type TransferRequest
} from "@/types/database"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { Badge } from "@/components/ui/badge"

// Temporary interface for equipment with actual database columns
interface EquipmentWithDept {
  id: number;
  ma_thiet_bi: string;
  ten_thiet_bi: string;
  model?: string;
  serial?: string;
  khoa_phong_quan_ly?: string;
  tinh_trang?: string;
  ngay_nhap?: string;
  created_at?: string;
  updated_at?: string;
}

type EquipmentListEnhancedResponse = {
  data?: any[] | null
  total?: number
  page?: number
  pageSize?: number
}

interface EditTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  transfer: TransferRequest | null
}

export function EditTransferDialog({ open, onOpenChange, onSuccess, transfer }: EditTransferDialogProps) {
  const { toast } = useToast()
  const { data: session } = useSession()
  const user = session?.user as any // Cast NextAuth user to our User type
  const isRegionalLeader = user?.role === 'regional_leader'
  const [isLoading, setIsLoading] = React.useState(false)
  const [equipmentResults, setEquipmentResults] = React.useState<EquipmentWithDept[]>([])
  const [isEquipmentLoading, setIsEquipmentLoading] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const debouncedSearch = useSearchDebounce(searchTerm)
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentWithDept | null>(null)
  
  const [formData, setFormData] = React.useState({
    thiet_bi_id: 0,
    loai_hinh: "" as TransferType | "",
    ly_do_luan_chuyen: "",
    
    // For internal transfers
    khoa_phong_hien_tai: "",
    khoa_phong_nhan: "",
    
    // For external transfers
    muc_dich: "" as TransferPurpose | "",
    don_vi_nhan: "",
    dia_chi_don_vi: "",
    nguoi_lien_he: "",
    so_dien_thoai: "",
    ngay_du_kien_tra: ""
  })

  // Check if editing is allowed based on status
  const canEdit = Boolean(
    transfer && (transfer.trang_thai === 'cho_duyet' || transfer.trang_thai === 'da_duyet')
  )

  const resetForm = React.useCallback(() => {
    setFormData({
      thiet_bi_id: 0,
      loai_hinh: "",
      ly_do_luan_chuyen: "",
      khoa_phong_hien_tai: "",
      khoa_phong_nhan: "",
      muc_dich: "",
      don_vi_nhan: "",
      dia_chi_don_vi: "",
      nguoi_lien_he: "",
      so_dien_thoai: "",
      ngay_du_kien_tra: ""
    })
    setSelectedEquipment(null)
    setSearchTerm("")
  }, [])

  // Load transfer data when dialog opens
  React.useEffect(() => {
    if (open && transfer) {
      setFormData({
        thiet_bi_id: transfer.thiet_bi_id,
        loai_hinh: transfer.loai_hinh,
        ly_do_luan_chuyen: transfer.ly_do_luan_chuyen,
        khoa_phong_hien_tai: transfer.khoa_phong_hien_tai || "",
        khoa_phong_nhan: transfer.khoa_phong_nhan || "",
        muc_dich: transfer.muc_dich || "",
        don_vi_nhan: transfer.don_vi_nhan || "",
        dia_chi_don_vi: transfer.dia_chi_don_vi || "",
        nguoi_lien_he: transfer.nguoi_lien_he || "",
        so_dien_thoai: transfer.so_dien_thoai || "",
        ngay_du_kien_tra: transfer.ngay_du_kien_tra || ""
      })
      
      // Set selected equipment
      if (transfer.thiet_bi) {
        const equipment: EquipmentWithDept = {
          id: transfer.thiet_bi.id,
          ma_thiet_bi: transfer.thiet_bi.ma_thiet_bi,
          ten_thiet_bi: transfer.thiet_bi.ten_thiet_bi,
        }

        const modelValue = transfer.thiet_bi.model ?? undefined
        const serialValue = (transfer.thiet_bi.serial ?? transfer.thiet_bi.serial_number) ?? undefined
        const deptValue = transfer.thiet_bi.khoa_phong_quan_ly ?? undefined

        if (modelValue) {
          equipment.model = String(modelValue)
        }

        if (serialValue) {
          equipment.serial = String(serialValue)
        }

        if (deptValue) {
          equipment.khoa_phong_quan_ly = String(deptValue)
        }
        setSelectedEquipment(equipment)
        setSearchTerm(`${equipment.ten_thiet_bi} (${equipment.ma_thiet_bi})`)
      }
    } else if (!open) {
      resetForm()
    }
  }, [open, transfer, resetForm])

  const trimmedDebouncedSearch = React.useMemo(
    () => (debouncedSearch ?? '').trim(),
    [debouncedSearch]
  )

  const selectedValueLabel = React.useMemo(
    () => (selectedEquipment ? `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})` : ''),
    [selectedEquipment]
  )

  const canSearchEquipment = Boolean(canEdit && !isRegionalLeader)

  React.useEffect(() => {
    if (!open || !canSearchEquipment) {
      if (!open) {
        setEquipmentResults([])
      }
      setIsEquipmentLoading(false)
      return
    }

    if (trimmedDebouncedSearch.length < 2) {
      setEquipmentResults([])
      setIsEquipmentLoading(false)
      return
    }

    let isMounted = true
    const controller = new AbortController()

    setIsEquipmentLoading(true)
    setEquipmentResults([])

    ;(async () => {
      try {
        const result = await callRpc<EquipmentListEnhancedResponse>({
          fn: 'equipment_list_enhanced',
          args: {
            p_q: trimmedDebouncedSearch,
            p_sort: 'ten_thiet_bi.asc',
            p_page: 1,
            p_page_size: 20,
            p_fields: 'id,ma_thiet_bi,ten_thiet_bi,model,serial,khoa_phong_quan_ly',
          },
          signal: controller.signal,
        })

        if (!isMounted) {
          return
        }

        const rows = Array.isArray(result?.data) ? result.data : []
        const mapped = rows.reduce<EquipmentWithDept[]>((acc, item: any) => {
          const idRaw = item?.id ?? item?.equipment_id
          const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
          const maRaw = item?.ma_thiet_bi ?? item?.ma_tb
          const tenRaw = item?.ten_thiet_bi ?? item?.ten_tb

          if (!Number.isFinite(id) || id <= 0 || !maRaw || !tenRaw) {
            return acc
          }

          const modelRaw = item?.model ?? item?.model_number ?? undefined
          const serialRaw = item?.serial ?? item?.serial_number ?? undefined
          const deptRaw = item?.khoa_phong_quan_ly ?? item?.khoa_phong ?? item?.department_name ?? undefined

          const equipment: EquipmentWithDept = {
            id,
            ma_thiet_bi: String(maRaw),
            ten_thiet_bi: String(tenRaw),
          }

          if (modelRaw) {
            equipment.model = String(modelRaw)
          }

          if (serialRaw) {
            equipment.serial = String(serialRaw)
          }

          if (deptRaw) {
            equipment.khoa_phong_quan_ly = String(deptRaw)
          }

          acc.push(equipment)
          return acc
        }, [])

        setEquipmentResults(mapped)
      } catch (error: any) {
        if (!isMounted) {
          return
        }
        if (error?.name === 'AbortError') {
          return
        }

        toast({
          variant: 'destructive',
          title: 'Lỗi tìm kiếm thiết bị',
          description: error?.message || 'Không thể tải danh sách thiết bị.',
        })
      } finally {
        if (isMounted) {
          setIsEquipmentLoading(false)
        }
      }
    })()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [open, canSearchEquipment, trimmedDebouncedSearch, toast])

  const filteredEquipment = React.useMemo(() => {
    if (trimmedDebouncedSearch.length < 2) {
      return [] as EquipmentWithDept[]
    }

    if (selectedEquipment && searchTerm === selectedValueLabel) {
      return [] as EquipmentWithDept[]
    }

    return equipmentResults
  }, [equipmentResults, trimmedDebouncedSearch, searchTerm, selectedEquipment, selectedValueLabel])

  const isSelectedValueActive = Boolean(selectedEquipment && searchTerm === selectedValueLabel)
  const showResultsDropdown =
    canSearchEquipment &&
    trimmedDebouncedSearch.length >= 2 &&
    !isEquipmentLoading &&
    filteredEquipment.length > 0
  const showNoResults =
    canSearchEquipment &&
    trimmedDebouncedSearch.length >= 2 &&
    !isEquipmentLoading &&
    filteredEquipment.length === 0 &&
    !isSelectedValueActive
  const showMinCharsHint =
    canSearchEquipment &&
    trimmedDebouncedSearch.length > 0 &&
    trimmedDebouncedSearch.length < 2

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canSearchEquipment) {
      return
    }

    const value = e.target.value
    setSearchTerm(value)
    if (selectedEquipment && value !== selectedValueLabel) {
      setSelectedEquipment(null)
      setFormData(prev => ({
        ...prev,
        thiet_bi_id: 0,
        khoa_phong_hien_tai: "",
      }))
    }
  }

  const handleSelectEquipment = (equipment: EquipmentWithDept) => {
    if (!canSearchEquipment) {
      return
    }

    setSelectedEquipment(equipment);
    setSearchTerm(`${equipment.ten_thiet_bi} (${equipment.ma_thiet_bi})`);
    setFormData(prev => ({
      ...prev,
      thiet_bi_id: equipment.id,
      khoa_phong_hien_tai: equipment.khoa_phong_quan_ly || ""
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

    try {
      const payload: any = {
        thiet_bi_id: formData.thiet_bi_id,
        loai_hinh: formData.loai_hinh,
        ly_do_luan_chuyen: formData.ly_do_luan_chuyen.trim(),
        updated_by: user?.id
      }

      if (formData.loai_hinh === 'noi_bo') {
        payload.khoa_phong_hien_tai = formData.khoa_phong_hien_tai.trim()
        payload.khoa_phong_nhan = formData.khoa_phong_nhan.trim()
        payload.muc_dich = null
        payload.don_vi_nhan = null
        payload.dia_chi_don_vi = null
        payload.nguoi_lien_he = null
        payload.so_dien_thoai = null
        payload.ngay_du_kien_tra = null
      } else {
        payload.muc_dich = formData.muc_dich
        payload.don_vi_nhan = formData.don_vi_nhan.trim()
        payload.dia_chi_don_vi = formData.dia_chi_don_vi.trim() || null
        payload.nguoi_lien_he = formData.nguoi_lien_he.trim() || null
        payload.so_dien_thoai = formData.so_dien_thoai.trim() || null
        payload.ngay_du_kien_tra = formData.ngay_du_kien_tra || null
        payload.khoa_phong_hien_tai = null
        payload.khoa_phong_nhan = null
      }

      await callRpc({ fn: 'transfer_request_update', args: { p_id: transfer.id, p_data: payload } })

      toast({
        title: "Thành công",
        description: "Đã cập nhật yêu cầu luân chuyển."
      })

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi cập nhật yêu cầu."
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
            {/* Equipment Selection */}
            <div className="grid gap-2">
              <Label htmlFor="equipment">Thiết bị *</Label>
              <div className="relative">
                <Input
                  id="equipment"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Tìm kiếm thiết bị..."
                  disabled={isLoading || !canSearchEquipment}
                />
                {canSearchEquipment && (
                  <>
                    {showMinCharsHint && (
                      <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg p-3">
                        <div className="text-sm text-muted-foreground text-center">
                          Nhập tối thiểu 2 ký tự để tìm kiếm
                        </div>
                      </div>
                    )}
                    {trimmedDebouncedSearch.length >= 2 && (
                      <>
                        {isEquipmentLoading && (
                          <div className="absolute z-20 w-full mt-1 bg-popover border rounded-md shadow-lg p-3">
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Đang tìm kiếm thiết bị...</span>
                            </div>
                          </div>
                        )}
                        {showResultsDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-1">
                              {filteredEquipment.map((equipment) => (
                                <div
                                  key={equipment.id}
                                  className="text-sm p-2 hover:bg-accent rounded-sm cursor-pointer"
                                  onClick={() => handleSelectEquipment(equipment)}
                                >
                                  <div className="font-medium">{equipment.ten_thiet_bi} ({equipment.ma_thiet_bi})</div>
                                  <div className="text-xs text-muted-foreground">
                                    {equipment.model && `Model: ${equipment.model}`}
                                    {equipment.khoa_phong_quan_ly && ` • ${equipment.khoa_phong_quan_ly}`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {showNoResults && (
                          <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg p-3">
                            <div className="text-sm text-muted-foreground text-center">
                              Không tìm thấy kết quả phù hợp
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
              {!canSearchEquipment && (
                <p className="text-xs text-muted-foreground">
                  Không thể thay đổi thiết bị đối với vai trò hiện tại.
                </p>
              )}
              {selectedEquipment && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <Check className="h-3.5 w-3.5 text-green-600"/>
                  <span>Đã chọn: {selectedEquipment.ten_thiet_bi} ({selectedEquipment.ma_thiet_bi})</span>
                </p>
              )}
            </div>

            {/* Transfer Type */}
            <div className="grid gap-2">
              <Label htmlFor="type">Loại hình luân chuyển *</Label>
              <Select
                value={formData.loai_hinh}
                onValueChange={(value: TransferType) => setFormData(prev => ({ ...prev, loai_hinh: value }))}
                disabled={isLoading || !canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại hình" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRANSFER_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Badge variant={key === 'noi_bo' ? 'default' : 'secondary'}>
                          {label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional Fields for Internal Transfer */}
            {formData.loai_hinh === 'noi_bo' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="current_dept">Khoa/Phòng hiện tại *</Label>
                    <Input
                      id="current_dept"
                      value={formData.khoa_phong_hien_tai}
                      onChange={(e) => setFormData(prev => ({ ...prev, khoa_phong_hien_tai: e.target.value }))}
                      placeholder="Khoa/phòng hiện tại quản lý"
                      disabled={isLoading || !canEdit}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="receiving_dept">Khoa/Phòng nhận *</Label>
                    <Input
                      id="receiving_dept"
                      value={formData.khoa_phong_nhan}
                      onChange={(e) => setFormData(prev => ({ ...prev, khoa_phong_nhan: e.target.value }))}
                      placeholder="Khoa/phòng sẽ nhận thiết bị"
                      disabled={isLoading || !canEdit}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Conditional Fields for External Transfer */}
            {formData.loai_hinh === 'ben_ngoai' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="purpose">Mục đích *</Label>
                  <Select
                    value={formData.muc_dich}
                    onValueChange={(value: TransferPurpose) => setFormData(prev => ({ ...prev, muc_dich: value }))}
                    disabled={isLoading || !canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn mục đích" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRANSFER_PURPOSES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="external_org">Đơn vị nhận *</Label>
                  <Input
                    id="external_org"
                    value={formData.don_vi_nhan}
                    onChange={(e) => setFormData(prev => ({ ...prev, don_vi_nhan: e.target.value }))}
                    placeholder="Tên đơn vị/tổ chức nhận thiết bị"
                    disabled={isLoading || !canEdit}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">Địa chỉ đơn vị</Label>
                  <Textarea
                    id="address"
                    value={formData.dia_chi_don_vi}
                    onChange={(e) => setFormData(prev => ({ ...prev, dia_chi_don_vi: e.target.value }))}
                    placeholder="Địa chỉ của đơn vị nhận"
                    disabled={isLoading || !canEdit}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="contact_person">Người liên hệ</Label>
                    <Input
                      id="contact_person"
                      value={formData.nguoi_lien_he}
                      onChange={(e) => setFormData(prev => ({ ...prev, nguoi_lien_he: e.target.value }))}
                      placeholder="Tên người liên hệ"
                      disabled={isLoading || !canEdit}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Số điện thoại</Label>
                    <Input
                      id="phone"
                      value={formData.so_dien_thoai}
                      onChange={(e) => setFormData(prev => ({ ...prev, so_dien_thoai: e.target.value }))}
                      placeholder="Số điện thoại liên hệ"
                      disabled={isLoading || !canEdit}
                    />
                  </div>
                </div>

                {(formData.muc_dich === 'sua_chua' || formData.muc_dich === 'cho_muon') && (
                  <div className="grid gap-2">
                    <Label htmlFor="expected_return">Ngày dự kiến trả về</Label>
                    <Input
                      id="expected_return"
                      type="date"
                      value={formData.ngay_du_kien_tra}
                      onChange={(e) => setFormData(prev => ({ ...prev, ngay_du_kien_tra: e.target.value }))}
                      disabled={isLoading || !canEdit}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                )}
              </>
            )}

            {/* Reason */}
            <div className="grid gap-2">
              <Label htmlFor="reason">Lý do luân chuyển *</Label>
              <Textarea
                id="reason"
                value={formData.ly_do_luan_chuyen}
                onChange={(e) => setFormData(prev => ({ ...prev, ly_do_luan_chuyen: e.target.value }))}
                placeholder="Mô tả lý do cần luân chuyển thiết bị"
                disabled={isLoading || !canEdit}
                required
                rows={3}
              />
            </div>
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