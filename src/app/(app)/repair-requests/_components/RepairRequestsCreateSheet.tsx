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

interface RepairRequestsCreateFormState {
  allEquipment: EquipmentSelectItem[]
  desiredDate: Date | undefined
  externalCompanyName: string
  hasDraftEquipmentLookupCompleted: boolean
  hasSeededDraftEquipmentLookup: boolean
  isSearchPending: boolean
  issueDescription: string
  repairItems: string
  repairUnit: RepairUnit
  searchQuery: string
  selectedEquipment: EquipmentSelectItem | null
  unresolvedDraftEquipment: boolean
}

type RepairRequestsCreateFormAction =
  | { type: "patch"; updates: Partial<RepairRequestsCreateFormState> }
  | { type: "reset" }

const initialCreateFormState: RepairRequestsCreateFormState = {
  allEquipment: [],
  desiredDate: undefined,
  externalCompanyName: "",
  hasDraftEquipmentLookupCompleted: false,
  hasSeededDraftEquipmentLookup: false,
  isSearchPending: false,
  issueDescription: "",
  repairItems: "",
  repairUnit: "noi_bo",
  searchQuery: "",
  selectedEquipment: null,
  unresolvedDraftEquipment: false,
}

function repairRequestsCreateFormReducer(
  state: RepairRequestsCreateFormState,
  action: RepairRequestsCreateFormAction,
): RepairRequestsCreateFormState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.updates }
    case "reset":
      return initialCreateFormState
  }
}

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

  const [formState, dispatchForm] = React.useReducer(
    repairRequestsCreateFormReducer,
    initialCreateFormState,
  )

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
      dispatchForm({ type: "reset" })
      hasPrefilledRef.current = false
      hasHydratedFormFieldsRef.current = false
      hasUserEditedSearchRef.current = false
    } else if (assistantDraft) {
      // Hydrate non-equipment fields exactly once.
      if (!hasHydratedFormFieldsRef.current) {
        const fd = assistantDraft.formData
        dispatchForm({
          type: "patch",
          updates: {
            desiredDate: fd.ngay_mong_muon_hoan_thanh
              ? parseDraftDate(fd.ngay_mong_muon_hoan_thanh)
              : formState.desiredDate,
            externalCompanyName: fd.ten_don_vi_thue || formState.externalCompanyName,
            issueDescription: fd.mo_ta_su_co || formState.issueDescription,
            repairItems: fd.hang_muc_sua_chua || formState.repairItems,
            repairUnit: fd.don_vi_thuc_hien || formState.repairUnit,
          },
        })
        hasHydratedFormFieldsRef.current = true
      }

      if (!hasPrefilledRef.current && assistantDraft.equipment?.thiet_bi_id) {
        const resolved = formState.allEquipment.find(
          eq => eq.id === assistantDraft.equipment?.thiet_bi_id,
        )
        if (resolved) {
          dispatchForm({
            type: "patch",
            updates: {
              searchQuery: formatEquipmentLabel(resolved),
              selectedEquipment: resolved,
              unresolvedDraftEquipment: false,
            },
          })
          hasPrefilledRef.current = true
        } else if (formState.hasDraftEquipmentLookupCompleted) {
          // Equipment lookup finished but ID not found — cross-tenant or stale
          dispatchForm({
            type: "patch",
            updates: { unresolvedDraftEquipment: true },
          })
          hasPrefilledRef.current = true
        } else if (
          draftEquipmentLabel &&
          !formState.hasSeededDraftEquipmentLookup &&
          !hasUserEditedSearchRef.current
        ) {
          // Seed the lookup once, but never clobber manual user input.
          dispatchForm({
            type: "patch",
            updates: {
              hasSeededDraftEquipmentLookup: true,
              searchQuery: draftEquipmentLabel,
            },
          })
        }
      }
    } else if (preSelectedEquipment && !hasPrefilledRef.current) {
      // Pre-fill only once when opened with equipment from context
      dispatchForm({
        type: "patch",
        updates: {
          searchQuery: formatEquipmentLabel(preSelectedEquipment),
          selectedEquipment: preSelectedEquipment,
        },
      })
      hasPrefilledRef.current = true
      hasHydratedFormFieldsRef.current = true
    }
  }, [
    isCreateOpen,
    preSelectedEquipment,
    assistantDraft,
    draftEquipmentLabel,
    formState.allEquipment,
    formState.desiredDate,
    formState.externalCompanyName,
    formState.hasDraftEquipmentLookupCompleted,
    formState.hasSeededDraftEquipmentLookup,
    formState.issueDescription,
    formState.repairItems,
    formState.repairUnit,
  ])

  // Fetch equipment options
  React.useEffect(() => {
    const label = formState.selectedEquipment
      ? formatEquipmentLabel(formState.selectedEquipment)
      : ""
    const q = formState.searchQuery?.trim()
    if (!q || (label && q === label)) {
      dispatchForm({ type: "patch", updates: { isSearchPending: false } })
      return
    }

    const ctrl = new AbortController()
    dispatchForm({ type: "patch", updates: { isSearchPending: true } })
    const run = async () => {
      try {
        const eq = await fetchRepairRequestEquipmentList(q, 20, ctrl.signal)
        if (ctrl.signal.aborted) return
        const completedDraftEquipmentLookup = Boolean(
          assistantDraft?.equipment?.thiet_bi_id && q === draftEquipmentLabel,
        )
        dispatchForm({
          type: "patch",
          updates: {
            allEquipment: eq || [],
            ...(completedDraftEquipmentLookup ? { hasDraftEquipmentLookupCompleted: true } : {}),
            isSearchPending: false,
          },
        })
      } catch (e) {
        if (ctrl.signal.aborted) return
        dispatchForm({
          type: "patch",
          updates: { allEquipment: [], isSearchPending: false },
        })
      }
    }
    const timeoutId = window.setTimeout(run, REPAIR_REQUEST_EQUIPMENT_SEARCH_DEBOUNCE_MS)
    return () => {
      ctrl.abort()
      window.clearTimeout(timeoutId)
    }
  }, [
    assistantDraft,
    draftEquipmentLabel,
    formState.searchQuery,
    formState.selectedEquipment,
  ])

  const filteredEquipment = React.useMemo(() => {
    if (!formState.searchQuery) return []
    if (formState.isSearchPending) return []
    if (formState.selectedEquipment && formState.searchQuery === formatEquipmentLabel(formState.selectedEquipment)) {
      return []
    }
    return formState.allEquipment
  }, [formState.searchQuery, formState.isSearchPending, formState.allEquipment, formState.selectedEquipment])

  const shouldShowNoResults = React.useMemo(() => {
    if (!formState.searchQuery) return false
    if (formState.isSearchPending) return false
    if (formState.selectedEquipment && formState.searchQuery === formatEquipmentLabel(formState.selectedEquipment)) {
      return false
    }
    return filteredEquipment.length === 0
  }, [formState.searchQuery, formState.isSearchPending, formState.selectedEquipment, filteredEquipment])

  const handleSelectEquipment = (equipment: EquipmentSelectItem) => {
    dispatchForm({
      type: "patch",
      updates: {
        searchQuery: formatEquipmentLabel(equipment),
        selectedEquipment: equipment,
        unresolvedDraftEquipment: false,
      },
    })
    hasUserEditedSearchRef.current = true
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextQuery = e.target.value
    const nextTrimmedQuery = nextQuery.trim()
    const selectedLabel = formState.selectedEquipment
      ? formatEquipmentLabel(formState.selectedEquipment)
      : ""

    hasUserEditedSearchRef.current = true
    dispatchForm({
      type: "patch",
      updates: {
        isSearchPending: Boolean(nextTrimmedQuery) && nextTrimmedQuery !== selectedLabel,
        searchQuery: nextQuery,
        selectedEquipment: formState.selectedEquipment ? null : formState.selectedEquipment,
      },
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formState.selectedEquipment || !user) return

    createMutation.mutate(
      {
        thiet_bi_id: formState.selectedEquipment.id,
        mo_ta_su_co: formState.issueDescription,
        hang_muc_sua_chua: formState.repairItems.trim() || null,
        ngay_mong_muon_hoan_thanh: formState.desiredDate ? format(formState.desiredDate, "yyyy-MM-dd") : null,
        nguoi_yeu_cau: user.full_name || user.username,
        don_vi_thuc_hien: canSetRepairUnit ? formState.repairUnit : null,
        ten_don_vi_thue: canSetRepairUnit && formState.repairUnit === "thue_ngoai"
          ? formState.externalCompanyName.trim()
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
              showUnresolvedDraftEquipment={formState.unresolvedDraftEquipment}
            />
            <RepairRequestsCreateSheetForm
              canSetRepairUnit={canSetRepairUnit}
              desiredDate={formState.desiredDate}
              externalCompanyName={formState.externalCompanyName}
              filteredEquipment={filteredEquipment}
              handleSearchChange={handleSearchChange}
              handleSelectEquipment={handleSelectEquipment}
              handleSubmit={handleSubmit}
              isSubmitting={createMutation.isPending}
              issueDescription={formState.issueDescription}
              onDesiredDateChange={(desiredDate) => dispatchForm({ type: "patch", updates: { desiredDate } })}
              onExternalCompanyNameChange={(externalCompanyName) => dispatchForm({ type: "patch", updates: { externalCompanyName } })}
              onIssueDescriptionChange={(issueDescription) => dispatchForm({ type: "patch", updates: { issueDescription } })}
              onRepairItemsChange={(repairItems) => dispatchForm({ type: "patch", updates: { repairItems } })}
              onRepairUnitChange={(repairUnit) => dispatchForm({ type: "patch", updates: { repairUnit } })}
              onCancel={closeAllDialogs}
              repairItems={formState.repairItems}
              repairUnit={formState.repairUnit}
              searchQuery={formState.searchQuery}
              selectedEquipment={formState.selectedEquipment}
              shouldShowNoResults={shouldShowNoResults}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Export alias for backwards compatibility
const CreateRequestSheet = RepairRequestsCreateSheet
