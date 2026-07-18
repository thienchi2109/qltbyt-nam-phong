import * as React from "react"
import { FileText } from "lucide-react"

import { TechnicalConfigurationBaselineDocuments } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDocuments"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationDocumentWire } from "@/app/(app)/technical-configurations/document-types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type TechnicalConfigurationReferenceEvidenceDetail = {
  ownerId: string
  productName: string
  criterionId: string
  criterionCode: string
}

type TechnicalConfigurationReferenceEvidenceIndicatorProps = {
  documents: readonly TechnicalConfigurationDocumentWire[]
  productName: string
  criterionId: string
  criterionCode: string
  isLoading: boolean
  onOpen: () => void
}

/** Renders a compact in-cell summary without adding a permanent evidence column. */
export function TechnicalConfigurationReferenceEvidenceIndicator({
  documents,
  productName,
  criterionId,
  criterionCode,
  isLoading,
  onOpen,
}: Readonly<TechnicalConfigurationReferenceEvidenceIndicatorProps>): React.JSX.Element {
  const citationCount = documents.reduce(
    (count, document) =>
      count + document.citations.filter((citation) => citation.criterion_id === criterionId).length,
    0
  )
  const label = `Bằng chứng ${productName} cho ${criterionCode}: ${documents.length} tài liệu, ${citationCount} trích dẫn`

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-2 h-8 max-w-full px-2"
      aria-label={label}
      disabled={isLoading}
      onClick={onOpen}
    >
      <FileText className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {citationCount > 0 ? `${citationCount} trích dẫn` : "Bằng chứng"}
      </span>
    </Button>
  )
}

type TechnicalConfigurationReferenceEvidenceDialogProps = {
  detail: TechnicalConfigurationReferenceEvidenceDetail | null
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  readOnly: boolean
  onClose: () => void
  onRevisionChange?: (revision: number) => void
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

/** Hosts reference-product evidence authoring for one criterion in a focused detail dialog. */
export function TechnicalConfigurationReferenceEvidenceDialog({
  detail,
  baselineVersion,
  readOnly,
  onClose,
  onRevisionChange,
  onDirtyChange,
  onNavigationBlockedChange,
}: Readonly<TechnicalConfigurationReferenceEvidenceDialogProps>): React.JSX.Element {
  const isDirtyRef = React.useRef(false)
  const isNavigationBlockedRef = React.useRef(false)

  React.useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) return
      if (isNavigationBlockedRef.current) return
      if (
        isDirtyRef.current &&
        !window.confirm("Bạn có thay đổi bằng chứng chưa lưu. Đóng và bỏ thay đổi?")
      ) {
        return
      }
      isDirtyRef.current = false
      onDirtyChange?.(false)
      onClose()
    },
    [onClose, onDirtyChange]
  )

  return (
    <Dialog open={detail !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" closeLabel="Đóng">
        <DialogHeader>
          <DialogTitle>
            {detail ? `${detail.productName} · ${detail.criterionCode}` : "Bằng chứng tham chiếu"}
          </DialogTitle>
          <DialogDescription>
            Tài liệu và trích dẫn áp dụng cho sản phẩm tham chiếu tại tiêu chí đang chọn.
          </DialogDescription>
        </DialogHeader>
        {detail ? (
          <TechnicalConfigurationBaselineDocuments
            baselineVersion={baselineVersion}
            ownerType="reference_product"
            ownerId={detail.ownerId}
            criterionId={detail.criterionId}
            readOnly={readOnly}
            onRevisionChange={onRevisionChange}
            onDirtyChange={(dirty) => {
              isDirtyRef.current = dirty
              onDirtyChange?.(dirty)
            }}
            onNavigationBlockedChange={(blocked) => {
              isNavigationBlockedRef.current = blocked
              onNavigationBlockedChange?.(blocked)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
