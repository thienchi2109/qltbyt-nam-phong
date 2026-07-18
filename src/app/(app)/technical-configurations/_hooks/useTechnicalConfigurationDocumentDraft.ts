import * as React from "react"

import type { TechnicalConfigurationDocumentWire } from "@/app/(app)/technical-configurations/document-types"

interface TechnicalConfigurationDocumentDraftState {
  name: string
  url: string
  selectedDocumentId: string | null
  selectedDocument: TechnicalConfigurationDocumentWire | null
  selectedDocumentMissing: boolean
  documentDirty: boolean
  setName: React.Dispatch<React.SetStateAction<string>>
  setUrl: React.Dispatch<React.SetStateAction<string>>
  clearDraft: () => void
  selectDocument: (document: TechnicalConfigurationDocumentWire) => void
}

/** Reconciles clean document drafts with refreshed server values while preserving user edits. */
export function useTechnicalConfigurationDocumentDraft(
  documents: readonly TechnicalConfigurationDocumentWire[]
): TechnicalConfigurationDocumentDraftState {
  const [name, setName] = React.useState("")
  const [url, setUrl] = React.useState("")
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null)
  const adoptedDocumentRef = React.useRef<Pick<
    TechnicalConfigurationDocumentWire,
    "id" | "name" | "url"
  > | null>(null)
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null
  const selectedDocumentMissing = selectedDocumentId !== null && selectedDocument === null
  const adoptedDocument = adoptedDocumentRef.current
  const draftMatchesAdoptedDocument =
    selectedDocument !== null &&
    adoptedDocument?.id === selectedDocument.id &&
    name === adoptedDocument.name &&
    url === adoptedDocument.url
  const documentDirty =
    selectedDocument === null
      ? Boolean(name || url)
      : !draftMatchesAdoptedDocument &&
        (name !== selectedDocument.name || url !== selectedDocument.url)

  const adoptDocument = React.useCallback((document: TechnicalConfigurationDocumentWire) => {
    adoptedDocumentRef.current = {
      id: document.id,
      name: document.name,
      url: document.url,
    }
    setName(document.name)
    setUrl(document.url)
  }, [])

  React.useEffect(() => {
    if (!selectedDocument) return
    const lastAdoptedDocument = adoptedDocumentRef.current
    if (lastAdoptedDocument?.id !== selectedDocument.id) {
      adoptDocument(selectedDocument)
      return
    }

    const draftIsClean = name === lastAdoptedDocument.name && url === lastAdoptedDocument.url
    const selectedDocumentWasRefreshed =
      selectedDocument.name !== lastAdoptedDocument.name ||
      selectedDocument.url !== lastAdoptedDocument.url
    if (draftIsClean && selectedDocumentWasRefreshed) {
      adoptDocument(selectedDocument)
    }
  }, [adoptDocument, name, selectedDocument, url])

  const clearDraft = React.useCallback(() => {
    adoptedDocumentRef.current = null
    setSelectedDocumentId(null)
    setName("")
    setUrl("")
  }, [])

  const selectDocument = React.useCallback(
    (document: TechnicalConfigurationDocumentWire) => {
      setSelectedDocumentId(document.id)
      adoptDocument(document)
    },
    [adoptDocument]
  )

  return {
    name,
    url,
    selectedDocumentId,
    selectedDocument,
    selectedDocumentMissing,
    documentDirty,
    setName,
    setUrl,
    clearDraft,
    selectDocument,
  }
}
