"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ClipboardPaste,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react"

import type {
  TechnicalConfigurationEntryMode,
  TechnicalConfigurationFocusTarget,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import { TechnicalConfigurationBulkEntryWorkbench } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryWorkbench"
import { TechnicalConfigurationCriteriaSpreadsheet } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationCriteriaSpreadsheet"
import type { TechnicalConfigurationBulkEntrySession } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import type { TechnicalConfigurationBaselineEditorGroup } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { hasTechnicalConfigurationBulkEntryInput } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"

import { TechnicalConfigurationBaselineEditorIconButton as IconButton } from "./TechnicalConfigurationBaselineEditorControls"

type CriterionTextField = "title" | "requirementText"

export type TechnicalConfigurationBaselineGroupSectionProps = Readonly<{
  group: TechnicalConfigurationBaselineEditorGroup
  groupIndex: number
  groupCount: number
  expanded: boolean
  mode: TechnicalConfigurationEntryMode
  bulkSession: TechnicalConfigurationBulkEntrySession
  groupError?: string
  criterionErrors: Record<string, string>
  summaryErrorCount: number
  pendingInputDescriptionId?: string
  disabled: boolean
  focusTarget: TechnicalConfigurationFocusTarget
  recentlyAcceptedCriterionKeys: ReadonlySet<string>
  onExpandedChange: (expanded: boolean) => void
  onModeChange: (groupKey: string, mode: TechnicalConfigurationEntryMode) => void
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
}>

function focusElement(target: HTMLElement | null): void {
  target?.scrollIntoView?.({ block: "nearest" })
  target?.focus()
}

/** Renders one editable, independently collapsible baseline criterion group. */
export function TechnicalConfigurationBaselineGroupSection({
  group,
  groupIndex,
  groupCount,
  expanded,
  mode,
  bulkSession,
  groupError,
  criterionErrors,
  summaryErrorCount,
  pendingInputDescriptionId,
  disabled,
  focusTarget,
  recentlyAcceptedCriterionKeys,
  onExpandedChange,
  onModeChange,
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
}: TechnicalConfigurationBaselineGroupSectionProps): React.JSX.Element {
  const ordinal = groupIndex + 1
  const groupLabel = group.name.trim() || `Nhóm ${ordinal}`
  const groupErrorId = groupError ? `baseline-group-${group.key}-error` : undefined
  const hasPendingBulkInput = hasTechnicalConfigurationBulkEntryInput(bulkSession.input)
  const modeActionLabel = mode === "row" ? "Nhập nhiều dòng" : "Chỉnh từng dòng"
  const disclosureRef = React.useRef<HTMLButtonElement>(null)
  const groupNameRef = React.useRef<HTMLInputElement>(null)
  const modeActionRef = React.useRef<HTMLButtonElement>(null)
  const addCriterionRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!focusTarget) return
    const timeoutId = window.setTimeout(() => {
      if (focusTarget.kind === "group-name" && focusTarget.key === group.key) {
        focusElement(groupNameRef.current)
      } else if (focusTarget.kind === "group-disclosure" && focusTarget.key === group.key) {
        focusElement(disclosureRef.current)
      } else if (focusTarget.kind === "group-mode-action" && focusTarget.key === group.key) {
        focusElement(modeActionRef.current)
      } else if (focusTarget.kind === "add-criterion" && focusTarget.key === group.key) {
        focusElement(addCriterionRef.current)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [focusTarget, group.key])

  const handleAddCriterion = (): void => {
    if (!expanded) onExpandedChange(true)
    onAddCriterion(group.key)
  }

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <section className="border-b" aria-label={`Nhóm tiêu chí ${ordinal}`}>
        <div className="grid gap-3 bg-muted/30 px-3 py-3 lg:grid-cols-[auto_minmax(12rem,1fr)_auto] lg:items-start">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button
                ref={disclosureRef}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} nhóm ${ordinal}: ${groupLabel}`}
                title={expanded ? "Thu gọn nhóm" : "Mở rộng nhóm"}
              >
                <ChevronDown
                  className={`size-4 transition-transform ${expanded ? "" : "-rotate-90"}`}
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-sm font-semibold">
              {ordinal}
            </span>
          </div>

          <div className="min-w-0">
            <label className="sr-only" htmlFor={`baseline-group-${group.key}`}>
              Tên nhóm {ordinal}
            </label>
            <Input
              ref={groupNameRef}
              id={`baseline-group-${group.key}`}
              aria-label={`Tên nhóm ${ordinal}`}
              value={group.name}
              disabled={disabled}
              aria-invalid={Boolean(groupError)}
              aria-describedby={groupErrorId}
              onChange={(event) => onGroupNameChange(group.key, event.target.value)}
            />
            {groupError ? (
              <p id={groupErrorId} className="mt-1 text-sm text-destructive">
                {groupError}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{group.criteria.length} tiêu chí</Badge>
              {summaryErrorCount > 0 ? (
                <Badge variant="destructive">{summaryErrorCount} lỗi</Badge>
              ) : null}
              {hasPendingBulkInput ? (
                <Badge variant="outline">Có nội dung nhập nhiều dòng</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 lg:justify-end">
            <Button
              ref={modeActionRef}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              aria-label={`${modeActionLabel} cho nhóm ${ordinal}: ${groupLabel}`}
              onClick={() => onModeChange(group.key, mode === "row" ? "bulk" : "row")}
            >
              {mode === "row" ? (
                <ClipboardPaste className="size-4" aria-hidden="true" />
              ) : (
                <ListChecks className="size-4" aria-hidden="true" />
              )}
              {modeActionLabel}
            </Button>
            <Button
              ref={addCriterionRef}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              aria-label={`Thêm tiêu chí vào nhóm ${ordinal}`}
              onClick={handleAddCriterion}
            >
              <Plus className="size-4" aria-hidden="true" />
              Thêm tiêu chí
            </Button>
            <IconButton
              label={`Di chuyển nhóm ${ordinal} lên`}
              title="Di chuyển lên"
              disabled={disabled || groupIndex === 0}
              onClick={() => onMoveGroup(groupIndex, -1)}
            >
              <ArrowUp className="size-4" />
            </IconButton>
            <IconButton
              label={`Di chuyển nhóm ${ordinal} xuống`}
              title="Di chuyển xuống"
              disabled={disabled || groupIndex === groupCount - 1}
              onClick={() => onMoveGroup(groupIndex, 1)}
            >
              <ArrowDown className="size-4" />
            </IconButton>
            <IconButton
              label={`Xóa nhóm ${ordinal}`}
              title="Xóa nhóm"
              disabled={disabled}
              ariaDisabled={hasPendingBulkInput}
              ariaDescribedBy={hasPendingBulkInput ? pendingInputDescriptionId : undefined}
              destructive
              onClick={() => {
                if (!hasPendingBulkInput) onDeleteGroup(group.key)
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        </div>

        <CollapsibleContent>
          <div role="region" aria-label={`Nội dung nhóm ${ordinal}`} className="py-4">
            {mode === "row" ? (
              <TechnicalConfigurationCriteriaSpreadsheet
                group={group}
                groupIndex={ordinal}
                criterionErrors={criterionErrors}
                disabled={disabled}
                focusCriterionKey={focusTarget?.kind === "criterion" ? focusTarget.key : null}
                focusCriterionToken={focusTarget?.kind === "criterion" ? focusTarget.token : null}
                recentlyAcceptedCriterionKeys={recentlyAcceptedCriterionKeys}
                onCriterionTextChange={(criterionKey, field, value) =>
                  onCriterionTextChange(group.key, criterionKey, field, value)
                }
                onMoveCriterion={(criterionIndex, offset) =>
                  onMoveCriterion(group.key, criterionIndex, offset)
                }
                onDeleteCriterion={(criterionKey) => onDeleteCriterion(group.key, criterionKey)}
              />
            ) : (
              <TechnicalConfigurationBulkEntryWorkbench
                groupName={groupLabel}
                existingCriterionCount={group.criteria.length}
                session={bulkSession}
                disabled={disabled}
                focusInputToken={focusTarget?.kind === "bulk-input" ? focusTarget.token : null}
                onInputChange={onBulkInputChange}
                onPreview={onBulkPreview}
                onCancel={onBulkCancel}
                onAccept={onBulkAccept}
              />
            )}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
