"use client"

import * as React from "react"
import {
  ChevronDown,
  Download,
  FileDown,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
} from "lucide-react"

import type { TechnicalConfigurationBaselineDecodedDraft } from "../baseline-types"
import { downloadTechnicalConfigurationBaselineWorkbookV2 } from "../technical-configuration-baseline-download"
import { HeroActionDropdown } from "@/components/ui/heroui/HeroActionDropdown"

type TechnicalConfigurationBaselineProductionActionsProps = Readonly<{
  version: TechnicalConfigurationBaselineDecodedDraft
  dirty: boolean
  conflict: boolean
  disabled: boolean
  disabledMessage: string | null
  onRequestHierarchyImport: () => void
}>

/** Mounts the P6B draft-only XLSX v2 and hierarchy import commands. */
export function TechnicalConfigurationBaselineProductionActions({
  version,
  dirty,
  conflict,
  disabled,
  disabledMessage,
  onRequestHierarchyImport,
}: TechnicalConfigurationBaselineProductionActionsProps): React.JSX.Element | null {
  const [downloadingIntent, setDownloadingIntent] = React.useState<
    "current-data" | "blank-template" | null
  >(null)
  const [error, setError] = React.useState<string | null>(null)
  const downloadingRef = React.useRef(false)

  if (version.status !== "draft") return null

  const guardMessage = conflict
    ? "Tải lại dữ liệu từ máy chủ trước khi dùng công cụ Excel."
    : dirty
      ? "Lưu thay đổi trước khi dùng công cụ Excel."
      : (disabledMessage ??
        (disabled ? "Chờ thao tác hiện tại hoàn tất trước khi dùng công cụ Excel." : null))
  const actionsDisabled = disabled || Boolean(guardMessage || downloadingIntent)
  const triggerAriaLabel = downloadingIntent ? "Đang tạo Excel" : "Công cụ Excel"
  const triggerLabel = downloadingIntent ? "Đang tạo Excel..." : "Excel"

  async function handleDownload(intent: "current-data" | "blank-template"): Promise<void> {
    if (actionsDisabled || downloadingRef.current) return
    downloadingRef.current = true
    setDownloadingIntent(intent)
    setError(null)
    try {
      await downloadTechnicalConfigurationBaselineWorkbookV2({ version, intent })
    } catch {
      setError("Không thể tạo tệp Excel cấu hình cơ sở.")
    } finally {
      downloadingRef.current = false
      setDownloadingIntent(null)
    }
  }

  return (
    <div
      role="group"
      aria-label="Công cụ cấu hình phân cấp"
      className="flex min-w-0 flex-col items-start gap-2"
    >
      <HeroActionDropdown
        ariaLabel={triggerAriaLabel}
        disabled={actionsDisabled}
        placement="bottom end"
        trigger={
          <>
            {downloadingIntent ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="size-4" aria-hidden="true" />
            )}
            <span>{triggerLabel}</span>
            <ChevronDown className="size-4" aria-hidden="true" />
          </>
        }
        triggerClassName="h-9 gap-2"
        items={[
          {
            id: "download-current",
            textValue: "Tải cấu hình hiện tại",
            onAction: () => void handleDownload("current-data"),
            label: (
              <span className="flex items-center gap-2">
                <Download className="size-4" aria-hidden="true" />
                Tải cấu hình hiện tại
              </span>
            ),
          },
          {
            id: "download-blank",
            textValue: "Tải mẫu trống",
            onAction: () => void handleDownload("blank-template"),
            label: (
              <span className="flex items-center gap-2">
                <FileDown className="size-4" aria-hidden="true" />
                Tải mẫu trống
              </span>
            ),
          },
          {
            id: "import-hierarchy",
            textValue: "Nhập cấu hình phân cấp",
            onAction: onRequestHierarchyImport,
            label: (
              <span className="flex items-center gap-2">
                <Upload className="size-4" aria-hidden="true" />
                Nhập cấu hình phân cấp
              </span>
            ),
          },
        ]}
      />
      {guardMessage ? <p className="text-sm text-muted-foreground">{guardMessage}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
