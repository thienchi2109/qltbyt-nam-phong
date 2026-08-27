"use client"

import { useDroppable } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"
import { CheckCircle2, GripVertical } from "lucide-react"
import * as React from "react"

import type {
  TechnicalConfigurationBaselineEditorCriterion,
  TechnicalConfigurationBaselineEditorCriterionOwner,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import type {
  TechnicalConfigurationBaselineDndSourceData,
  TechnicalConfigurationBaselineDndTargetData,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-dnd"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { TechnicalConfigurationBaselineCriterionActions } from "./TechnicalConfigurationBaselineCriterionActions"
import type { TechnicalConfigurationBaselineCriterionOwnerOption } from "./TechnicalConfigurationBaselineHierarchyAuthoring"

type CriterionTextField = "title" | "requirementText"

export type TechnicalConfigurationBaselineCriterionRowOwner =
  | Readonly<{ kind: "group"; groupKey: string }>
  | Readonly<{ kind: "subgroup"; groupKey: string; subgroupKey: string }>

type TechnicalConfigurationBaselineCriterionRowProps = Readonly<{
  criterion: TechnicalConfigurationBaselineEditorCriterion
  criterionIndex: number
  criterionCount: number
  criterionLabel: string
  fieldIdPrefix: string
  owner: TechnicalConfigurationBaselineCriterionRowOwner
  error?: string
  errorId?: string
  locked: boolean
  disabled: boolean
  recentlyAccepted?: boolean
  requirementRef?: (node: HTMLElement | null) => void
  onTextChange?: (field: CriterionTextField, value: string) => void
  onMove?: (offset: -1 | 1) => void
  hierarchyEnabled?: boolean
  ownerOptions?: readonly TechnicalConfigurationBaselineCriterionOwnerOption[]
  onMoveToOwner?: (owner: TechnicalConfigurationBaselineEditorCriterionOwner) => void
  onDelete?: () => void
}>

type TechnicalConfigurationBaselineCriterionDropZoneProps = Readonly<{
  owner: TechnicalConfigurationBaselineCriterionRowOwner
  emptyText: string
  locked: boolean
  dndEnabled?: boolean
}>

/** Shared Tailwind grid columns used by criterion headers, rows, and empty drop zones. */
export const TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_COLUMNS =
  "grid-cols-[2rem_2.75rem_6rem_minmax(9rem,10rem)_minmax(20rem,1fr)_4.5rem_3rem]"
/** CSS grid template mirrored to DnD metadata for stable criterion alignment. */
export const TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_TEMPLATE =
  "2rem 2.75rem 6rem minmax(9rem, 10rem) minmax(20rem, 1fr) 4.5rem 3rem"
/** Minimum width that keeps every criterion editing column usable. */
export const TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_MIN_WIDTH = "min-w-[780px]"

const EDITABLE_FIELD_CLASS =
  "rounded-sm border-transparent bg-transparent shadow-none transition-colors hover:border-input hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0"

function getOwnerAttributes(owner: TechnicalConfigurationBaselineCriterionRowOwner): {
  ownerKind: "group" | "subgroup"
  groupKey: string
  subgroupKey?: string
} {
  return owner.kind === "group"
    ? { ownerKind: "group", groupKey: owner.groupKey }
    : {
        ownerKind: "subgroup",
        groupKey: owner.groupKey,
        subgroupKey: owner.subgroupKey,
      }
}

function toEditorOwner(
  owner: TechnicalConfigurationBaselineCriterionRowOwner
): TechnicalConfigurationBaselineEditorCriterionOwner {
  return {
    groupKey: owner.groupKey,
    subgroupKey: owner.kind === "subgroup" ? owner.subgroupKey : null,
  }
}

/** Renders an accessible DnD target when a criterion owner has no rows. */
export function TechnicalConfigurationBaselineCriterionDropZone({
  owner,
  emptyText,
  locked,
  dndEnabled = false,
}: TechnicalConfigurationBaselineCriterionDropZoneProps): React.JSX.Element {
  const { ownerKind, groupKey, subgroupKey } = getOwnerAttributes(owner)
  const ownerKey = subgroupKey ?? groupKey
  const dropZoneId = `baseline-criterion-drop-zone-${ownerKind}-${ownerKey}`
  const editorOwner = toEditorOwner(owner)
  const droppable = useDroppable<TechnicalConfigurationBaselineDndTargetData>({
    id: dropZoneId,
    type: "baseline-criterion",
    data: {
      target: { kind: "criterion", owner: editorOwner, index: 0 },
      targetMode: "owner",
    },
    disabled: locked || !dndEnabled,
  })

  return (
    <div
      ref={droppable.ref}
      id={dropZoneId}
      data-testid={`criterion-drop-zone-${ownerKind}-${ownerKey}`}
      data-criterion-drop-zone="true"
      data-drop-slot="criterion"
      data-owner-kind={ownerKind}
      data-owner-group-key={groupKey}
      data-owner-subgroup-key={subgroupKey}
      data-grid-template={TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_TEMPLATE}
      data-locked={locked ? "true" : undefined}
      data-drop-target={droppable.isDropTarget ? "true" : undefined}
      tabIndex={locked || !dndEnabled ? undefined : 0}
      aria-label="Vùng thả tiêu chí"
      className={`grid ${TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_COLUMNS} min-h-12 items-center border-b border-dashed text-sm text-muted-foreground transition-colors ${
        droppable.isDropTarget ? "border-primary bg-primary/5 text-foreground" : "border-border/70"
      }`}
    >
      <span aria-hidden="true" />
      <p className="col-span-6 px-3 py-5 text-center">{emptyText}</p>
    </div>
  )
}

/** Renders one editable criterion row with hierarchy actions and DnD affordances. */
export function TechnicalConfigurationBaselineCriterionRow({
  criterion,
  criterionIndex,
  criterionCount,
  criterionLabel,
  fieldIdPrefix,
  owner,
  error,
  errorId,
  locked,
  disabled,
  recentlyAccepted = false,
  requirementRef,
  onTextChange,
  onMove,
  hierarchyEnabled = false,
  ownerOptions,
  onMoveToOwner,
  onDelete,
}: TechnicalConfigurationBaselineCriterionRowProps): React.JSX.Element {
  const { ownerKind, groupKey, subgroupKey } = getOwnerAttributes(owner)
  const editorOwner = toEditorOwner(owner)
  const titleId = `${fieldIdPrefix}-title-${criterion.key}`
  const requirementId = `${fieldIdPrefix}-requirement-${criterion.key}`
  const titleLabel = `Tiêu đề ${criterionLabel}`
  const requirementLabel = `Nội dung yêu cầu ${criterionLabel}`
  const sortable = useSortable<
    TechnicalConfigurationBaselineDndSourceData & TechnicalConfigurationBaselineDndTargetData
  >({
    id: `baseline-criterion-${criterion.key}`,
    type: "baseline-criterion",
    group: "baseline-criteria",
    index: criterionIndex,
    data: {
      active: {
        kind: "criterion",
        owner: editorOwner,
        criterionKey: criterion.key,
        index: criterionIndex,
      },
      label: criterionLabel,
      target: { kind: "criterion", owner: editorOwner, index: criterionIndex },
      targetMode: "sortable",
    },
    disabled: locked || disabled,
  })

  return (
    <div
      ref={sortable.ref}
      data-testid={`criterion-row-${criterion.key}`}
      data-criterion-row="true"
      data-criterion-key={criterion.key}
      data-owner-kind={ownerKind}
      data-owner-group-key={groupKey}
      data-owner-subgroup-key={subgroupKey}
      data-grid-template={TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_TEMPLATE}
      data-locked={locked ? "true" : undefined}
      data-recently-accepted={recentlyAccepted ? "true" : undefined}
      data-drag-source={sortable.isDragSource ? "true" : undefined}
      data-drop-target={sortable.isDropTarget ? "true" : undefined}
      className={`grid ${TECHNICAL_CONFIGURATION_BASELINE_CRITERION_GRID_COLUMNS} min-h-12 items-stretch border-b border-border/70 transition-colors hover:bg-muted/20 ${
        sortable.isDropTarget
          ? "bg-primary/5"
          : recentlyAccepted
            ? "bg-emerald-50/70"
            : "bg-background"
      }`}
    >
      <div className="flex items-center justify-center">
        {locked ? null : (
          <Button
            ref={sortable.handleRef}
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={`Kéo để sắp xếp ${criterionLabel}`}
            title="Kéo để sắp xếp"
            data-criterion-drag-handle="true"
            className="size-8 cursor-grab text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      <span className="flex items-center justify-center px-2 py-1 text-sm font-medium tabular-nums">
        {criterionIndex + 1}
      </span>

      <div className="flex items-center px-2 py-1">
        <Badge variant={criterion.id === null ? "secondary" : "outline"}>
          {criterion.criterionCode ?? "Mới"}
        </Badge>
      </div>

      <div className="min-w-0 px-1 py-1">
        {locked ? (
          <div
            aria-label={titleLabel}
            className="flex min-h-10 items-center whitespace-pre-wrap px-2 text-sm"
          >
            {criterion.title}
          </div>
        ) : (
          <>
            <label className="sr-only" htmlFor={titleId}>
              {titleLabel}
            </label>
            <Input
              id={titleId}
              aria-label={titleLabel}
              value={criterion.title}
              disabled={disabled}
              className={`h-9 truncate ${EDITABLE_FIELD_CLASS}`}
              title={criterion.title}
              onChange={(event) => onTextChange?.("title", event.target.value)}
            />
          </>
        )}
      </div>

      <div className="min-w-0 px-1 py-1">
        {locked ? (
          <div
            ref={requirementRef}
            tabIndex={-1}
            aria-label={requirementLabel}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId}
            className="min-h-10 whitespace-pre-wrap px-2 py-2 text-sm"
          >
            {criterion.requirementText}
          </div>
        ) : (
          <>
            <label className="sr-only" htmlFor={requirementId}>
              {requirementLabel}
            </label>
            <Textarea
              ref={requirementRef}
              id={requirementId}
              aria-label={requirementLabel}
              className={`min-h-9 resize-y whitespace-pre-wrap ${EDITABLE_FIELD_CLASS}`}
              value={criterion.requirementText}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              aria-describedby={errorId}
              onChange={(event) => onTextChange?.("requirementText", event.target.value)}
            />
          </>
        )}
        {error ? (
          <p id={errorId} className="mt-1 px-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-center px-2 py-1">
        {error ? (
          <Badge variant="destructive">Có lỗi</Badge>
        ) : criterion.id === null ? (
          <Badge variant="secondary">Chưa lưu</Badge>
        ) : (
          <span
            role="img"
            aria-label="Hợp lệ"
            title="Hợp lệ"
            className="flex size-7 items-center justify-center text-emerald-600"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>

      {locked ? (
        <div />
      ) : (
        <TechnicalConfigurationBaselineCriterionActions
          criterionLabel={criterionLabel}
          criterionIndex={criterionIndex}
          criterionCount={criterionCount}
          owner={editorOwner}
          hierarchyEnabled={hierarchyEnabled}
          disabled={disabled}
          ownerOptions={ownerOptions}
          onMove={onMove}
          onMoveToOwner={onMoveToOwner}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}
