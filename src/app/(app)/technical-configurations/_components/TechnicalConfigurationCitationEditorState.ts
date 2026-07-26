export type TechnicalConfigurationCitationValues = {
  pageSection: string
  excerpt: string
}

export type TechnicalConfigurationCitationSelectionSnapshot =
  TechnicalConfigurationCitationValues & {
    documentId: string | null
    criterionId: string | null
  }

export type TechnicalConfigurationCitationEditorState = {
  selectedDocumentId: string | null
  selectedCriterionId: string | null
  pageSection: string
  excerpt: string
  baseValues: TechnicalConfigurationCitationValues
  saveError: unknown
}

export type TechnicalConfigurationCitationEditorAction =
  | {
      type: "adopt-selection"
      documentId: string | null
      criterionId: string | null
      values: TechnicalConfigurationCitationValues
    }
  | { type: "set-page-section"; value: string }
  | { type: "set-excerpt"; value: string }
  | { type: "save-start" }
  | { type: "save-success"; values: TechnicalConfigurationCitationValues }
  | { type: "save-error"; error: unknown }
  | { type: "delete-success" }

type TechnicalConfigurationCitationValuesDocument = {
  citations: readonly {
    criterion_id: string
    page_section: string | null
    excerpt: string | null
  }[]
}

/** Creates the controlled citation editor state for one initial selection. */
export function createTechnicalConfigurationCitationEditorState(
  documentId: string | null,
  criterionId: string | null,
  values: TechnicalConfigurationCitationValues
): TechnicalConfigurationCitationEditorState {
  return {
    selectedDocumentId: documentId,
    selectedCriterionId: criterionId,
    pageSection: values.pageSection,
    excerpt: values.excerpt,
    baseValues: values,
    saveError: null,
  }
}

/** Applies one atomic citation editor transition. */
export function reduceTechnicalConfigurationCitationEditorState(
  state: TechnicalConfigurationCitationEditorState,
  action: TechnicalConfigurationCitationEditorAction
): TechnicalConfigurationCitationEditorState {
  switch (action.type) {
    case "adopt-selection":
      return {
        selectedDocumentId: action.documentId,
        selectedCriterionId: action.criterionId,
        pageSection: action.values.pageSection,
        excerpt: action.values.excerpt,
        baseValues: action.values,
        saveError: null,
      }
    case "set-page-section":
      return { ...state, pageSection: action.value }
    case "set-excerpt":
      return { ...state, excerpt: action.value }
    case "save-start":
      return { ...state, saveError: null }
    case "save-success":
      return { ...state, baseValues: action.values }
    case "save-error":
      return { ...state, saveError: action.error }
    case "delete-success": {
      const emptyValues = { pageSection: "", excerpt: "" }
      return {
        ...state,
        pageSection: "",
        excerpt: "",
        baseValues: emptyValues,
        saveError: null,
      }
    }
  }
}

/** Reads editable citation values for one exact document and criterion. */
export function getTechnicalConfigurationCitationValues(
  document: TechnicalConfigurationCitationValuesDocument | null,
  criterionId: string | null
): TechnicalConfigurationCitationValues {
  if (!document || !criterionId) {
    return { pageSection: "", excerpt: "" }
  }
  const citation = document.citations.find((item) => item.criterion_id === criterionId)
  return {
    pageSection: citation?.page_section ?? "",
    excerpt: citation?.excerpt ?? "",
  }
}
