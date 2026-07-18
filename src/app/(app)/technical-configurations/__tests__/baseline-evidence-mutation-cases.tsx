import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useTechnicalConfigurationDocuments } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocuments"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import {
  baselineVersion,
  evidenceDocument,
  type DocumentRpcMocks,
} from "./baseline-evidence-fixtures"

export function registerBaselineEvidenceMutationTests(documentRpc: DocumentRpcMocks) {
  describe("useTechnicalConfigurationDocuments remaining mutations", () => {
    beforeEach(() => {
      Object.values(documentRpc).forEach((mock) => mock.mockReset())
    })

    it("routes update, citation, and delete through the exact owner contract", async () => {
      const baselineDocument = {
        ...evidenceDocument("baseline-document", "baseline", baselineVersion.id),
        citations: [
          {
            id: "baseline-citation",
            criterion_id: "criterion-1",
            page_section: "Mục 2",
            excerpt: "Nguồn điện ổn định",
          },
        ],
      }
      const referenceDocument = evidenceDocument(
        "reference-document",
        "reference_product",
        "reference-product-1"
      )
      documentRpc.listDocuments.mockResolvedValue({
        data: [baselineDocument, referenceDocument],
        total: 2,
        page: 1,
        page_size: 100,
      })
      documentRpc.updateBaselineDocument.mockResolvedValue({
        data: {
          ...baselineDocument,
          url: "HtTpS://EXAMPLE.com/a/../updated.pdf",
          revision: 6,
        },
      })
      documentRpc.upsertBaselineCitation.mockResolvedValue({
        data: { ...baselineDocument.citations[0], revision: 7 },
      })
      documentRpc.deleteBaselineCitation.mockResolvedValue({
        data: { id: "baseline-citation", revision: 8 },
      })
      documentRpc.deleteBaselineDocument.mockResolvedValue({
        data: { id: baselineDocument.id, revision: 9, affected_link_count: 1 },
      })
      documentRpc.updateReferenceDocument.mockResolvedValue({
        data: { ...referenceDocument, revision: 10 },
      })
      documentRpc.upsertReferenceCitation.mockResolvedValue({
        data: {
          id: "reference-citation",
          criterion_id: "criterion-1",
          page_section: null,
          excerpt: "Đáp ứng yêu cầu",
          revision: 11,
        },
      })
      documentRpc.deleteReferenceCitation.mockResolvedValue({
        data: { id: "reference-citation", revision: 12 },
      })
      documentRpc.deleteReferenceDocument.mockResolvedValue({
        data: { id: referenceDocument.id, revision: 13, affected_link_count: 0 },
      })
      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useTechnicalConfigurationDocuments({ baselineVersion }), {
        wrapper: createReactQueryWrapper(queryClient),
      })
      await waitFor(() => expect(result.current.documentsQuery.isSuccess).toBe(true))

      const rawUpdatedUrl = "HtTpS://EXAMPLE.com/a/../updated.pdf"
      await act(async () => {
        await result.current.updateDocument({
          document: baselineDocument,
          name: "Tài liệu cập nhật",
          url: rawUpdatedUrl,
        })
        await result.current.upsertCitation({
          document: baselineDocument,
          criterionId: "criterion-1",
          pageSection: "Mục 3",
          excerpt: "Trích đoạn mới",
        })
        await result.current.deleteCitation({
          document: baselineDocument,
          citationId: "baseline-citation",
        })
        await expect(result.current.deleteDocument(baselineDocument)).resolves.toBe(1)
        await result.current.updateDocument({
          document: referenceDocument,
          name: referenceDocument.name,
          url: referenceDocument.url,
        })
        await result.current.upsertCitation({
          document: referenceDocument,
          criterionId: "criterion-1",
          pageSection: null,
          excerpt: "Đáp ứng yêu cầu",
        })
        await result.current.deleteCitation({
          document: referenceDocument,
          citationId: "reference-citation",
        })
        await expect(result.current.deleteDocument(referenceDocument)).resolves.toBe(0)
      })

      expect(documentRpc.updateBaselineDocument).toHaveBeenCalledWith({
        p_baseline_document_id: baselineDocument.id,
        p_name: "Tài liệu cập nhật",
        p_url: rawUpdatedUrl,
        p_expected_revision: 5,
      })
      expect(documentRpc.upsertBaselineCitation).toHaveBeenCalledWith({
        p_baseline_document_id: baselineDocument.id,
        p_criterion_id: "criterion-1",
        p_page_section: "Mục 3",
        p_excerpt: "Trích đoạn mới",
        p_expected_revision: 6,
      })
      expect(documentRpc.deleteBaselineCitation).toHaveBeenCalledWith({
        p_baseline_citation_id: "baseline-citation",
        p_expected_revision: 7,
      })
      expect(documentRpc.deleteBaselineDocument).toHaveBeenCalledWith({
        p_baseline_document_id: baselineDocument.id,
        p_expected_revision: 8,
      })
      expect(documentRpc.updateReferenceDocument).toHaveBeenCalledWith({
        p_reference_document_id: referenceDocument.id,
        p_name: referenceDocument.name,
        p_url: referenceDocument.url,
        p_expected_revision: 9,
      })
      expect(documentRpc.upsertReferenceCitation).toHaveBeenCalledWith({
        p_reference_document_id: referenceDocument.id,
        p_criterion_id: "criterion-1",
        p_page_section: null,
        p_excerpt: "Đáp ứng yêu cầu",
        p_expected_revision: 10,
      })
      expect(documentRpc.deleteReferenceCitation).toHaveBeenCalledWith({
        p_reference_citation_id: "reference-citation",
        p_expected_revision: 11,
      })
      expect(documentRpc.deleteReferenceDocument).toHaveBeenCalledWith({
        p_reference_document_id: referenceDocument.id,
        p_expected_revision: 12,
      })
    })

    it("rejects locked mutations before any document RPC runs", async () => {
      const lockedVersion = {
        ...baselineVersion,
        status: "locked" as const,
        locked_at: "2026-07-18T01:00:00.000Z",
        locked_by: 1,
      }
      const baselineDocument = evidenceDocument("baseline-document", "baseline", baselineVersion.id)
      documentRpc.listDocuments.mockResolvedValue({
        data: [baselineDocument],
        total: 1,
        page: 1,
        page_size: 100,
      })
      const queryClient = createTestQueryClient()
      const { result } = renderHook(
        () => useTechnicalConfigurationDocuments({ baselineVersion: lockedVersion }),
        { wrapper: createReactQueryWrapper(queryClient) }
      )
      await waitFor(() => expect(result.current.documentsQuery.isSuccess).toBe(true))

      await expect(result.current.deleteDocument(baselineDocument)).rejects.toThrow(
        "locked_version"
      )
      expect(documentRpc.deleteBaselineDocument).not.toHaveBeenCalled()
      expect(documentRpc.deleteReferenceDocument).not.toHaveBeenCalled()
    })
  })
}
