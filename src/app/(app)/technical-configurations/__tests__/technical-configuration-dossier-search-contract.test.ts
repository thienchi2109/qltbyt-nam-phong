import { describe, expect, it } from "vitest"

import {
  TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_DEBOUNCE_MS,
  TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_MAX_LENGTH,
  normalizeTechnicalConfigurationDossierSearch,
} from "../technical-configuration-dossier-search"
import {
  technicalConfigurationDossierSearchBoundaryFixtures,
  technicalConfigurationDossierSearchNormalizationFixtures,
} from "./technical-configuration-dossier-search-fixtures"

describe("technical configuration dossier search contract", () => {
  it.each(technicalConfigurationDossierSearchNormalizationFixtures)(
    "normalizes $name",
    ({ input, expected }) => {
      expect(normalizeTechnicalConfigurationDossierSearch(input)).toBe(expected)
    }
  )

  it("keeps the search limits as module-local constants", () => {
    expect(TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_DEBOUNCE_MS).toBe(300)
    expect(TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_MAX_LENGTH).toBe(200)
    expect(technicalConfigurationDossierSearchBoundaryFixtures.atLimit).toHaveLength(
      TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_MAX_LENGTH
    )
    expect(technicalConfigurationDossierSearchBoundaryFixtures.overLimit).toHaveLength(
      TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_MAX_LENGTH + 1
    )
    expect(
      normalizeTechnicalConfigurationDossierSearch(
        technicalConfigurationDossierSearchBoundaryFixtures.atLimit
      )
    ).toBe(technicalConfigurationDossierSearchBoundaryFixtures.atLimit)
    expect(
      normalizeTechnicalConfigurationDossierSearch(
        technicalConfigurationDossierSearchBoundaryFixtures.overLimit
      )
    ).toBe(technicalConfigurationDossierSearchBoundaryFixtures.overLimit)
  })
})
