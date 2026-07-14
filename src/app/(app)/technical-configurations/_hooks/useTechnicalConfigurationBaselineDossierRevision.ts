import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { technicalConfigurationDossierDetailQueryKey } from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
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
      setDossierRevision(revision)
      queryClient.setQueryData<TechnicalConfigurationDossierWireResponse>(
        technicalConfigurationDossierDetailQueryKey(dossier.id),
        (current) =>
          current
            ? {
                data: {
                  ...current.data,
                  revision,
                },
              }
            : current
      )
    },
    [dossier.id, queryClient]
  )

  const refreshDossierRevision = React.useCallback(async () => {
    const response = await getDossier(dossier.id)
    updateDossierRevision(response.data.revision)
  }, [dossier.id, getDossier, updateDossierRevision])

  return {
    dossierRevision,
    updateDossierRevision,
    refreshDossierRevision,
  }
}
