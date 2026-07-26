import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationOptionDocuments } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionDocuments"
import {
  technicalConfigurationOptionDocumentsQueryKey,
  technicalConfigurationOptionResponsesQueryKey,
} from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
import type {
  TechnicalConfigurationOptionDocumentWire,
  TechnicalConfigurationOptionDocumentsListWireResponse,
} from "@/app/(app)/technical-configurations/document-types"
import type { TechnicalConfigurationComparisonSetWire } from "@/app/(app)/technical-configurations/supplier-option-types"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

import { baselineVersion } from "./baseline-evidence-fixtures"
import { registerOptionEvidenceWorkspaceTests } from "./option-evidence-workspace-cases"
import { dossier, option } from "./supplier-options-fixtures"

const rpc = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  upsertCitation: vi.fn(),
  deleteCitation: vi.fn(),
  getOrCreateComparisonSet: vi.fn(),
  fetchDossierRevision: vi.fn(),
}))

vi.mock("@/app/(app)/technical-configurations/technical-configuration-document-rpc", () => ({
  listTechnicalConfigurationOptionDocuments: rpc.listDocuments,
  createTechnicalConfigurationOptionDocument: rpc.createDocument,
  updateTechnicalConfigurationOptionDocument: rpc.updateDocument,
  deleteTechnicalConfigurationOptionDocument: rpc.deleteDocument,
  upsertTechnicalConfigurationOptionCitation: rpc.upsertCitation,
  deleteTechnicalConfigurationOptionCitation: rpc.deleteCitation,
}))

vi.mock(
  "@/app/(app)/technical-configurations/technical-configuration-option-response-operations",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/app/(app)/technical-configurations/technical-configuration-option-response-operations")
    >()),
    getOrCreateTechnicalConfigurationComparisonSet: rpc.getOrCreateComparisonSet,
  })
)

vi.mock(
  "@/app/(app)/technical-configurations/technical-configuration-dossier-revision-cache",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/app/(app)/technical-configurations/technical-configuration-dossier-revision-cache")
    >()),
    fetchTechnicalConfigurationDossierRevision: rpc.fetchDossierRevision,
  })
)

const currentOption = option({ id: "option-1" })
const currentBaseline = {
  ...baselineVersion,
  dossier_id: dossier.id,
}

function optionDocument(
  id: string,
  citations: TechnicalConfigurationOptionDocumentWire["citations"] = [],
  affectedCitationCount = citations.length
): TechnicalConfigurationOptionDocumentWire {
  return {
    id,
    option_id: currentOption.id,
    name: `Tài liệu ${id}`,
    url: `https://example.com/${id}.pdf`,
    created_by: 1,
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
    affected_citation_count: affectedCitationCount,
    citations,
  }
}

function documentsResponse(
  data: TechnicalConfigurationOptionDocumentWire[]
): TechnicalConfigurationOptionDocumentsListWireResponse {
  return {
    data,
    total: data.length,
    page: 1,
    page_size: 100,
  }
}

function comparisonSet(revision: number): TechnicalConfigurationComparisonSetWire {
  return {
    id: "comparison-set-1",
    dossier_id: dossier.id,
    option_id: currentOption.id,
    baseline_version_id: currentBaseline.id,
    created_at: "2026-07-26T00:00:00.000Z",
    created_by: 1,
    updated_at: "2026-07-26T00:00:00.000Z",
    updated_by: 1,
    revision,
    responses: [],
  }
}

function renderOptionDocumentsHook({
  baseline = currentBaseline,
  dossierValue = dossier,
  initialComparisonSet = null,
  onRevisionChange = vi.fn(),
  onNavigationBlockedChange = vi.fn(),
  queryClient = createTestQueryClient(),
}: {
  baseline?: typeof currentBaseline
  dossierValue?: typeof dossier
  initialComparisonSet?: TechnicalConfigurationComparisonSetWire | null
  onRevisionChange?: (revision: number) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  queryClient?: ReturnType<typeof createTestQueryClient>
} = {}) {
  const responseQueryKey = technicalConfigurationOptionResponsesQueryKey(
    currentOption.id,
    baseline.id
  )
  queryClient.setQueryDefaults(responseQueryKey, { gcTime: Number.POSITIVE_INFINITY })
  if (initialComparisonSet) {
    queryClient.setQueryData(responseQueryKey, initialComparisonSet)
  }
  const rendered = renderHook(
    () =>
      useTechnicalConfigurationOptionDocuments({
        dossier: dossierValue,
        option: currentOption,
        baselineVersion: baseline,
        comparisonSet: initialComparisonSet,
        onRevisionChange,
        onNavigationBlockedChange,
      }),
    { wrapper: createReactQueryWrapper(queryClient) }
  )
  return { ...rendered, queryClient, onRevisionChange, onNavigationBlockedChange }
}

describe("useTechnicalConfigurationOptionDocuments", () => {
  beforeEach(() => {
    Object.values(rpc).forEach((mock) => mock.mockReset())
    rpc.listDocuments.mockResolvedValue(documentsResponse([]))
  })

  it("lists shared option documents for the exact baseline without creating a comparison set", async () => {
    const sharedDocument = optionDocument("document-1")
    rpc.listDocuments.mockResolvedValue(documentsResponse([sharedDocument]))

    const { result } = renderOptionDocumentsHook()

    await waitFor(() => expect(result.current.documentsQuery.isSuccess).toBe(true))
    expect(result.current.documents).toEqual([sharedDocument])
    expect(rpc.listDocuments).toHaveBeenCalledWith(
      {
        p_option_id: currentOption.id,
        p_baseline_version_id: currentBaseline.id,
        p_page: 1,
        p_page_size: 100,
      },
      expect.any(AbortSignal)
    )
    expect(rpc.getOrCreateComparisonSet).not.toHaveBeenCalled()
  })

  it("uses separate exact-baseline query keys while retaining the shared option document identity", () => {
    expect(
      technicalConfigurationOptionDocumentsQueryKey(currentOption.id, currentBaseline.id)
    ).not.toEqual(
      technicalConfigurationOptionDocumentsQueryKey(currentOption.id, "baseline-version-2")
    )
  })

  it("refreshes another cached baseline after a shared option document mutation", async () => {
    const firstBaseline = { ...currentBaseline, id: "baseline-version-1" }
    const secondBaseline = { ...currentBaseline, id: "baseline-version-2" }
    const staleSecondDocument = {
      ...optionDocument("document-1"),
      name: "Tài liệu cũ",
      affected_citation_count: 1,
    }
    const refreshedSecondDocument = {
      ...staleSecondDocument,
      name: "Tài liệu mới",
      affected_citation_count: 2,
    }
    const queryClient = createTestQueryClient()
    queryClient.setQueryDefaults(
      technicalConfigurationOptionDocumentsQueryKey(currentOption.id, secondBaseline.id),
      { gcTime: Number.POSITIVE_INFINITY }
    )
    queryClient.setQueryData(
      technicalConfigurationOptionDocumentsQueryKey(currentOption.id, secondBaseline.id),
      [staleSecondDocument]
    )
    rpc.listDocuments.mockImplementation(
      ({ p_baseline_version_id }: { p_baseline_version_id: string }) =>
        Promise.resolve(
          documentsResponse(
            p_baseline_version_id === secondBaseline.id ? [refreshedSecondDocument] : []
          )
        )
    )
    rpc.createDocument.mockResolvedValue({
      data: {
        ...optionDocument("document-2"),
        revision: dossier.revision + 1,
      },
    })

    const firstView = renderOptionDocumentsHook({
      baseline: firstBaseline,
      queryClient,
    })
    await waitFor(() => expect(firstView.result.current.documentsQuery.isSuccess).toBe(true))
    await act(async () => {
      await firstView.result.current.createDocument({
        name: "Tài liệu mới",
        url: "https://example.com/document-2.pdf",
      })
    })
    expect(
      queryClient.getQueryState(
        technicalConfigurationOptionDocumentsQueryKey(currentOption.id, secondBaseline.id)
      )?.isInvalidated
    ).toBe(true)
    firstView.unmount()

    const secondView = renderOptionDocumentsHook({
      baseline: secondBaseline,
      queryClient,
    })
    await waitFor(() =>
      expect(secondView.result.current.documents).toEqual([refreshedSecondDocument])
    )
    expect(rpc.listDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ p_baseline_version_id: secondBaseline.id }),
      expect.any(AbortSignal)
    )
  })

  it("gets or creates the comparison set before the first explicit citation upsert", async () => {
    const document = optionDocument("document-1")
    const expectedRevision = Math.max(dossier.revision, currentBaseline.revision)
    const createdComparisonSet = comparisonSet(expectedRevision + 1)
    rpc.listDocuments.mockResolvedValue(documentsResponse([document]))
    rpc.getOrCreateComparisonSet.mockResolvedValue(createdComparisonSet)
    rpc.upsertCitation.mockResolvedValue({
      data: {
        id: "citation-1",
        criterion_id: "criterion-1",
        page_section: "Trang 12",
        excerpt: "Đáp ứng 220V",
        revision: createdComparisonSet.revision + 1,
      },
    })
    const rendered = renderOptionDocumentsHook()
    await waitFor(() => expect(rendered.result.current.documentsQuery.isSuccess).toBe(true))

    await act(async () => {
      await rendered.result.current.upsertCitation({
        document,
        criterionId: "criterion-1",
        pageSection: "Trang 12",
        excerpt: "Đáp ứng 220V",
      })
    })

    expect(rpc.getOrCreateComparisonSet).toHaveBeenCalledWith({
      p_option_id: currentOption.id,
      p_baseline_version_id: currentBaseline.id,
      p_expected_revision: expectedRevision,
    })
    expect(rpc.upsertCitation).toHaveBeenCalledWith({
      p_option_document_id: document.id,
      p_comparison_set_id: createdComparisonSet.id,
      p_criterion_id: "criterion-1",
      p_page_section: "Trang 12",
      p_excerpt: "Đáp ứng 220V",
      p_expected_revision: createdComparisonSet.revision,
    })
    expect(rpc.getOrCreateComparisonSet.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.upsertCitation.mock.invocationCallOrder[0]
    )
    expect(
      rendered.queryClient.getQueryData(
        technicalConfigurationOptionResponsesQueryKey(currentOption.id, currentBaseline.id)
      )
    ).toEqual(createdComparisonSet)
    expect(rendered.onRevisionChange).toHaveBeenNthCalledWith(1, createdComparisonSet.revision)
    expect(rendered.onRevisionChange).toHaveBeenLastCalledWith(createdComparisonSet.revision + 1)
  })

  it("uses an existing exact-baseline comparison set without calling get-or-create", async () => {
    const document = optionDocument("document-1")
    const existingComparisonSet = comparisonSet(dossier.revision + 4)
    const rendered = renderOptionDocumentsHook({
      dossierValue: { ...dossier, revision: existingComparisonSet.revision },
      initialComparisonSet: existingComparisonSet,
    })
    rpc.upsertCitation.mockResolvedValue({
      data: {
        id: "citation-1",
        criterion_id: "criterion-1",
        page_section: null,
        excerpt: "Đạt",
        revision: existingComparisonSet.revision + 1,
      },
    })
    await waitFor(() => expect(rendered.result.current.documentsQuery.isSuccess).toBe(true))

    await act(async () => {
      await rendered.result.current.upsertCitation({
        document,
        criterionId: "criterion-1",
        pageSection: null,
        excerpt: "Đạt",
      })
    })

    expect(rpc.getOrCreateComparisonSet).not.toHaveBeenCalled()
    expect(rpc.upsertCitation).toHaveBeenCalledWith(
      expect.objectContaining({
        p_comparison_set_id: existingComparisonSet.id,
        p_expected_revision: existingComparisonSet.revision,
      })
    )
  })

  it("advances the expected revision across consecutive citation saves", async () => {
    const document = optionDocument("document-1")
    const existingComparisonSet = comparisonSet(dossier.revision + 4)
    const rendered = renderOptionDocumentsHook({
      dossierValue: { ...dossier, revision: existingComparisonSet.revision },
      initialComparisonSet: existingComparisonSet,
    })
    rpc.upsertCitation
      .mockResolvedValueOnce({
        data: {
          id: "citation-1",
          criterion_id: "criterion-1",
          page_section: "Trang 1",
          excerpt: "Đạt lần một",
          revision: existingComparisonSet.revision + 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "citation-1",
          criterion_id: "criterion-1",
          page_section: "Trang 2",
          excerpt: "Đạt lần hai",
          revision: existingComparisonSet.revision + 2,
        },
      })
    await waitFor(() => expect(rendered.result.current.documentsQuery.isSuccess).toBe(true))

    await act(async () => {
      await rendered.result.current.upsertCitation({
        document,
        criterionId: "criterion-1",
        pageSection: "Trang 1",
        excerpt: "Đạt lần một",
      })
    })
    await act(async () => {
      await rendered.result.current.upsertCitation({
        document,
        criterionId: "criterion-1",
        pageSection: "Trang 2",
        excerpt: "Đạt lần hai",
      })
    })

    expect(rpc.upsertCitation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        p_expected_revision: existingComparisonSet.revision,
      })
    )
    expect(rpc.upsertCitation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        p_expected_revision: existingComparisonSet.revision + 1,
      })
    )
  })

  it("returns the global affected citation count from confirmed document deletion", async () => {
    const document = optionDocument("document-1", [], 7)
    rpc.deleteDocument.mockResolvedValue({
      data: {
        id: document.id,
        revision: dossier.revision + 1,
        affected_citation_count: 7,
      },
    })
    const rendered = renderOptionDocumentsHook()
    await waitFor(() => expect(rendered.result.current.documentsQuery.isSuccess).toBe(true))

    await expect(act(async () => rendered.result.current.deleteDocument(document))).resolves.toBe(7)
  })

  it("allows evidence mutations for locked baselines but blocks archived dossiers", async () => {
    rpc.createDocument.mockResolvedValue({
      data: {
        ...optionDocument("document-1"),
        revision: dossier.revision + 1,
      },
    })
    const locked = renderOptionDocumentsHook({
      baseline: {
        ...currentBaseline,
        status: "locked",
        locked_at: "2026-07-26T01:00:00.000Z",
        locked_by: 1,
      },
    })
    await waitFor(() => expect(locked.result.current.documentsQuery.isSuccess).toBe(true))

    await act(async () => {
      await locked.result.current.createDocument({
        name: "Tài liệu khóa",
        url: "https://example.com/locked.pdf",
      })
    })
    expect(rpc.createDocument).toHaveBeenCalledTimes(1)

    const archived = renderOptionDocumentsHook({
      dossierValue: {
        ...dossier,
        archived_at: "2026-07-26T02:00:00.000Z",
        archived_by: 1,
      },
    })
    await waitFor(() => expect(archived.result.current.documentsQuery.isSuccess).toBe(true))
    await expect(
      archived.result.current.createDocument({
        name: "Không được lưu",
        url: "https://example.com/read-only.pdf",
      })
    ).rejects.toThrow("read_only")
    expect(rpc.createDocument).toHaveBeenCalledTimes(1)
  })
})

registerOptionEvidenceWorkspaceTests(rpc)
