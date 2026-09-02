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

type DeviceQuotaDraftCatalogEditorProps = {
  rows: DeviceQuotaMergedRow[]
  metadata: DeviceQuotaDraftCatalogEditorMetadata
  validationErrors: Record<string, string>
  isDirty: boolean
  isIncomplete: boolean
  isSaving: boolean
  isExcluding: boolean
  isRestoring: boolean
  isReadOnly: boolean
  onUpdateItem: (sourceIdentifier: string, patch: DeviceQuotaDraftItemPatch) => void
  onSave: () => Promise<unknown>
  onExclude: (sourceIdentifier: string) => Promise<unknown>
  onRestore: (sourceIdentifier: string) => Promise<unknown>
}

function groupRows(rows: DeviceQuotaMergedRow[]) {
  const groups: Array<{
    section: Extract<DeviceQuotaMergedRow, { type: "section" }>
    items: DeviceQuotaMergedItemRow[]
  }> = []
  for (const row of rows) {
    if (row.type === "section") groups.push({ section: row, items: [] })
    else {
      const group = groups.find(
        (candidate) => candidate.section.sourceIdentifier === row.parentSourceIdentifier
      )
      ;(group ?? groups.at(-1))?.items.push(row)
    }
  }
  return groups
}

function formatSavedAt(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value))
}

/** Composes the desktop-only draft catalog workspace from shared hierarchy primitives. */
export function DeviceQuotaDraftCatalogEditor({
  rows,
  metadata,
  validationErrors,
  isDirty,
  isIncomplete,
  isSaving,
  isExcluding,
  isRestoring,
  isReadOnly,
  onUpdateItem,
  onSave,
  onExclude,
  onRestore,
}: DeviceQuotaDraftCatalogEditorProps): React.JSX.Element {
  const bodyRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null)
  const groups = useMemo(() => groupRows(rows), [rows])
  const sections = groups.map(({ section, items }) => ({
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
              saveDisabled={!isDirty || Object.keys(validationErrors).length > 0}
              isSaving={isSaving}
              onSave={() => void onSave()}
            />
          )
        }
      >
        {groups.map(({ section, items }) => (
          <DeviceQuotaDraftCatalogSection
            key={section.sourceIdentifier}
            section={section}
            items={items}
            validationErrors={validationErrors}
            isReadOnly={isReadOnly}
            isExcluding={isExcluding}
            isRestoring={isRestoring}
            onUpdate={onUpdateItem}
            onExclude={(sourceIdentifier) => void onExclude(sourceIdentifier)}
            onRestore={(sourceIdentifier) => void onRestore(sourceIdentifier)}
            sectionRef={(element) => {
              if (element) sectionRefs.current.set(section.sourceIdentifier, element)
              else sectionRefs.current.delete(section.sourceIdentifier)
            }}
          />
        ))}
      </HierarchicalEditorWorkspace>
    </div>
  )
}
