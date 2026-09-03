"use client"

import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { HierarchicalEditorToolbar } from "@/components/hierarchical-editor/HierarchicalEditorToolbar"
import { HierarchicalEditorWorkspace } from "@/components/hierarchical-editor/HierarchicalEditorWorkspace"

import type {
  DeviceQuotaDraftItemPatch,
  DeviceQuotaMergedRow,
} from "../device-quota-draft-catalog-types"
import { DeviceQuotaDraftCatalogItemRow } from "./DeviceQuotaDraftCatalogItemRow"
import { DeviceQuotaDraftCatalogSection } from "./DeviceQuotaDraftCatalogSection"

export type DeviceQuotaDraftCatalogEditorMetadata = {
  unitId: number
  draftStatus: "draft"
  documentNumber: string
  documentVersion: string
  snapshotMarker: string
  lastSavedAt: string
  revision: number
  mode: "editable" | "readonly"
}

export type DeviceQuotaDraftCatalogEditorState = {
  isDirty: boolean
  isIncomplete: boolean
  isSaving: boolean
  isExcluding: boolean
  isRestoring: boolean
  isRecovering: boolean
  isReadOnly: boolean
}

type DeviceQuotaDraftCatalogEditorProps = {
  rows: DeviceQuotaMergedRow[]
  metadata: DeviceQuotaDraftCatalogEditorMetadata
  validationErrors: Record<string, string>
  state: DeviceQuotaDraftCatalogEditorState
  onUpdateItem: (sourceIdentifier: string, patch: DeviceQuotaDraftItemPatch) => void
  onSave: () => Promise<unknown>
  onExclude: (sourceIdentifier: string) => Promise<unknown>
  onRestore: (sourceIdentifier: string) => Promise<unknown>
}

const sourceHeaders = ["TT", "Chủng loại", "Đơn vị tính", "Số lượng định mức"] as const
const draftHeaders = ["ĐVT áp dụng", "SL đề xuất", "Ghi chú"] as const

function SourceTableHeader(): React.JSX.Element {
  return (
    <thead className="bg-background">
      <tr>
        <th colSpan={4} scope="colgroup" className="border-b bg-muted/50 px-4 py-2 text-left">
          Theo Thông tư 10/2026
        </th>
        <th colSpan={3} scope="colgroup" className="border-b bg-primary/5 px-4 py-2 text-left">
          Thông tin dự thảo của đơn vị
        </th>
      </tr>
      <tr>
        {sourceHeaders.map((header, index) => (
          <th
            key={header}
            scope="col"
            data-testid={
              index === 0
                ? "device-quota-draft-catalog-sticky-tt"
                : index === 1
                  ? "device-quota-draft-catalog-sticky-name"
                  : undefined
            }
            className={`whitespace-nowrap border-b bg-background px-4 py-3 text-left ${
              index === 0 ? "sticky left-0 z-20 w-20" : ""
            } ${index === 1 ? "sticky left-20 z-20 min-w-[22rem]" : ""}`}
          >
            {header}
          </th>
        ))}
        {draftHeaders.map((header) => (
          <th
            key={header}
            scope="col"
            className="whitespace-nowrap border-b bg-primary/5 px-4 py-3 text-left"
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function DraftCatalogTable({
  rows,
  validationErrors,
  isReadOnly,
  isMutationPending,
  onUpdateItem,
  onExclude,
  onRestore,
}: {
  rows: DeviceQuotaMergedRow[]
  validationErrors: Record<string, string>
  isReadOnly: boolean
  isMutationPending: boolean
  onUpdateItem: (sourceIdentifier: string, patch: DeviceQuotaDraftItemPatch) => void
  onExclude: (sourceIdentifier: string) => void
  onRestore: (sourceIdentifier: string) => void
}): React.JSX.Element {
  const orderedRows = useMemo(
    () => rows.slice().sort((left, right) => left.sourceOrder - right.sourceOrder),
    [rows]
  )
  const rowGroups = useMemo(() => {
    const groups: Array<{
      section: Extract<DeviceQuotaMergedRow, { type: "section" }> | null
      rows: DeviceQuotaMergedRow[]
    }> = []

    for (const row of orderedRows) {
      if (row.type === "section" || groups.length === 0) {
        groups.push({ section: row.type === "section" ? row : null, rows: [row] })
      } else {
        groups[groups.length - 1].rows.push(row)
      }
    }

    return groups
  }, [orderedRows])

  return (
    <div
      data-testid="device-quota-draft-catalog-table-viewport"
      className="h-full min-w-0 overflow-auto border-y"
    >
      <table
        className="w-full min-w-[1120px] border-collapse text-sm"
        aria-label="Phụ lục định mức thiết bị theo Thông tư 10/2026"
      >
        <caption className="sr-only">
          Danh mục thiết bị theo Phụ lục Thông tư 10/2026 và thông tin dự thảo của đơn vị
        </caption>
        <colgroup>
          <col className="w-20" />
          <col className="min-w-[22rem]" />
          <col className="w-36" />
          <col className="w-[28rem]" />
          <col className="w-44" />
          <col className="w-36" />
          <col className="w-64" />
        </colgroup>
        <SourceTableHeader />
        {rowGroups.map((group, groupIndex) => (
          <tbody
            key={group.section?.sourceIdentifier ?? `top-level-${groupIndex}`}
            aria-label={group.section?.name}
          >
            {group.rows.map((row) =>
              row.type === "section" ? (
                <DeviceQuotaDraftCatalogSection key={row.sourceIdentifier} section={row} />
              ) : (
                <DeviceQuotaDraftCatalogItemRow
                  key={row.sourceIdentifier}
                  row={row}
                  validationMessage={validationErrors[row.sourceIdentifier]}
                  isReadOnly={isReadOnly}
                  isMutationPending={isMutationPending}
                  onUpdate={onUpdateItem}
                  onExclude={onExclude}
                  onRestore={onRestore}
                />
              )
            )}
          </tbody>
        ))}
      </table>
    </div>
  )
}

/** Renders the desktop appendix table while preserving the existing draft contract. */
export function DeviceQuotaDraftCatalogEditor({
  rows,
  metadata,
  validationErrors,
  state,
  onUpdateItem,
  onSave,
  onExclude,
  onRestore,
}: DeviceQuotaDraftCatalogEditorProps): React.JSX.Element {
  const { isDirty, isIncomplete, isSaving, isExcluding, isRestoring, isRecovering, isReadOnly } =
    state
  const isMutationPending = isSaving || isExcluding || isRestoring || isRecovering
  const completionStatus = isIncomplete ? (
    <Badge variant="outline">Chưa hoàn thiện</Badge>
  ) : (
    <Badge variant="secondary">Đã đủ dữ liệu</Badge>
  )
  const saveFeedback = isSaving ? (
    <span className="text-sm font-medium text-amber-700">Đang lưu...</span>
  ) : isDirty ? (
    <span className="text-sm font-medium text-amber-700">Chưa lưu</span>
  ) : (
    <span className="text-sm font-medium text-emerald-700">Đã lưu</span>
  )
  const leading = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold">Danh mục định mức dự thảo</h1>
      <p className="truncate text-xs text-muted-foreground">
        Đơn vị {metadata.unitId} · {metadata.documentNumber} · phiên bản {metadata.documentVersion}
      </p>
    </div>
  )

  return (
    <div className="min-w-0 space-y-3 py-6" data-testid="device-quota-draft-catalog-editor">
      <HierarchicalEditorWorkspace
        ariaLabel="Trình soạn danh mục định mức dự thảo"
        bodyAriaLabel="Các nhóm thiết bị pháp quy"
        workspaceTestId="device-quota-draft-catalog-workspace"
        bodyTestId="device-quota-draft-catalog-body"
        bodyClassName="block"
        contentClassName="overflow-hidden"
        toolbar={
          isReadOnly ? (
            <div
              data-testid="device-quota-draft-catalog-toolbar"
              className="flex min-h-12 items-center border-y px-3"
            >
              {leading}
              <div className="ml-auto">{completionStatus}</div>
            </div>
          ) : (
            <HierarchicalEditorToolbar
              testId="device-quota-draft-catalog-toolbar"
              leading={leading}
              status={
                <div className="flex items-center gap-2">
                  {completionStatus}
                  {saveFeedback}
                </div>
              }
              saveDisabled={
                !isDirty || isMutationPending || Object.keys(validationErrors).length > 0
              }
              isSaving={isSaving}
              onSave={() => void onSave()}
            />
          )
        }
      >
        <DraftCatalogTable
          rows={rows}
          validationErrors={validationErrors}
          isReadOnly={isReadOnly}
          isMutationPending={isMutationPending}
          onUpdateItem={onUpdateItem}
          onExclude={(sourceIdentifier) => void onExclude(sourceIdentifier)}
          onRestore={(sourceIdentifier) => void onRestore(sourceIdentifier)}
        />
      </HierarchicalEditorWorkspace>
    </div>
  )
}
