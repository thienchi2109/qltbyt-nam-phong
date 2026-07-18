import { act, render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBaselineDocuments } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDocuments"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationDocumentWire } from "@/app/(app)/technical-configurations/document-types"
import type { UrlDocumentFormProps } from "@/components/url-documents/UrlDocumentForm"
import type { UrlDocumentListProps } from "@/components/url-documents/UrlDocumentList"

const sharedPrimitives = vi.hoisted(() => ({
  formProps: null as UrlDocumentFormProps | null,
  listProps: null as UrlDocumentListProps | null,
  parseAbsoluteUrl: vi.fn(),
  isAllowedDocumentUrl: vi.fn(),
}))

const documentState = vi.hoisted(() => ({
  documentsQuery: {
    isLoading: false,
    isError: false,
    data: [],
    refetch: vi.fn(),
  },
  documents: [] as TechnicalConfigurationDocumentWire[],
  getDocumentsForOwner: vi.fn(),
  isReadOnly: false,
  isSaving: false,
  isConflict: false,
  mutationError: null as unknown,
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  upsertCitation: vi.fn(),
  deleteCitation: vi.fn(),
}))

vi.mock("@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocuments", () => ({
  useTechnicalConfigurationDocuments: () => documentState,
}))

vi.mock("@/components/url-documents/UrlDocumentForm", () => ({
  UrlDocumentForm: (props: UrlDocumentFormProps) => {
    sharedPrimitives.formProps = props
    return <div data-testid="shared-url-document-form" />
  },
}))

vi.mock("@/components/url-documents/UrlDocumentList", () => ({
  UrlDocumentList: (props: UrlDocumentListProps) => {
    sharedPrimitives.listProps = props
    return <div data-testid="shared-url-document-list" />
  },
}))

vi.mock("@/components/url-documents/url-document-utils", () => ({
  parseAbsoluteUrl: sharedPrimitives.parseAbsoluteUrl,
  isAllowedDocumentUrl: sharedPrimitives.isAllowedDocumentUrl,
}))

const baselineVersion: TechnicalConfigurationBaselineDraftWire = {
  id: "version-1",
  dossier_id: "dossier-1",
  version_number: 1,
  status: "draft",
  source_baseline_version_id: null,
  source_version_number: null,
  next_criterion_number: 2,
  revision: 5,
  locked_at: null,
  locked_by: null,
  created_at: "2026-07-18T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-18T00:00:00.000Z",
  updated_by: 1,
  groups: [],
}

describe("P7B2 shared URL-document delegation", () => {
  beforeEach(() => {
    sharedPrimitives.formProps = null
    sharedPrimitives.listProps = null
    sharedPrimitives.parseAbsoluteUrl.mockReset()
    sharedPrimitives.isAllowedDocumentUrl.mockReset()
    sharedPrimitives.parseAbsoluteUrl.mockImplementation((raw: string) => ({
      raw,
      protocol: "https:",
    }))
    sharedPrimitives.isAllowedDocumentUrl.mockReturnValue(true)
    Object.values(documentState)
      .filter((value) => typeof value === "function")
      .forEach((mock) => mock.mockReset())
    documentState.getDocumentsForOwner.mockReturnValue([])
    documentState.createDocument.mockResolvedValue({ data: { revision: 6 } })
  })

  it("drives active create and list workflows through the unchanged shared primitives", async () => {
    const rawUrl = "HtTpS://EXAMPLE.com/a/../spec.pdf"
    render(
      <TechnicalConfigurationBaselineDocuments
        baselineVersion={baselineVersion}
        ownerType="baseline"
        ownerId={baselineVersion.id}
      />
    )

    expect(documentState.getDocumentsForOwner).toHaveBeenCalledWith("baseline", baselineVersion.id)
    expect(sharedPrimitives.formProps).not.toBeNull()
    expect(sharedPrimitives.listProps).toMatchObject({
      items: [],
      isLoading: false,
    })

    act(() => {
      sharedPrimitives.formProps?.onNameChange("Hồ sơ kỹ thuật")
      sharedPrimitives.formProps?.onUrlChange(rawUrl)
    })
    await waitFor(() => expect(sharedPrimitives.formProps?.url).toBe(rawUrl))
    await act(async () => {
      await sharedPrimitives.formProps?.onSubmit()
    })

    expect(sharedPrimitives.parseAbsoluteUrl).toHaveBeenCalledWith(rawUrl)
    expect(sharedPrimitives.isAllowedDocumentUrl).toHaveBeenCalled()
    expect(documentState.createDocument).toHaveBeenCalledWith({
      ownerType: "baseline",
      ownerId: baselineVersion.id,
      name: "Hồ sơ kỹ thuật",
      url: rawUrl,
    })
  })
})
