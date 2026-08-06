"use client"

import { ArrowRight, Loader2, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import type {
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierWire,
} from "@/app/(app)/technical-configurations/types"

const LOCKED_DELETE_REASON = "Hồ sơ có baseline đã khóa nên được bảo toàn vĩnh viễn."

type TechnicalConfigurationDossierRowActionsProps = {
  dossier: TechnicalConfigurationDossierListItemWire
  disabled?: boolean
  isOpening: boolean
  onDelete: (dossier: TechnicalConfigurationDossierListItemWire) => void
  onEdit: (dossier: TechnicalConfigurationDossierWire) => void
  onOpen: (id: string) => void
}

/** Renders the always-visible icon actions for one dossier row. */
export function TechnicalConfigurationDossierRowActions({
  dossier,
  disabled = false,
  isOpening,
  onDelete,
  onEdit,
  onOpen,
}: Readonly<TechnicalConfigurationDossierRowActionsProps>) {
  const deleteReasonId = `dossier-delete-reason-${dossier.id}`

  return (
    <TooltipProvider delayDuration={300} disableHoverableContent>
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={disabled}
              aria-label={`Mở ${dossier.name}`}
              onClick={() => onOpen(dossier.id)}
            >
              {isOpening ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mở hồ sơ</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={disabled}
              aria-label={`Sửa metadata ${dossier.name}`}
              onClick={() => onEdit(dossier)}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sửa metadata</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive focus-visible:text-destructive aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              disabled={disabled}
              aria-label={`Xóa vĩnh viễn ${dossier.name}`}
              aria-disabled={!dossier.can_delete}
              aria-describedby={!dossier.can_delete ? deleteReasonId : undefined}
              onClick={() => {
                if (!dossier.can_delete) return
                onDelete(dossier)
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {dossier.can_delete ? "Xóa vĩnh viễn" : LOCKED_DELETE_REASON}
          </TooltipContent>
        </Tooltip>

        {!dossier.can_delete ? (
          <span id={deleteReasonId} className="sr-only">
            {LOCKED_DELETE_REASON}
          </span>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
