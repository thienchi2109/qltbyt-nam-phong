"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDeferredDropdownAction } from "@/components/ui/use-deferred-dropdown-action"

import type {
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierWire,
} from "@/app/(app)/technical-configurations/types"

const LOCKED_DELETE_REASON = "Hồ sơ có baseline đã khóa nên được bảo toàn vĩnh viễn."

type TechnicalConfigurationDossierRowActionsProps = {
  dossier: TechnicalConfigurationDossierListItemWire
  disabled?: boolean
  onDelete: (dossier: TechnicalConfigurationDossierListItemWire) => void
  onEdit: (dossier: TechnicalConfigurationDossierWire) => void
}

/** Renders metadata edit and guarded permanent-delete actions for one dossier row. */
export function TechnicalConfigurationDossierRowActions({
  dossier,
  disabled = false,
  onDelete,
  onEdit,
}: Readonly<TechnicalConfigurationDossierRowActionsProps>) {
  const deferDropdownAction = useDeferredDropdownAction()
  const actionLabel = `Hành động cho ${dossier.name}`
  const deleteReasonId = `dossier-delete-reason-${dossier.id}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={disabled}
          aria-label={actionLabel}
          title={actionLabel}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Hành động</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => deferDropdownAction(() => onEdit(dossier))}>
          <Pencil className="mr-2 size-4" aria-hidden="true" />
          Sửa metadata
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          aria-disabled={!dossier.can_delete}
          aria-describedby={!dossier.can_delete ? deleteReasonId : undefined}
          title={!dossier.can_delete ? LOCKED_DELETE_REASON : undefined}
          className="text-destructive focus:text-destructive"
          onSelect={(event) => {
            if (!dossier.can_delete) {
              event.preventDefault()
              return
            }

            deferDropdownAction(() => onDelete(dossier))
          }}
        >
          <Trash2 className="mr-2 size-4" aria-hidden="true" />
          Xóa vĩnh viễn
        </DropdownMenuItem>
        {!dossier.can_delete ? (
          <span id={deleteReasonId} className="sr-only">
            {LOCKED_DELETE_REASON}
          </span>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
