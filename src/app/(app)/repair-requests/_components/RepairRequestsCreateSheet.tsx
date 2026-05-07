"use client"

import * as React from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader as SheetHeaderUI,
  SheetTitle,
} from "@/components/ui/sheet"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { EquipmentSelectItem, RepairUnit } from "../types"
import { fetchRepairRequestEquipmentList } from "../repair-requests-equipment-rpc"
import { RepairRequestsCreateSheetAlerts } from "./RepairRequestsCreateSheetAlerts"
import { RepairRequestsCreateSheetForm } from "./RepairRequestsCreateSheetForm"
import { formatEquipmentLabel, parseDraftDate } from "./RepairRequestsCreateSheetUtils"
import { format } from "date-fns"

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
        hang_muc_sua_chua: repairItems.trim() || null,
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
      <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
        <div className="flex h-full flex-col">
          <SheetHeaderUI className="border-b p-4">
            <SheetTitle>Tạo yêu cầu sửa chữa</SheetTitle>
            <SheetDescription>Điền thông tin bên dưới để gửi yêu cầu mới.</SheetDescription>
          </SheetHeaderUI>
          <div className="mt-4 flex-1 overflow-y-auto px-4 pb-4">
            <RepairRequestsCreateSheetAlerts
              hasAssistantDraft={Boolean(assistantDraft)}
              showUnresolvedDraftEquipment={unresolvedDraftEquipment}
            />
            <RepairRequestsCreateSheetForm
              canSetRepairUnit={canSetRepairUnit}
              desiredDate={desiredDate}
              externalCompanyName={externalCompanyName}
              filteredEquipment={filteredEquipment}
              handleSearchChange={handleSearchChange}
              handleSelectEquipment={handleSelectEquipment}
              handleSubmit={handleSubmit}
              isSubmitting={createMutation.isPending}
              issueDescription={issueDescription}
              onCancel={closeAllDialogs}
              repairItems={repairItems}
              repairUnit={repairUnit}
              searchQuery={searchQuery}
              selectedEquipment={selectedEquipment}
              setDesiredDate={setDesiredDate}
              setExternalCompanyName={setExternalCompanyName}
              setIssueDescription={setIssueDescription}
              setRepairItems={setRepairItems}
              setRepairUnit={setRepairUnit}
              shouldShowNoResults={shouldShowNoResults}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Export alias for backwards compatibility
export const CreateRequestSheet = RepairRequestsCreateSheet
