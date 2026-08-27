import { describe, expect, it } from "vitest"

import { normalizeTechnicalConfigurationDossierSearch } from "../technical-configuration-dossier-search"
import {
  TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
  technicalConfigurationDossierDetailQueryKey,
  technicalConfigurationDossierListQueryKey,
} from "../technical-configuration-query-keys"

function buildListQueryKey(search: string, page = 1, pageSize = 20) {
  return technicalConfigurationDossierListQueryKey({
    page,
    pageSize,
    normalizedSearch: normalizeTechnicalConfigurationDossierSearch(search),
  })
}

describe("technical configuration dossier list query key", () => {
  it("shares cache identity for equivalent normalized searches", () => {
    expect(buildListQueryKey("Máy siêu âm")).toEqual(buildListQueryKey("may-sieu_am"))
  })

  it("isolates different searches, pages, and page sizes", () => {
    const key = buildListQueryKey("may sieu am")

    expect(key).not.toEqual(buildListQueryKey("x quang"))
    expect(key).not.toEqual(buildListQueryKey("may sieu am", 2))
    expect(key).not.toEqual(buildListQueryKey("may sieu am", 1, 50))
  })

  it("retains the dossier root as the invalidation prefix", () => {
    expect(buildListQueryKey("Máy siêu âm")).toEqual([
      ...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
      {
        page: 1,
        pageSize: 20,
        search: "may sieu am",
      },
    ])
  })

  it("keeps dossier detail identity independent from list search state", () => {
    const detailKey = technicalConfigurationDossierDetailQueryKey("dossier-1")

    expect(buildListQueryKey("may sieu am")).not.toEqual(buildListQueryKey("x quang"))
    expect(technicalConfigurationDossierDetailQueryKey("dossier-1")).toEqual(detailKey)
    expect(detailKey).toEqual([
      ...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
      "detail",
      "dossier-1",
    ])
  })
})
