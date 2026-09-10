"use client"

import { useQuery } from "@tanstack/react-query"
import { TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT } from "../technical-configuration-query-keys"
import { listTechnicalConfigurationDossierSpecialties } from "../technical-configuration-rpc"
import { collectStableTechnicalConfigurationPages } from "../technical-configuration-pagination"
import type { TechnicalConfigurationDossierSpecialtiesRpcArgs } from "../types"

/** Queries saved specialty labels independently of dossier-list pagination. */
export function useTechnicalConfigurationDossierSpecialties(
  {
    p_page = 1,
    p_page_size = 100,
    p_search = null,
  }: TechnicalConfigurationDossierSpecialtiesRpcArgs = {},
  allPages = false
) {
  const args = { p_page, p_page_size, p_search }
  return useQuery({
    queryKey: [...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT, "specialties", args, allPages],
    queryFn: async ({ signal }) => {
      if (!allPages) return listTechnicalConfigurationDossierSpecialties(args, signal)
      const { items, firstPage } = await collectStableTechnicalConfigurationPages({
        loadPage: (page) =>
          listTechnicalConfigurationDossierSpecialties({ ...args, p_page: page }, signal),
        getItemKey: (label: string) => label,
        snapshotError: "Danh sách chuyên khoa đã thay đổi. Vui lòng thử lại.",
      })
      return { ...firstPage, data: items }
    },
    staleTime: 30_000,
  })
}
