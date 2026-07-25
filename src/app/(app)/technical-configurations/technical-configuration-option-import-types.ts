import type * as React from "react"

import type { TechnicalConfigurationBaselineDraftWire } from "./baseline-types"
import type {
  TechnicalConfigurationOptionImportPreviewWireResponse,
  TechnicalConfigurationOptionWire,
} from "./supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "./types"
import type { BulkImportState } from "@/components/bulk-import/bulk-import-types"
import type { TechnicalConfigurationOptionWorkbookParseResult } from "@/lib/technical-configuration-option-excel-contract"

export type UseTechnicalConfigurationOptionImportOptions = {
  dossier: TechnicalConfigurationDossierWire
  option: TechnicalConfigurationOptionWire
  baselineVersion: TechnicalConfigurationBaselineDraftWire | null
  isBlocked: boolean
  onRevisionChange?: (revision: number) => void
}

export interface UseTechnicalConfigurationOptionImportResult {
  open: boolean
  state: BulkImportState<TechnicalConfigurationOptionWorkbookParseResult>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  preview: TechnicalConfigurationOptionImportPreviewWireResponse | null
  operationError: string | null
  isPreviewing: boolean
  isApplying: boolean
  isPreviewStale: boolean
  isDownloading: boolean
  isDirty: boolean
  isNavigationBlocked: boolean
  canUseActions: boolean
  openDialog: () => void
  onOpenChange: (open: boolean) => void
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  reset: () => void
  downloadTemplate: () => Promise<void>
  applyPreview: () => Promise<void>
}
