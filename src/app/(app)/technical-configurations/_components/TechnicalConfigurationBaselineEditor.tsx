import * as React from "react"
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Save, Trash2 } from "lucide-react"

import type { TechnicalConfigurationBulkEntrySession } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { hasTechnicalConfigurationBulkEntryInput } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import type {
  TechnicalConfigurationBaselineEditorDraft,
  TechnicalConfigurationBaselineEditorValidation,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { TechnicalConfigurationAllGroupsOverview } from "./TechnicalConfigurationAllGroupsOverview"
import { TechnicalConfigurationBaselineEditorIconButton as IconButton } from "./TechnicalConfigurationBaselineEditorControls"
import { TechnicalConfigurationBulkEntryWorkbench } from "./TechnicalConfigurationBulkEntryWorkbench"
import { TechnicalConfigurationCriteriaSpreadsheet } from "./TechnicalConfigurationCriteriaSpreadsheet"
import {
  ALL_GROUPS_VALUE,
  getTechnicalConfigurationGroupTabId,
  GROUP_WORKSPACE_PANEL_ID,
} from "./TechnicalConfigurationGroupNavigation"
import { TechnicalConfigurationGroupNavigator } from "./TechnicalConfigurationGroupNavigator"

export type TechnicalConfigurationEntryMode = "row" | "bulk"
export type TechnicalConfigurationFocusTarget =
  | { kind: "criterion"; key: string; token: number }
  | { kind: "group-name"; key: string; token: number }
  | { kind: "group-tab"; key: string; token: number }
  | { kind: "mode-tab"; mode: TechnicalConfigurationEntryMode; token: number }
  | { kind: "bulk-input"; token: number }
  | { kind: "add-group"; token: number }
  | { kind: "add-criterion"; token: number }
  | null

type CriterionTextField = "title" | "requirementText"

type TechnicalConfigurationBaselineEditorStatus = {
  dirty: boolean
  saving: boolean
  editingDisabled: boolean
  conflict: boolean
  saveStatus: "idle" | "saved"
  hasPendingBulkInput: boolean
}

type TechnicalConfigurationBaselineEditorProps = Readonly<{
  draft: TechnicalConfigurationBaselineEditorDraft
  validation: TechnicalConfigurationBaselineEditorValidation
  summaryValidation: TechnicalConfigurationBaselineEditorValidation
  status: TechnicalConfigurationBaselineEditorStatus
  activeValue: string
  entryMode: TechnicalConfigurationEntryMode
  bulkSession: TechnicalConfigurationBulkEntrySession
  focusTarget: TechnicalConfigurationFocusTarget
  recentlyAcceptedCriterionKeys: ReadonlySet<string>
  onNavigate: (value: string) => void
  onModeChange: (mode: TechnicalConfigurationEntryMode) => void
  onAddGroup: () => void
  onGroupNameChange: (groupKey: string, name: string) => void
  onMoveGroup: (groupIndex: number, offset: -1 | 1) => void
  onDeleteGroup: (groupKey: string) => void
  onCriterionTextChange: (
    groupKey: string,
    criterionKey: string,
    field: CriterionTextField,
    value: string
  ) => void
  onMoveCriterion: (groupKey: string, criterionIndex: number, offset: -1 | 1) => void
  onDeleteCriterion: (groupKey: string, criterionKey: string) => void
  onAddCriterion: (groupKey: string) => void
  onBulkInputChange: (input: string) => void
  onBulkPreview: () => void
  onBulkCancel: () => void
  onBulkAccept: () => void
  onOverviewCriterionActivate: (groupKey: string, criterionKey: string) => void
  onSave: () => void
}>

const PENDING_BULK_STATUS_ID = "technical-configuration-pending-bulk-status"

/** Composes the selected-group spreadsheet, inline bulk entry, and overview surfaces. */
export function TechnicalConfigurationBaselineEditor({
  draft,
  validation,
  summaryValidation,
  status,
  activeValue,
  entryMode,
  bulkSession,
  focusTarget,
  recentlyAcceptedCriterionKeys,
  onNavigate,
  onModeChange,
  onAddGroup,
  onGroupNameChange,
  onMoveGroup,
  onDeleteGroup,
  onCriterionTextChange,
  onMoveCriterion,
  onDeleteCriterion,
  onAddCriterion,
  onBulkInputChange,
  onBulkPreview,
  onBulkCancel,
  onBulkAccept,
  onOverviewCriterionActivate,
  onSave,
}: TechnicalConfigurationBaselineEditorProps) {
  const {
    dirty: isDirty,
    saving: isSaving,
    editingDisabled: isEditingDisabled,
    conflict: isConflict,
    saveStatus,
    hasPendingBulkInput,
  } = status
  const selectedGroupIndex = draft.groups.findIndex((group) => group.key === activeValue)
  const selectedGroup = selectedGroupIndex >= 0 ? draft.groups[selectedGroupIndex] : null
  const selectedGroupHasPendingInput = hasTechnicalConfigurationBulkEntryInput(bulkSession.input)
  const addGroupRef = React.useRef<HTMLButtonElement>(null)
  const groupNameRef = React.useRef<HTMLInputElement>(null)
  const rowModeRef = React.useRef<HTMLButtonElement>(null)
  const bulkModeRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!focusTarget) return
    if (focusTarget.kind === "add-group") addGroupRef.current?.focus()
    else if (focusTarget.kind === "group-name" && focusTarget.key === selectedGroup?.key) {
      groupNameRef.current?.focus()
    } else if (focusTarget.kind === "mode-tab") {
      const target = focusTarget.mode === "row" ? rowModeRef.current : bulkModeRef.current
      target?.focus()
    }
  }, [focusTarget, selectedGroup?.key])

  return (
    <section aria-label="Trình soạn cấu hình cơ sở">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Bản nháp cấu hình cơ sở</h2>
            <Badge variant="secondary">Bản nháp</Badge>
          </div>
          {hasPendingBulkInput ? (
            <p id={PENDING_BULK_STATUS_ID} className="mt-1 text-sm font-medium text-amber-700">
              Hoàn tất hoặc hủy phần nhập nhiều dòng trước khi lưu.
            </p>
          ) : isDirty ? (
            <p className="mt-1 text-sm font-medium text-amber-700">Có thay đổi chưa lưu</p>
          ) : saveStatus === "saved" ? (
            <p className="mt-1 text-sm font-medium text-emerald-700">Đã lưu</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            ref={addGroupRef}
            type="button"
            variant="outline"
            disabled={isEditingDisabled}
            onClick={onAddGroup}
          >
            <Plus className="size-4" aria-hidden="true" />
            Thêm nhóm
          </Button>
          <Button
            type="button"
            disabled={!isDirty || isSaving || isConflict || hasPendingBulkInput}
            aria-describedby={hasPendingBulkInput ? PENDING_BULK_STATUS_ID : undefined}
            onClick={onSave}
          >
            {isSaving ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {isSaving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>

      <TechnicalConfigurationGroupNavigator
        groups={draft.groups}
        activeValue={activeValue}
        validation={summaryValidation}
        focusGroupRequest={
          focusTarget?.kind === "group-tab"
            ? { groupKey: focusTarget.key, token: focusTarget.token }
            : null
        }
        onValueChange={onNavigate}
      />

      <div
        id={GROUP_WORKSPACE_PANEL_ID}
        role="tabpanel"
        aria-labelledby={activeValue ? getTechnicalConfigurationGroupTabId(activeValue) : undefined}
      >
        {activeValue === ALL_GROUPS_VALUE ? (
          <TechnicalConfigurationAllGroupsOverview
            draft={draft}
            validation={summaryValidation}
            onCriterionActivate={onOverviewCriterionActivate}
          />
        ) : selectedGroup ? (
          <Tabs
            value={entryMode}
            activationMode="manual"
            className="py-5"
            onValueChange={(value) => onModeChange(value as TechnicalConfigurationEntryMode)}
          >
            <div className="grid gap-4 border-b pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid min-w-0 gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-start">
                <span className="flex size-10 items-center justify-center rounded-md border bg-muted text-sm font-semibold">
                  {selectedGroupIndex + 1}
                </span>
                <div className="min-w-0">
                  <label className="sr-only" htmlFor={`baseline-group-${selectedGroup.key}`}>
                    Tên nhóm {selectedGroupIndex + 1}
                  </label>
                  <Input
                    ref={groupNameRef}
                    id={`baseline-group-${selectedGroup.key}`}
                    aria-label={`Tên nhóm ${selectedGroupIndex + 1}`}
                    value={selectedGroup.name}
                    disabled={isEditingDisabled}
                    aria-invalid={Boolean(validation.groupErrors[selectedGroup.key])}
                    onChange={(event) => onGroupNameChange(selectedGroup.key, event.target.value)}
                  />
                  {validation.groupErrors[selectedGroup.key] ? (
                    <p className="mt-1 text-sm text-destructive">
                      {validation.groupErrors[selectedGroup.key]}
                    </p>
                  ) : null}
                </div>
                <div className="flex h-10 items-center gap-1">
                  <IconButton
                    label={`Di chuyển nhóm ${selectedGroupIndex + 1} lên`}
                    title="Di chuyển lên"
                    disabled={isEditingDisabled || selectedGroupIndex === 0}
                    onClick={() => onMoveGroup(selectedGroupIndex, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Di chuyển nhóm ${selectedGroupIndex + 1} xuống`}
                    title="Di chuyển xuống"
                    disabled={isEditingDisabled || selectedGroupIndex === draft.groups.length - 1}
                    onClick={() => onMoveGroup(selectedGroupIndex, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Xóa nhóm ${selectedGroupIndex + 1}`}
                    title="Xóa nhóm"
                    disabled={isEditingDisabled}
                    aria-disabled={selectedGroupHasPendingInput}
                    aria-describedby={
                      selectedGroupHasPendingInput ? PENDING_BULK_STATUS_ID : undefined
                    }
                    onClick={() => {
                      if (!selectedGroupHasPendingInput) onDeleteGroup(selectedGroup.key)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <TabsList className="grid w-full grid-cols-2 lg:w-auto">
                <TabsTrigger ref={rowModeRef} value="row">
                  Chỉnh từng dòng
                </TabsTrigger>
                <TabsTrigger ref={bulkModeRef} value="bulk">
                  Nhập nhiều dòng
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="row" className="mt-0 pt-5">
              <TechnicalConfigurationCriteriaSpreadsheet
                group={selectedGroup}
                groupIndex={selectedGroupIndex + 1}
                criterionErrors={validation.criterionErrors}
                disabled={isEditingDisabled}
                focusCriterionKey={focusTarget?.kind === "criterion" ? focusTarget.key : null}
                focusCriterionToken={focusTarget?.kind === "criterion" ? focusTarget.token : null}
                focusAddCriterionToken={
                  focusTarget?.kind === "add-criterion" ? focusTarget.token : null
                }
                recentlyAcceptedCriterionKeys={recentlyAcceptedCriterionKeys}
                onCriterionTextChange={(criterionKey, field, value) =>
                  onCriterionTextChange(selectedGroup.key, criterionKey, field, value)
                }
                onMoveCriterion={(criterionIndex, offset) =>
                  onMoveCriterion(selectedGroup.key, criterionIndex, offset)
                }
                onDeleteCriterion={(criterionKey) =>
                  onDeleteCriterion(selectedGroup.key, criterionKey)
                }
                onAddCriterion={() => onAddCriterion(selectedGroup.key)}
              />
            </TabsContent>
            <TabsContent value="bulk" className="mt-0">
              <TechnicalConfigurationBulkEntryWorkbench
                groupName={selectedGroup.name.trim() || `Nhóm ${selectedGroupIndex + 1}`}
                existingCriterionCount={selectedGroup.criteria.length}
                session={bulkSession}
                disabled={isEditingDisabled}
                focusInputToken={focusTarget?.kind === "bulk-input" ? focusTarget.token : null}
                onInputChange={onBulkInputChange}
                onPreview={onBulkPreview}
                onCancel={onBulkCancel}
                onAccept={onBulkAccept}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="border-b py-12 text-center text-sm text-muted-foreground">
            Chưa có nhóm cấu hình. Chọn Thêm nhóm để bắt đầu.
          </div>
        )}
      </div>
    </section>
  )
}
