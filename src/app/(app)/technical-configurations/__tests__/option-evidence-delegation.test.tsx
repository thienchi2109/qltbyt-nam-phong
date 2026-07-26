import { act, render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationOptionDocuments } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionDocuments"
import type {
  TechnicalConfigurationCitationSaveInput,
  TechnicalConfigurationCitationCriterion,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor"
import type { TechnicalConfigurationOptionDocumentWire } from "@/app/(app)/technical-configurations/document-types"
import type { UrlDocumentFormProps } from "@/components/url-documents/UrlDocumentForm"
import type { UrlDocumentListProps } from "@/components/url-documents/UrlDocumentList"

import { baselineVersion } from "./baseline-evidence-fixtures"
import { dossier, option } from "./supplier-options-fixtures"

type CitationEditorProps = {
  documents: readonly {
    id: string
    name: string
    citations: readonly {
      id: string
      criterion_id: string
      page_section: string | null
      excerpt: string | null
    }[]
  }[]
  criteria: readonly TechnicalConfigurationCitationCriterion[]
  fixedCriterionId?: string | null
  isPending: boolean
  disabled: boolean
  onSave: (input: TechnicalConfigurationCitationSaveInput) => Promise<unknown>
  onDelete: (input: { document: { id: string }; citationId: string }) => Promise<unknown>
  onDirtyChange?: (dirty: boolean) => void
}

const sharedPrimitives = vi.hoisted(() => ({
  formProps: null as UrlDocumentFormProps | null,
  listProps: null as UrlDocumentListProps | null,
  citationProps: null as CitationEditorProps | null,
  parseAbsoluteUrl: vi.fn(),
  isAllowedDocumentUrl: vi.fn(),
}))

const evidenceState = vi.hoisted(() => ({
  documentsQuery: {
    isLoading: false,
    isError: false,
    data: [] as TechnicalConfigurationOptionDocumentWire[],
    refetch: vi.fn(),
  },
  documents: [] as TechnicalConfigurationOptionDocumentWire[],
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

vi.mock(
  "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionDocuments",
  () => ({
    useTechnicalConfigurationOptionDocuments: () => evidenceState,
  })
)

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationCitationEditor",
  () => ({
    TechnicalConfigurationCitationEditor: (props: CitationEditorProps) => {
      sharedPrimitives.citationProps = props
      return <div data-testid="shared-citation-editor" />
    },
  })
)

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

const currentOption = option({ id: "option-1" })

describe("P9B2 shared option-evidence delegation", () => {
  beforeEach(() => {
    sharedPrimitives.formProps = null
    sharedPrimitives.listProps = null
    sharedPrimitives.citationProps = null
    sharedPrimitives.parseAbsoluteUrl.mockReset()
    sharedPrimitives.isAllowedDocumentUrl.mockReset()
    sharedPrimitives.parseAbsoluteUrl.mockImplementation((raw: string) => ({
      raw,
      protocol: "https:",
    }))
    sharedPrimitives.isAllowedDocumentUrl.mockReturnValue(true)
    Object.values(evidenceState)
      .filter((value) => typeof value === "function")
      .forEach((mock) => mock.mockReset())
    evidenceState.documents = []
    evidenceState.documentsQuery.data = []
    evidenceState.createDocument.mockResolvedValue({ data: { revision: 4 } })
  })

  it("drives option create/list/citation workflows through the established shared contracts", async () => {
    const rawUrl = "HtTpS://EXAMPLE.com/a/../option-spec.pdf"
    render(
      <TechnicalConfigurationOptionDocuments
        dossier={dossier}
        option={currentOption}
        baselineVersion={{
          ...baselineVersion,
          dossier_id: dossier.id,
          groups: [
            {
              id: "group-1",
              baseline_version_id: baselineVersion.id,
              name: "Yêu cầu chung",
              sort_order: 1,
              created_at: baselineVersion.created_at,
              created_by: 1,
              updated_at: baselineVersion.updated_at,
              updated_by: 1,
              criteria: [
                {
                  id: "criterion-1",
                  baseline_version_id: baselineVersion.id,
                  group_id: "group-1",
                  criterion_code: "TC-0001",
                  title: "Nguồn điện",
                  requirement_text: "220V",
                  sort_order: 1,
                  source_criterion_id: null,
                  created_at: baselineVersion.created_at,
                  created_by: 1,
                  updated_at: baselineVersion.updated_at,
                  updated_by: 1,
                },
              ],
            },
          ],
        }}
        criterionId="criterion-1"
      />
    )

    expect(sharedPrimitives.formProps).not.toBeNull()
    expect(sharedPrimitives.listProps).toMatchObject({
      items: [],
      isLoading: false,
    })
    expect(sharedPrimitives.citationProps).toMatchObject({
      fixedCriterionId: "criterion-1",
      disabled: false,
      isPending: false,
    })

    act(() => {
      sharedPrimitives.formProps?.onNameChange("Hồ sơ phương án")
      sharedPrimitives.formProps?.onUrlChange(rawUrl)
    })
    await waitFor(() => expect(sharedPrimitives.formProps?.url).toBe(rawUrl))
    await act(async () => {
      await sharedPrimitives.formProps?.onSubmit()
    })

    expect(sharedPrimitives.parseAbsoluteUrl).toHaveBeenCalledWith(rawUrl)
    expect(sharedPrimitives.isAllowedDocumentUrl).toHaveBeenCalled()
    expect(evidenceState.createDocument).toHaveBeenCalledWith({
      name: "Hồ sơ phương án",
      url: rawUrl,
    })
  })
})
