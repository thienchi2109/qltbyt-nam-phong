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
import { Calendar as CalendarIcon } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { EquipmentSelectItem, RepairUnit } from "../types"
import { fetchRepairRequestEquipmentList } from "../repair-requests-equipment-rpc"
import { RepairRequestsCreateSheetActions } from "./RepairRequestsCreateSheetActions"
import { RepairRequestsCreateSheetAlerts } from "./RepairRequestsCreateSheetAlerts"
import { RepairRequestsEquipmentSearchField } from "./RepairRequestsEquipmentSearchField"
import { formatEquipmentLabel, parseDraftDate } from "./RepairRequestsCreateSheetUtils"

const REPAIR_REQUEST_EQUIPMENT_SEARCH_DEBOUNCE_MS = 300

export function RepairRequestsCreateSheet() {
  const {
    dialogState: { isCreateOpen, preSelectedEquipment },
    closeAllDialogs,
    createMutation,
    user,
    canSetRepairUnit,
    assistantDraft,
  } = useRepairRequestsContext()

  const isSheetMobile = useMediaQuery("(max-width: 1279px)")

  // Track if we've already prefilled from preSelectedEquipment (reset on close)
  const hasPrefilledRef = React.useRef(false)
  const hasHydratedFormFieldsRef = React.useRef(false)
  const hasUserEditedSearchRef = React.useRef(false)

  // Local form state
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentSelectItem | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [issueDescription, setIssueDescription] = React.useState("")
  const [repairItems, setRepairItems] = React.useState("")
  const [desiredDate, setDesiredDate] = React.useState<Date | undefined>()
  const [repairUnit, setRepairUnit] = React.useState<RepairUnit>("noi_bo")
  const [externalCompanyName, setExternalCompanyName] = React.useState("")
  const [allEquipment, setAllEquipment] = React.useState<EquipmentSelectItem[]>([])
  const [isSearchPending, setIsSearchPending] = React.useState(false)
  const [unresolvedDraftEquipment, setUnresolvedDraftEquipment] = React.useState(false)
  const [hasDraftEquipmentLookupCompleted, setHasDraftEquipmentLookupCompleted] = React.useState(false)
  const [hasSeededDraftEquipmentLookup, setHasSeededDraftEquipmentLookup] = React.useState(false)

  const draftEquipmentLabel = React.useMemo(() => {
    if (!assistantDraft?.equipment?.ten_thiet_bi || !assistantDraft.equipment.ma_thiet_bi) {
      return ""
    }

    return formatEquipmentLabel({
      ten_thiet_bi: assistantDraft.equipment.ten_thiet_bi,
      ma_thiet_bi: assistantDraft.equipment.ma_thiet_bi,
    })
  }, [assistantDraft])

  // Reset form when sheet closes, or initialize from pre-selected equipment when sheet opens
  React.useEffect(() => {
    if (!isCreateOpen) {
      setSelectedEquipment(null)
      setSearchQuery("")
      setIssueDescription("")
      setRepairItems("")
      setDesiredDate(undefined)
      setRepairUnit("noi_bo")
      setExternalCompanyName("")
      setUnresolvedDraftEquipment(false)
      setHasDraftEquipmentLookupCompleted(false)
      setHasSeededDraftEquipmentLookup(false)
      hasPrefilledRef.current = false
      hasHydratedFormFieldsRef.current = false
      hasUserEditedSearchRef.current = false
    } else if (assistantDraft) {
      // Hydrate non-equipment fields exactly once.
      if (!hasHydratedFormFieldsRef.current) {
        const fd = assistantDraft.formData
        if (fd.mo_ta_su_co) setIssueDescription(fd.mo_ta_su_co)
        if (fd.hang_muc_sua_chua) setRepairItems(fd.hang_muc_sua_chua)
        if (fd.ngay_mong_muon_hoan_thanh) {
          setDesiredDate(parseDraftDate(fd.ngay_mong_muon_hoan_thanh))
        }
        if (fd.don_vi_thuc_hien) setRepairUnit(fd.don_vi_thuc_hien)
        if (fd.ten_don_vi_thue) setExternalCompanyName(fd.ten_don_vi_thue)
        hasHydratedFormFieldsRef.current = true
      }

      if (!hasPrefilledRef.current && assistantDraft.equipment?.thiet_bi_id) {
        const resolved = allEquipment.find(
          eq => eq.id === assistantDraft.equipment?.thiet_bi_id,
        )
        if (resolved) {
          setSelectedEquipment(resolved)
          setSearchQuery(formatEquipmentLabel(resolved))
          setUnresolvedDraftEquipment(false)
          hasPrefilledRef.current = true
        } else if (hasDraftEquipmentLookupCompleted) {
          // Equipment lookup finished but ID not found — cross-tenant or stale
          setUnresolvedDraftEquipment(true)
          hasPrefilledRef.current = true
        } else if (
          draftEquipmentLabel &&
          !hasSeededDraftEquipmentLookup &&
          !hasUserEditedSearchRef.current
        ) {
          // Seed the lookup once, but never clobber manual user input.
          setSearchQuery(draftEquipmentLabel)
          setHasSeededDraftEquipmentLookup(true)
        }
      }
    } else if (preSelectedEquipment && !hasPrefilledRef.current) {
      // Pre-fill only once when opened with equipment from context
      setSelectedEquipment(preSelectedEquipment)
      setSearchQuery(`${preSelectedEquipment.ten_thiet_bi} (${preSelectedEquipment.ma_thiet_bi})`)
      hasPrefilledRef.current = true
      hasHydratedFormFieldsRef.current = true
    }
  }, [
    isCreateOpen,
    preSelectedEquipment,
    assistantDraft,
    allEquipment,
    draftEquipmentLabel,
    hasDraftEquipmentLookupCompleted,
    hasSeededDraftEquipmentLookup,
  ])

  // Fetch equipment options
  React.useEffect(() => {
    const label = selectedEquipment
      ? `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`
      : ""
    const q = searchQuery?.trim()
    if (!q || (label && q === label)) {
      setIsSearchPending(false)
      return
    }

    const ctrl = new AbortController()
    setIsSearchPending(true)
    const run = async () => {
      try {
        const eq = await fetchRepairRequestEquipmentList(q, 20, ctrl.signal)
        if (ctrl.signal.aborted) return
        setAllEquipment(eq || [])
        setIsSearchPending(false)
        if (assistantDraft?.equipment?.thiet_bi_id && q === draftEquipmentLabel) {
          setHasDraftEquipmentLookupCompleted(true)
        }
      } catch (e) {
        if (ctrl.signal.aborted) return
        setAllEquipment([])
        setIsSearchPending(false)
      }
    }
    const timeoutId = window.setTimeout(run, REPAIR_REQUEST_EQUIPMENT_SEARCH_DEBOUNCE_MS)
    return () => {
      ctrl.abort()
      window.clearTimeout(timeoutId)
    }
  }, [assistantDraft, draftEquipmentLabel, searchQuery, selectedEquipment])

  const filteredEquipment = React.useMemo(() => {
    if (!searchQuery) return []
    if (isSearchPending) return []
    if (selectedEquipment && searchQuery === `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`) {
      return []
    }
    return allEquipment
  }, [searchQuery, isSearchPending, allEquipment, selectedEquipment])

  const shouldShowNoResults = React.useMemo(() => {
    if (!searchQuery) return false
    if (isSearchPending) return false
    if (selectedEquipment && searchQuery === `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`) {
      return false
    }
    return filteredEquipment.length === 0
  }, [searchQuery, isSearchPending, selectedEquipment, filteredEquipment])

  const handleSelectEquipment = (equipment: EquipmentSelectItem) => {
    setSelectedEquipment(equipment)
    setSearchQuery(formatEquipmentLabel(equipment))
    setUnresolvedDraftEquipment(false)
    hasUserEditedSearchRef.current = true
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextQuery = e.target.value
    const nextTrimmedQuery = nextQuery.trim()
    const selectedLabel = selectedEquipment
      ? `${selectedEquipment.ten_thiet_bi} (${selectedEquipment.ma_thiet_bi})`
      : ""

    hasUserEditedSearchRef.current = true
    setSearchQuery(nextQuery)
    setIsSearchPending(Boolean(nextTrimmedQuery) && nextTrimmedQuery !== selectedLabel)
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
          <RepairRequestsCreateSheetAlerts
            hasAssistantDraft={Boolean(assistantDraft)}
            showUnresolvedDraftEquipment={unresolvedDraftEquipment}
          />
          <form onSubmit={handleSubmit} className="space-y-4">
            <RepairRequestsEquipmentSearchField
              searchQuery={searchQuery}
              selectedEquipment={selectedEquipment}
              filteredEquipment={filteredEquipment}
              shouldShowNoResults={shouldShowNoResults}
              onSearchChange={handleSearchChange}
              onSelectEquipment={handleSelectEquipment}
            />
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

            <RepairRequestsCreateSheetActions
              isSubmitting={createMutation.isPending}
              onCancel={closeAllDialogs}
            />
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Export alias for backwards compatibility
export const CreateRequestSheet = RepairRequestsCreateSheet
