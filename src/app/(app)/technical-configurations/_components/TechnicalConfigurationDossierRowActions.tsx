"use client"

import { MoreHorizontal, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDeferredDropdownAction } from "@/components/ui/use-deferred-dropdown-action"

import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

type TechnicalConfigurationDossierRowActionsProps = {
  dossier: TechnicalConfigurationDossierWire
  disabled?: boolean
  onEdit: (dossier: TechnicalConfigurationDossierWire) => void
}

/** Renders the extendable row-action menu without exposing delete behavior. */
export function TechnicalConfigurationDossierRowActions({
  dossier,
  disabled = false,
  onEdit,
}: Readonly<TechnicalConfigurationDossierRowActionsProps>) {
  const deferDropdownAction = useDeferredDropdownAction()
  const actionLabel = `Hành động cho ${dossier.name}`

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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
