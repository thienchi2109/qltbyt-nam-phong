"use client"

import { useQuery } from "@tanstack/react-query"
import { TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT } from "../technical-configuration-query-keys"
import { listTechnicalConfigurationDossierSpecialties } from "../technical-configuration-rpc"
import type { TechnicalConfigurationDossierSpecialtiesRpcArgs } from "../types"

/** Queries saved specialty labels independently of dossier-list pagination. */
export function useTechnicalConfigurationDossierSpecialties({
  p_page = 1,
  p_page_size = 100,
  p_search = null,
}: TechnicalConfigurationDossierSpecialtiesRpcArgs = {}) {
  const args = { p_page, p_page_size, p_search }
  return useQuery({
    queryKey: [...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT, "specialties", args],
    queryFn: ({ signal }) => listTechnicalConfigurationDossierSpecialties(args, signal),
    staleTime: 30_000,
  })
}
