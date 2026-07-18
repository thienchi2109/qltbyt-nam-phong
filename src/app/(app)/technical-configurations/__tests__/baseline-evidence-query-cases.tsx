import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationDocuments } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDocuments"
import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import {
  baselineVersion,
  evidenceDocument,
  type DocumentRpcMocks,
} from "./baseline-evidence-fixtures"

export function registerBaselineEvidenceQueryTests(documentRpc: DocumentRpcMocks) {
  describe("useTechnicalConfigurationDocuments query and create", () => {
    beforeEach(() => {
      Object.values(documentRpc).forEach((mock) => mock.mockReset())
    })

    it("loads the aggregate once and routes documents by exact owner", async () => {
      const baselineDocument = evidenceDocument("baseline-document", "baseline", baselineVersion.id)
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
      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useTechnicalConfigurationDocuments({ baselineVersion }), {
        wrapper: createReactQueryWrapper(queryClient),
      })

      await waitFor(() => expect(result.current.documentsQuery.isSuccess).toBe(true))

      expect(documentRpc.listDocuments).toHaveBeenCalledWith(
        {
          p_baseline_version_id: baselineVersion.id,
          p_page: 1,
          p_page_size: 100,
        },
        expect.any(AbortSignal)
      )
      expect(result.current.getDocumentsForOwner("baseline", baselineVersion.id)).toEqual([
        baselineDocument,
      ])
      expect(
        result.current.getDocumentsForOwner("reference_product", "reference-product-1")
      ).toEqual([referenceDocument])
    })

    it("routes baseline and reference creates with exact raw URLs and sequential revisions", async () => {
      const onRevisionChange = vi.fn()
      const onNavigationBlockedChange = vi.fn()
      const rawBaselineUrl = "HtTpS://EXAMPLE.com/a/../baseline.pdf"
      const rawReferenceUrl = "https://example.com/reference.pdf"
      documentRpc.listDocuments.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        page_size: 100,
      })
      documentRpc.createBaselineDocument.mockResolvedValue({
        data: {
          ...evidenceDocument("baseline-document", "baseline", baselineVersion.id),
          url: rawBaselineUrl,
          revision: 6,
        },
      })
      documentRpc.createReferenceDocument.mockResolvedValue({
        data: {
          ...evidenceDocument("reference-document", "reference_product", "reference-product-1"),
          url: rawReferenceUrl,
          revision: 7,
        },
      })
      const queryClient = createTestQueryClient()
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
      const { result } = renderHook(
        () =>
          useTechnicalConfigurationDocuments({
            baselineVersion,
            onRevisionChange,
            onNavigationBlockedChange,
          }),
        { wrapper: createReactQueryWrapper(queryClient) }
      )
      await waitFor(() => expect(result.current.documentsQuery.isSuccess).toBe(true))

      await act(async () => {
        await result.current.createDocument({
          ownerType: "baseline",
          ownerId: baselineVersion.id,
          name: "Hồ sơ cơ sở",
          url: rawBaselineUrl,
        })
        await result.current.createDocument({
          ownerType: "reference_product",
          ownerId: "reference-product-1",
          name: "Hồ sơ tham chiếu",
          url: rawReferenceUrl,
        })
      })

      expect(documentRpc.createBaselineDocument).toHaveBeenCalledWith({
        p_baseline_version_id: baselineVersion.id,
        p_name: "Hồ sơ cơ sở",
        p_url: rawBaselineUrl,
        p_expected_revision: 5,
      })
      expect(documentRpc.createReferenceDocument).toHaveBeenCalledWith({
        p_reference_product_id: "reference-product-1",
        p_name: "Hồ sơ tham chiếu",
        p_url: rawReferenceUrl,
        p_expected_revision: 6,
      })
      expect(onRevisionChange).toHaveBeenNthCalledWith(1, 6)
      expect(onRevisionChange).toHaveBeenNthCalledWith(2, 7)
      expect(onNavigationBlockedChange.mock.calls.flat()).toEqual([true, false, true, false])
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["technical-configurations", "documents", baselineVersion.id],
        exact: true,
      })
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["technical-configurations", "baseline-versions", baselineVersion.dossier_id],
        exact: true,
      })
    })

    it("marks stale conflicts while keeping the failed input under caller control", async () => {
      documentRpc.listDocuments.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        page_size: 100,
      })
      documentRpc.createBaselineDocument.mockRejectedValue(
        new TechnicalConfigurationRpcError(409, { message: "stale_revision" })
      )
      const rawUrl = "HtTpS://EXAMPLE.com/a/../retry.pdf"
      const input = {
        ownerType: "baseline" as const,
        ownerId: baselineVersion.id,
        name: "Giữ nguyên khi xung đột",
        url: rawUrl,
      }
      const queryClient = createTestQueryClient()
      const { result } = renderHook(() => useTechnicalConfigurationDocuments({ baselineVersion }), {
        wrapper: createReactQueryWrapper(queryClient),
      })
      await waitFor(() => expect(result.current.documentsQuery.isSuccess).toBe(true))

      await act(async () => {
        await expect(result.current.createDocument(input)).rejects.toThrow("stale_revision")
      })

      expect(result.current.isConflict).toBe(true)
      expect(result.current.mutationError).toMatchObject({ message: "stale_revision" })
      expect(input).toEqual({
        ownerType: "baseline",
        ownerId: baselineVersion.id,
        name: "Giữ nguyên khi xung đột",
        url: rawUrl,
      })
    })
  })
}
