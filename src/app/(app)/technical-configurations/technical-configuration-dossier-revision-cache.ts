import type { QueryClient } from "@tanstack/react-query"

import { technicalConfigurationDossierDetailQueryKey } from "./technical-configuration-query-keys"
import { getTechnicalConfigurationDossier } from "./technical-configuration-rpc"
import type {
  TechnicalConfigurationDossierWire,
  TechnicalConfigurationDossierWireResponse,
} from "./types"

/** Keeps the cached dossier detail revision aligned with successful child mutations. */
export function updateTechnicalConfigurationDossierRevisionCache(
  queryClient: QueryClient,
  dossier: TechnicalConfigurationDossierWire,
  revision: number
) {
  queryClient.setQueryData<TechnicalConfigurationDossierWireResponse>(
    technicalConfigurationDossierDetailQueryKey(dossier.id),
    (current) => {
      const nextRevision = Math.max(current?.data.revision ?? 0, dossier.revision, revision)
      return {
        data: { ...(current?.data ?? dossier), revision: nextRevision },
      }
    }
  )
}

/** Fetches the current dossier revision when a nullable child snapshot has no revision. */
export async function fetchTechnicalConfigurationDossierRevision(
  queryClient: QueryClient,
  dossierId: string
): Promise<number> {
  const response = await queryClient.fetchQuery({
    queryKey: technicalConfigurationDossierDetailQueryKey(dossierId),
    queryFn: ({ signal }) => getTechnicalConfigurationDossier(dossierId, signal),
    staleTime: 0,
  })
  return response.data.revision
}
