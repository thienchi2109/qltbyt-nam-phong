"use client"

import { useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { HierarchicalEditorStructureSidebar } from "@/components/hierarchical-editor/HierarchicalEditorStructureSidebar"
import { HierarchicalEditorToolbar } from "@/components/hierarchical-editor/HierarchicalEditorToolbar"
import { HierarchicalEditorWorkspace } from "@/components/hierarchical-editor/HierarchicalEditorWorkspace"

import type {
  DeviceQuotaDraftItemPatch,
  DeviceQuotaMergedItemRow,
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

type DeviceQuotaDraftCatalogRenderEntry =
  | {
      type: "section"
      section: Extract<DeviceQuotaMergedRow, { type: "section" }>
      items: DeviceQuotaMergedItemRow[]
    }
  | { type: "item"; item: DeviceQuotaMergedItemRow }

function buildRenderEntries(rows: DeviceQuotaMergedRow[]): DeviceQuotaDraftCatalogRenderEntry[] {
  const orderedRows = rows.slice().sort((left, right) => left.sourceOrder - right.sourceOrder)
  const groups = new Map<string, Extract<DeviceQuotaDraftCatalogRenderEntry, { type: "section" }>>()

  for (const row of orderedRows) {
    if (row.type === "section") {
      groups.set(row.sourceIdentifier, { type: "section", section: row, items: [] })
    }
  }

  const entries: DeviceQuotaDraftCatalogRenderEntry[] = []
  for (const row of orderedRows) {
    if (row.type === "section") {
      const group = groups.get(row.sourceIdentifier)
      if (group) entries.push(group)
      continue
    }

    const group =
      row.parentSourceIdentifier == null ? undefined : groups.get(row.parentSourceIdentifier)
    if (group) group.items.push(row)
    else entries.push({ type: "item", item: row })
  }

  return entries
}

const savedAtFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
})

function formatSavedAt(value: string): string {
  return savedAtFormatter.format(new Date(value))
}

/** Composes the desktop-only draft catalog workspace from shared hierarchy primitives. */
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
  const bodyRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null)
  const entries = useMemo(() => buildRenderEntries(rows), [rows])
  const sections = entries
    .filter(
      (entry): entry is Extract<DeviceQuotaDraftCatalogRenderEntry, { type: "section" }> =>
        entry.type === "section"
    )
    .map(({ section, items }) => ({
      key: section.sourceIdentifier,
      label: section.name,
      ordinal: section.sourceLabel,
      summary: `${items.length}`,
      targetRef: {
        get current() {
          return sectionRefs.current.get(section.sourceIdentifier) ?? null
        },
      },
    }))

  const status = isIncomplete ? (
    <Badge variant="outline">Chưa hoàn thiện</Badge>
  ) : (
    <Badge variant="secondary">Đã đủ dữ liệu</Badge>
  )
  const leading = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold">Danh mục định mức dự thảo</h1>
      <p className="truncate text-xs text-muted-foreground">
        Đơn vị {metadata.unitId} · {metadata.documentNumber} · phiên bản {metadata.documentVersion}
      </p>
    </div>
  )
  const metadataLine = (
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-b px-4 py-2 text-xs text-muted-foreground">
      <span>Trạng thái: {metadata.draftStatus}</span>
      <span>Snapshot: {metadata.snapshotMarker.slice(0, 12)}</span>
      <span>Đã lưu: {formatSavedAt(metadata.lastSavedAt)} UTC</span>
      <span>Revision: {metadata.revision}</span>
      <span>Chế độ: {metadata.mode === "editable" ? "Chỉnh sửa" : "Xem"}</span>
    </div>
  )

  return (
    <div className="min-w-0 space-y-3 py-6" data-testid="device-quota-draft-catalog-editor">
      {metadataLine}
      <HierarchicalEditorWorkspace
        ariaLabel="Trình soạn danh mục định mức dự thảo"
        bodyAriaLabel="Các nhóm thiết bị pháp quy"
        workspaceTestId="device-quota-draft-catalog-workspace"
        bodyTestId="device-quota-draft-catalog-body"
        bodyRef={bodyRef}
        bodyStyle={{ gridTemplateColumns: "220px minmax(0, 1fr)" }}
        sidebar={
          <HierarchicalEditorStructureSidebar
            sections={sections}
            activeKey={activeSectionKey}
            ariaLabel="Cấu trúc danh mục"
            testId="device-quota-draft-catalog-sidebar"
            onSectionSelect={setActiveSectionKey}
          />
        }
        toolbar={
          isReadOnly ? (
            <div
              data-testid="device-quota-draft-catalog-toolbar"
              className="flex min-h-12 items-center border-y px-3"
            >
              {leading}
              <div className="ml-auto">{status}</div>
            </div>
          ) : (
            <HierarchicalEditorToolbar
              testId="device-quota-draft-catalog-toolbar"
              leading={leading}
              status={status}
              saveDisabled={
                !isDirty || isMutationPending || Object.keys(validationErrors).length > 0
              }
              isSaving={isSaving}
              onSave={() => void onSave()}
            />
          )
        }
      >
        {entries.map((entry) =>
          entry.type === "section" ? (
            <DeviceQuotaDraftCatalogSection
              key={entry.section.sourceIdentifier}
              section={entry.section}
              items={entry.items}
              validationErrors={validationErrors}
              isReadOnly={isReadOnly}
              isMutationPending={isMutationPending}
              onUpdate={onUpdateItem}
              onExclude={(sourceIdentifier) => void onExclude(sourceIdentifier)}
              onRestore={(sourceIdentifier) => void onRestore(sourceIdentifier)}
              sectionRef={(element) => {
                if (element) sectionRefs.current.set(entry.section.sourceIdentifier, element)
                else sectionRefs.current.delete(entry.section.sourceIdentifier)
              }}
            />
          ) : (
            <DeviceQuotaDraftCatalogItemRow
              key={entry.item.sourceIdentifier}
              row={entry.item}
              validationMessage={validationErrors[entry.item.sourceIdentifier]}
              isReadOnly={isReadOnly}
              isMutationPending={isMutationPending}
              onUpdate={onUpdateItem}
              onExclude={(sourceIdentifier) => void onExclude(sourceIdentifier)}
              onRestore={(sourceIdentifier) => void onRestore(sourceIdentifier)}
            />
          )
        )}
      </HierarchicalEditorWorkspace>
    </div>
  )
}
