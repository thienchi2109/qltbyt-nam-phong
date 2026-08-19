import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { updateTechnicalConfigurationDossierRevisionCache } from "@/app/(app)/technical-configurations/technical-configuration-dossier-revision-cache"
import type {
  TechnicalConfigurationDossierWire,
  TechnicalConfigurationDossierWireResponse,
} from "@/app/(app)/technical-configurations/types"

type GetDossier = (dossierId: string) => Promise<TechnicalConfigurationDossierWireResponse>

/** Keeps the baseline lifecycle revision aligned with dossier detail cache state. */
export function useTechnicalConfigurationBaselineDossierRevision({
  dossier,
  getDossier,
}: {
  dossier: TechnicalConfigurationDossierWire
  getDossier: GetDossier
}) {
  const queryClient = useQueryClient()
  const [dossierRevision, setDossierRevision] = React.useState(dossier.revision)

  const updateDossierRevision = React.useCallback(
    (revision: number) => {
      setDossierRevision((current) => Math.max(current, dossier.revision, revision))
      updateTechnicalConfigurationDossierRevisionCache(queryClient, dossier, revision)
    },
    [dossier, queryClient]
  )

  const refreshDossierRevision = React.useCallback(async () => {
    const response = await getDossier(dossier.id)
    updateDossierRevision(response.data.revision)
    return response.data.revision
  }, [dossier.id, getDossier, updateDossierRevision])

  return {
    dossierRevision,
    updateDossierRevision,
    refreshDossierRevision,
  }
}
