"use client"

import { Upload } from "lucide-react"

import type { TechnicalConfigurationBaselineDecodedDraft } from "../baseline-types"
import { Button } from "@/components/ui/button"

import { TechnicalConfigurationBaselineDownloadActions } from "./TechnicalConfigurationBaselineDownloadActions"

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
}: TechnicalConfigurationBaselineProductionActionsProps) {
  if (version.status !== "draft") return null

  const actionsDisabled = disabled || dirty || conflict

  return (
    <div
      role="group"
      aria-label="Công cụ cấu hình phân cấp"
      className="flex min-w-0 flex-wrap items-start gap-2"
    >
      <TechnicalConfigurationBaselineDownloadActions
        version={version}
        dirty={dirty}
        conflict={conflict}
        disabled={disabled}
        disabledMessage={disabledMessage}
      />
      <Button
        type="button"
        variant="outline"
        disabled={actionsDisabled}
        onClick={onRequestHierarchyImport}
      >
        <Upload className="size-4" aria-hidden="true" />
        Nhập cấu hình phân cấp
      </Button>
    </div>
  )
}
