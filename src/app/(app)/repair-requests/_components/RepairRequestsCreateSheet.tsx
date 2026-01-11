"use client"

import * as React from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader as SheetHeaderUI,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { callRpc } from "@/lib/rpc-client"
import { Calendar as CalendarIcon, Check, Loader2 } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { EquipmentSelectItem, RepairUnit } from "../types"

export function RepairRequestsCreateSheet() {
  const {
    dialogState: { isCreateOpen },
    closeAllDialogs,
    createMutation,
    user,
    canSetRepairUnit,
  } = useRepairRequestsContext()

  const isSheetMobile = useMediaQuery("(max-width: 1279px)")

  // Local form state
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentSelectItem | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [issueDescription, setIssueDescription] = React.useState("")
  const [repairItems, setRepairItems] = React.useState("")
  const [desiredDate, setDesiredDate] = React.useState<Date | undefined>()
  const [repairUnit, setRepairUnit] = React.useState<RepairUnit>("noi_bo")
  const [externalCompanyName, setExternalCompanyName] = React.useState("")
  const [allEquipment, setAllEquipment] = React.useState<EquipmentSelectItem[]>([])

  // Reset form when sheet closes
  React.useEffect(() => {
    if (!isCreateOpen) {
      setSelectedEquipment(null)
      setSearchQuery("")
      setIssueDescription("")
      setRepairItems("")
      setDesiredDate(undefined)
      setRepairUnit("noi_bo")
      setExternalCompanyName("")
    }
  }, [isCreateOpen])

  // Fetch equipment options
  React.useEffect(() => {
    const label = selectedEquipment
      ? `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`
      : ""
    const q = searchQuery?.trim()
    if (!q || (label && q === label)) return

    const ctrl = new AbortController()
    const run = async () => {
      try {
        const eq = await callRpc<any[]>({
          fn: "equipment_list",
          args: { p_q: q, p_sort: "ten_thiet_bi.asc", p_page: 1, p_page_size: 20 },
        })
        if (ctrl.signal.aborted) return
        setAllEquipment(
          (eq || []).map((row: any) => ({
            id: row.id,
            ma_thiet_bi: row.ma_thiet_bi,
            ten_thiet_bi: row.ten_thiet_bi,
            khoa_phong_quan_ly: row.khoa_phong_quan_ly,
          }))
        )
      } catch (e) {
        // Silent fail for suggestions
      }
    }
    run()
    return () => ctrl.abort()
  }, [searchQuery, selectedEquipment])

  const filteredEquipment = React.useMemo(() => {
    if (!searchQuery) return []
    if (selectedEquipment && searchQuery === `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`) {
      return []
    }
    return allEquipment
  }, [searchQuery, allEquipment, selectedEquipment])

  const shouldShowNoResults = React.useMemo(() => {
    if (!searchQuery) return false
    if (selectedEquipment && searchQuery === `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`) {
      return false
    }
    return filteredEquipment.length === 0
  }, [searchQuery, selectedEquipment, filteredEquipment])

  const handleSelectEquipment = (equipment: EquipmentSelectItem) => {
    setSelectedEquipment(equipment)
    setSearchQuery(`${equipment.ten_thiet_bi} (${equipment.ma_thiet_bi})`)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    if (selectedEquipment) {
      setSelectedEquipment(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEquipment || !user) return

    createMutation.mutate(
      {
        thiet_bi_id: selectedEquipment.id,
        mo_ta_su_co: issueDescription,
        hang_muc_sua_chua: repairItems,
        ngay_mong_muon_hoan_thanh: desiredDate ? format(desiredDate, "yyyy-MM-dd") : null,
        nguoi_yeu_cau: user.full_name || user.username,
        don_vi_thuc_hien: canSetRepairUnit ? repairUnit : null,
        ten_don_vi_thue: canSetRepairUnit && repairUnit === "thue_ngoai"
          ? externalCompanyName.trim()
          : null,
      },
      { onSuccess: closeAllDialogs }
    )
  }

  return (
    <Sheet open={isCreateOpen} onOpenChange={(open) => !open && closeAllDialogs()}>
      <SheetContent
        side={isSheetMobile ? "bottom" : "right"}
        className={cn(isSheetMobile ? "h-[90vh] p-0" : "sm:max-w-lg")}
      >
        <SheetHeaderUI className={cn(isSheetMobile ? "p-4 border-b" : "")}>
          <SheetTitle>Tạo yêu cầu sửa chữa</SheetTitle>
          <SheetDescription>Điền thông tin bên dưới để gửi yêu cầu mới.</SheetDescription>
        </SheetHeaderUI>
        <div className={cn("mt-4", isSheetMobile ? "px-4 overflow-y-auto h-[calc(90vh-80px)]" : "")}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-equipment">Thiết bị</Label>
              <div className="relative">
                <Input
                  id="search-equipment"
                  placeholder="Nhập tên hoặc mã để tìm kiếm..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  autoComplete="off"
                  required
                />
                {filteredEquipment.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-1">
                      {filteredEquipment.map((equipment) => (
                        <div
                          key={equipment.id}
                          className="text-sm mobile-interactive hover:bg-accent rounded-sm cursor-pointer touch-target-sm"
                          onClick={() => handleSelectEquipment(equipment)}
                        >
                          <div className="font-medium">{equipment.ten_thiet_bi}</div>
                          <div className="text-xs text-muted-foreground">
                            {equipment.ma_thiet_bi}
                            {equipment.khoa_phong_quan_ly && (
                              <span className="ml-2 text-blue-600">• {equipment.khoa_phong_quan_ly}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {shouldShowNoResults && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg p-3">
                    <div className="text-sm text-muted-foreground text-center">
                      Không tìm thấy kết quả phù hợp
                    </div>
                  </div>
                )}
              </div>
              {selectedEquipment && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  <span>Đã chọn: {selectedEquipment.ten_thiet_bi} ({selectedEquipment.ma_thiet_bi})</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue">Mô tả sự cố</Label>
              <Textarea
                id="issue"
                placeholder="Mô tả chi tiết vấn đề gặp phải..."
                rows={4}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repair-items">Các hạng mục yêu cầu sửa chữa</Label>
              <Textarea
                id="repair-items"
                placeholder="VD: Thay màn hình, sửa nguồn..."
                rows={3}
                value={repairItems}
                onChange={(e) => setRepairItems(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Ngày mong muốn hoàn thành (nếu có)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal touch-target",
                      !desiredDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {desiredDate ? format(desiredDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={desiredDate}
                    onSelect={setDesiredDate}
                    initialFocus
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {canSetRepairUnit && (
              <div className="space-y-2">
                <Label htmlFor="repair-unit">Đơn vị thực hiện</Label>
                <Select value={repairUnit} onValueChange={(value) => setRepairUnit(value as RepairUnit)}>
                  <SelectTrigger className="touch-target">
                    <SelectValue placeholder="Chọn đơn vị thực hiện" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="noi_bo">Nội bộ</SelectItem>
                    <SelectItem value="thue_ngoai">Thuê ngoài</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {canSetRepairUnit && repairUnit === "thue_ngoai" && (
              <div className="space-y-2">
                <Label htmlFor="external-company">Tên đơn vị được thuê</Label>
                <Input
                  id="external-company"
                  placeholder="Nhập tên đơn vị được thuê sửa chữa..."
                  value={externalCompanyName}
                  onChange={(e) => setExternalCompanyName(e.target.value)}
                  required
                  className="touch-target"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 touch-target"
                onClick={closeAllDialogs}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="flex-1 touch-target"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {createMutation.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Export alias for backwards compatibility
export const CreateRequestSheet = RepairRequestsCreateSheet
