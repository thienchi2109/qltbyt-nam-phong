import { useCallback, useEffect, useRef, useState } from "react"

import { downloadBlob } from "@/lib/excel-workbook"

import {
  buildDeviceQuotaDraftCatalogFilename,
  serializeDeviceQuotaDraftCatalogWorkbook,
} from "../device-quota-draft-catalog-excel-export"
import type { DeviceQuotaDraftCatalogExportSnapshot } from "../device-quota-draft-catalog-excel-export"

export type DeviceQuotaDraftCatalogExportStatus = "ready" | "loading" | "missing" | "error"

type UseDeviceQuotaDraftCatalogExportInput = {
  snapshot: DeviceQuotaDraftCatalogExportSnapshot | null
  status: DeviceQuotaDraftCatalogExportStatus
  statusMessage: string | null
  isDirty: boolean
  isMutationPending: boolean
  isReadOnly: boolean
}

type UseDeviceQuotaDraftCatalogExportResult = {
  isExporting: boolean
  exportError: string | null
  blockedMessage: string | null
  canExport: boolean
  handleExport: () => Promise<void>
}

type ExportFailure = {
  identityKey: string
  message: string
}

const EXPORT_ERROR_MESSAGE = "Không thể xuất file Excel. Vui lòng thử lại."
const EXPORT_FILE_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function getExportIdentityKey(snapshot: DeviceQuotaDraftCatalogExportSnapshot | null): string {
  if (!snapshot) return "missing"
  return [
    snapshot.userId,
    snapshot.unitId,
    snapshot.revision,
    snapshot.lastSavedAt,
    snapshot.unitName,
    snapshot.catalogVersionId,
    snapshot.sourcePdfMarker,
    snapshot.sourcePdfSha256,
  ].join("|")
}

function getExportBlockedMessage(input: {
  isDirty: boolean
  isMutationPending: boolean
  snapshot: DeviceQuotaDraftCatalogExportSnapshot | null
  status: DeviceQuotaDraftCatalogExportStatus
  statusMessage: string | null
}): string | null {
  if (input.isDirty) return "Cần lưu thay đổi trước khi xuất Excel."
  if (input.isMutationPending) return "Đang xử lý thay đổi, hãy chờ hoàn tất trước khi xuất Excel."
  if (input.status === "loading") return "Đang tải dữ liệu xuất Excel."
  if (input.status === "error") {
    return input.statusMessage ?? "Chưa xác nhận được thông tin đơn vị để xuất Excel."
  }
  if (!input.snapshot) return "Chưa có snapshot đã lưu để xuất Excel."
  return null
}

/** Owns the stale-snapshot guard and one-download lock for draft export. */
export function useDeviceQuotaDraftCatalogExport({
  snapshot,
  status,
  statusMessage,
  isDirty,
  isMutationPending,
  isReadOnly,
}: UseDeviceQuotaDraftCatalogExportInput): UseDeviceQuotaDraftCatalogExportResult {
  const [isExporting, setIsExporting] = useState(false)
  const [exportFailure, setExportFailure] = useState<ExportFailure | null>(null)
  const exportLockRef = useRef(false)
  const mountedRef = useRef(true)
  const currentSnapshotRef = useRef<DeviceQuotaDraftCatalogExportSnapshot | null>(snapshot)
  const exportIdentityKey = getExportIdentityKey(snapshot)

  useEffect(() => {
    currentSnapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const blockedMessage = getExportBlockedMessage({
    isDirty,
    isMutationPending,
    snapshot,
    status,
    statusMessage,
  })
  const canExport =
    !isReadOnly &&
    !isExporting &&
    snapshot != null &&
    status === "ready" &&
    !isDirty &&
    !isMutationPending
  const exportError =
    exportFailure?.identityKey === exportIdentityKey ? exportFailure.message : null

  const handleExport = useCallback(async () => {
    if (!canExport || !snapshot || exportLockRef.current) return
    exportLockRef.current = true
    setIsExporting(true)
    setExportFailure(null)
    const acceptedSnapshot = snapshot
    const acceptedSnapshotKey = getExportIdentityKey(acceptedSnapshot)
    const isCurrentSnapshot = () =>
      mountedRef.current &&
      currentSnapshotRef.current != null &&
      getExportIdentityKey(currentSnapshotRef.current) === acceptedSnapshotKey

    try {
      const bytes = await serializeDeviceQuotaDraftCatalogWorkbook(acceptedSnapshot)
      if (!isCurrentSnapshot()) return
      const blob = new Blob([bytes as unknown as BlobPart], { type: EXPORT_FILE_MIME })
      if (!isCurrentSnapshot()) return
      downloadBlob(blob, buildDeviceQuotaDraftCatalogFilename(acceptedSnapshot))
    } catch {
      if (isCurrentSnapshot()) {
        setExportFailure({ identityKey: acceptedSnapshotKey, message: EXPORT_ERROR_MESSAGE })
      }
    } finally {
      exportLockRef.current = false
      if (mountedRef.current) setIsExporting(false)
    }
  }, [canExport, snapshot])

  return { isExporting, exportError, blockedMessage, canExport, handleExport }
}
