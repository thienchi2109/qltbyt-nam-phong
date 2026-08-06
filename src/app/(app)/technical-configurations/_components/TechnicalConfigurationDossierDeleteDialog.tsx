"use client"

import { Trash2 } from "lucide-react"

import type { TechnicalConfigurationDossierListItemWire } from "@/app/(app)/technical-configurations/types"
import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog"

type TechnicalConfigurationDossierDeleteDialogProps = {
  dossier: TechnicalConfigurationDossierListItemWire | null
  errorMessage: string | null
  isPending: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

/** Presents the permanent dossier delete warning while mutation state stays with the action owner. */
export function TechnicalConfigurationDossierDeleteDialog({
  dossier,
  errorMessage,
  isPending,
  onConfirm,
  onOpenChange,
}: Readonly<TechnicalConfigurationDossierDeleteDialogProps>) {
  const confirmLabel = errorMessage ? "Thử xóa lại" : "Xóa vĩnh viễn"

  return (
    <DestructiveConfirmDialog
      open={dossier !== null}
      onOpenChange={onOpenChange}
      title="Xóa hồ sơ cấu hình vĩnh viễn?"
      description={
        <span className="space-y-3">
          <span className="block">
            Hồ sơ <strong>{dossier?.name}</strong> và toàn bộ dữ liệu làm việc phụ thuộc sẽ bị xóa
            vĩnh viễn. Hành động này không thể hoàn tác.
          </span>
          {errorMessage ? (
            <span role="alert" className="block text-destructive">
              {errorMessage}
            </span>
          ) : null}
        </span>
      }
      confirmLabel={
        <span className="inline-flex items-center">
          <Trash2 className="mr-2 size-4" aria-hidden="true" />
          {confirmLabel}
        </span>
      }
      isPending={isPending}
      onConfirm={onConfirm}
    />
  )
}
