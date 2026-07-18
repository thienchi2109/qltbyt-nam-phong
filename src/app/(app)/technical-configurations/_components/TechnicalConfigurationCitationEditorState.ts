import type { TechnicalConfigurationDocumentWire } from "@/app/(app)/technical-configurations/document-types"

export type TechnicalConfigurationCitationValues = {
  pageSection: string
  excerpt: string
}

export type TechnicalConfigurationCitationSelectionSnapshot =
  TechnicalConfigurationCitationValues & {
    documentId: string | null
    criterionId: string | null
  }

/** Reads editable citation values for one exact document and criterion. */
export function getTechnicalConfigurationCitationValues(
  document: TechnicalConfigurationDocumentWire | null,
  criterionId: string | null
): TechnicalConfigurationCitationValues {
  const citation = document?.citations.find((item) => item.criterion_id === criterionId)
  return {
    pageSection: citation?.page_section ?? "",
    excerpt: citation?.excerpt ?? "",
  }
}
