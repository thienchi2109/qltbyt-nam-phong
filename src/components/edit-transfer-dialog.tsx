"use client"

import * as React from "react"
import { Loader2, Search, Check } from "lucide-react"

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
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

// Temporary interface for equipment with actual database columns
interface EquipmentWithDept {
  id: number;
  ma_thiet_bi: string;
  ten_thiet_bi: string;
  model?: string | null;
  serial?: string | null;
  khoa_phong_quan_ly?: string | null;
  tinh_trang?: string;
  ngay_nhap?: string;
  created_at?: string;
  updated_at?: string;
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
  const [isLoading, setIsLoading] = React.useState(false)
  const [allEquipment, setAllEquipment] = React.useState<EquipmentWithDept[]>([])
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
  const canEdit = transfer && (transfer.trang_thai === 'cho_duyet' || transfer.trang_thai === 'da_duyet')

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
          model: transfer.thiet_bi.model ?? null,
          serial: (transfer.thiet_bi.serial ?? transfer.thiet_bi.serial_number) ?? null,
          khoa_phong_quan_ly: transfer.thiet_bi.khoa_phong_quan_ly ?? null
        }
        setSelectedEquipment(equipment)
        setSearchTerm(`${equipment.ten_thiet_bi} (${equipment.ma_thiet_bi})`)
      }
    } else if (!open) {
      resetForm()
    }
  }, [open, transfer, resetForm])

  // Fetch equipment list when dialog opens
  React.useEffect(() => {
    if (open && allEquipment.length === 0) {
      fetchEquipment()
    }
  }, [open])

  const fetchEquipment = async () => {
    if (!supabase) return
    try {
      try {
        const equipments = await callRpc<any[]>({ fn: 'equipment_list', args: { p_q: null, p_sort: 'ma_thiet_bi', p_page: 1, p_page_size: 1000 } })
        const mapped: EquipmentWithDept[] = (equipments || []).map((e: any) => ({
          id: e.id,
          ma_thiet_bi: e.ma_thiet_bi,
          ten_thiet_bi: e.ten_thiet_bi,
          model: e.model ?? e.model_number ?? null,
          serial: e.serial ?? e.serial_number ?? null,
          khoa_phong_quan_ly: e.khoa_phong_quan_ly ?? null,
        }))
        setAllEquipment(mapped)
      } catch (rpcErr) {
        const { data, error } = await supabase
          .from('thiet_bi')
          .select('id, ma_thiet_bi, ten_thiet_bi, model, serial, khoa_phong_quan_ly')
          .order('ma_thiet_bi')
        if (error) throw error
        setAllEquipment(data as EquipmentWithDept[])
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi tải danh sách thiết bị",
        description: error.message
      })
    }
  }

  // Filter equipment based on search query
  const filteredEquipment = React.useMemo(() => {
    if (!debouncedSearch) return [];

    if (selectedEquipment && searchTerm === `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`) {
      return [];
    }

    return allEquipment.filter(
      (eq) =>
        eq.ten_thiet_bi.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        eq.ma_thiet_bi.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [debouncedSearch, allEquipment, selectedEquipment, searchTerm]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (selectedEquipment) {
      setSelectedEquipment(null);
      setFormData(prev => ({
        ...prev,
        thiet_bi_id: 0,
        khoa_phong_hien_tai: ""
      }))
    }
  }

  const handleSelectEquipment = (equipment: EquipmentWithDept) => {
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
                  disabled={isLoading || !canEdit}
                />
                {filteredEquipment.length > 0 && (
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
              </div>
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
            <Button type="submit" disabled={isLoading || !canEdit}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cập nhật
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 