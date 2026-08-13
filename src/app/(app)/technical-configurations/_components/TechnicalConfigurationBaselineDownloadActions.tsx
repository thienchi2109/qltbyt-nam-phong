"use client"

import * as React from "react"
import { Download, FileDown, LoaderCircle } from "lucide-react"

import type { TechnicalConfigurationBaselineDecodedDraft } from "@/app/(app)/technical-configurations/baseline-types"
import {
  downloadTechnicalConfigurationBaselineWorkbookV2,
  type TechnicalConfigurationBaselineDownloadIntent,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-download"
import { Button } from "@/components/ui/button"

type TechnicalConfigurationBaselineDownloadActionsProps = {
  version: TechnicalConfigurationBaselineDecodedDraft
  dirty: boolean
  conflict: boolean
  disabled?: boolean
  disabledMessage?: string | null
}

/** Renders production draft-only XLSX v2 download actions. */
export function TechnicalConfigurationBaselineDownloadActions({
  version,
  dirty,
  conflict,
  disabled: externallyDisabled = false,
  disabledMessage = null,
}: Readonly<TechnicalConfigurationBaselineDownloadActionsProps>): React.JSX.Element | null {
  const [downloadingIntent, setDownloadingIntent] =
    React.useState<TechnicalConfigurationBaselineDownloadIntent | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const downloadingRef = React.useRef(false)

  if (version.status !== "draft") return null

  const guardMessage = conflict
    ? "Tải lại dữ liệu từ máy chủ trước khi tải tệp Excel."
    : dirty
      ? "Lưu thay đổi trước khi tải tệp Excel."
      : disabledMessage
  const disabled = Boolean(externallyDisabled || guardMessage || downloadingIntent)

  async function handleDownload(
    intent: TechnicalConfigurationBaselineDownloadIntent
  ): Promise<void> {
    if (disabled || downloadingRef.current) return
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
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => void handleDownload("current-data")}
        >
          {downloadingIntent === "current-data" ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {downloadingIntent === "current-data" ? "Đang tải cấu hình..." : "Tải cấu hình hiện tại"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => void handleDownload("blank-template")}
        >
          {downloadingIntent === "blank-template" ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileDown className="size-4" aria-hidden="true" />
          )}
          {downloadingIntent === "blank-template" ? "Đang tải mẫu..." : "Tải mẫu trống"}
        </Button>
      </div>
      {guardMessage ? <p className="text-sm text-muted-foreground">{guardMessage}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
