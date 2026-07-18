import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { callTechnicalConfigurationRpc } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import {
  DOCUMENT_RPC_ARG_INTERFACES,
  getInterfaceFields,
} from "@/app/api/rpc/__tests__/technical-configuration-baseline-documents-test-support"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/app/(app)/technical-configurations/technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: vi.fn(),
}))

const callRpcMock = vi.mocked(callTechnicalConfigurationRpc)
const DOCUMENT_TYPES_PATH = path.resolve(
  process.cwd(),
  "src/app/(app)/technical-configurations/document-types.ts"
)
type AsyncRpc = (...args: unknown[]) => Promise<unknown>

function importDocumentRpcManifest() {
  return vi.importActual("@/lib/technical-configuration-document-rpcs") as Promise<{
    DOCUMENT_RPC_FUNCTIONS: Record<string, string>
  }>
}

function importDocumentRpcAdapter() {
  return vi.importActual(
    "@/app/(app)/technical-configurations/technical-configuration-document-rpc"
  ) as Promise<Record<string, AsyncRpc>>
}

describe("technical configuration document RPC adapter", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
    callRpcMock.mockResolvedValue({ data: [] })
  })

  it("exports all eleven exact document RPC argument interfaces", () => {
    const source = existsSync(DOCUMENT_TYPES_PATH) ? readFileSync(DOCUMENT_TYPES_PATH, "utf8") : ""

    for (const [interfaceName, fields] of Object.entries(DOCUMENT_RPC_ARG_INTERFACES)) {
      expect(getInterfaceFields(source, interfaceName)).toEqual(fields)
    }
  })

  it("passes paginated list arguments and abort signal through the unchanged shared helper", async () => {
    const [{ DOCUMENT_RPC_FUNCTIONS }, { listTechnicalConfigurationBaselineDocuments }] =
      await Promise.all([importDocumentRpcManifest(), importDocumentRpcAdapter()])
    const controller = new AbortController()
    const args = {
      p_baseline_version_id: "version-1",
      p_page: 2,
      p_page_size: 25,
    }

    await listTechnicalConfigurationBaselineDocuments(args, controller.signal)

    expect(callRpcMock).toHaveBeenCalledWith(DOCUMENT_RPC_FUNCTIONS.listBaselineDocuments, args, {
      signal: controller.signal,
    })
  })

  it("routes all ten mutations through their ordered P7B1 RPC names without remapping args", async () => {
    const [
      { DOCUMENT_RPC_FUNCTIONS },
      {
        createTechnicalConfigurationBaselineDocument,
        createTechnicalConfigurationReferenceDocument,
        deleteTechnicalConfigurationBaselineCitation,
        deleteTechnicalConfigurationBaselineDocument,
        deleteTechnicalConfigurationReferenceCitation,
        deleteTechnicalConfigurationReferenceDocument,
        updateTechnicalConfigurationBaselineDocument,
        updateTechnicalConfigurationReferenceDocument,
        upsertTechnicalConfigurationBaselineCitation,
        upsertTechnicalConfigurationReferenceCitation,
      },
    ] = await Promise.all([importDocumentRpcManifest(), importDocumentRpcAdapter()])
    const baselineCreateArgs = {
      p_baseline_version_id: "version-1",
      p_name: "Baseline guide",
      p_url: "HtTpS://EXAMPLE.com/a/../baseline.pdf",
      p_expected_revision: 1,
    }
    const baselineUpdateArgs = {
      p_baseline_document_id: "baseline-document-1",
      p_name: "Baseline guide updated",
      p_url: "https://example.com/baseline-v2.pdf",
      p_expected_revision: 2,
    }
    const baselineDeleteArgs = {
      p_baseline_document_id: "baseline-document-1",
      p_expected_revision: 3,
    }
    const baselineCitationUpsertArgs = {
      p_baseline_document_id: "baseline-document-1",
      p_criterion_id: "criterion-1",
      p_page_section: null,
      p_excerpt: "Nguon dien 220V",
      p_expected_revision: 4,
    }
    const baselineCitationDeleteArgs = {
      p_baseline_citation_id: "baseline-citation-1",
      p_expected_revision: 5,
    }
    const referenceCreateArgs = {
      p_reference_product_id: "reference-product-1",
      p_name: "Reference guide",
      p_url: "https://example.com/reference.pdf",
      p_expected_revision: 6,
    }
    const referenceUpdateArgs = {
      p_reference_document_id: "reference-document-1",
      p_name: "Reference guide updated",
      p_url: "https://example.com/reference-v2.pdf",
      p_expected_revision: 7,
    }
    const referenceDeleteArgs = {
      p_reference_document_id: "reference-document-1",
      p_expected_revision: 8,
    }
    const referenceCitationUpsertArgs = {
      p_reference_document_id: "reference-document-1",
      p_criterion_id: "criterion-1",
      p_page_section: "section 4",
      p_excerpt: null,
      p_expected_revision: 9,
    }
    const referenceCitationDeleteArgs = {
      p_reference_citation_id: "reference-citation-1",
      p_expected_revision: 10,
    }

    await createTechnicalConfigurationBaselineDocument(baselineCreateArgs)
    await updateTechnicalConfigurationBaselineDocument(baselineUpdateArgs)
    await deleteTechnicalConfigurationBaselineDocument(baselineDeleteArgs)
    await upsertTechnicalConfigurationBaselineCitation(baselineCitationUpsertArgs)
    await deleteTechnicalConfigurationBaselineCitation(baselineCitationDeleteArgs)
    await createTechnicalConfigurationReferenceDocument(referenceCreateArgs)
    await updateTechnicalConfigurationReferenceDocument(referenceUpdateArgs)
    await deleteTechnicalConfigurationReferenceDocument(referenceDeleteArgs)
    await upsertTechnicalConfigurationReferenceCitation(referenceCitationUpsertArgs)
    await deleteTechnicalConfigurationReferenceCitation(referenceCitationDeleteArgs)

    expect(callRpcMock.mock.calls).toEqual([
      [DOCUMENT_RPC_FUNCTIONS.createBaselineDocument, baselineCreateArgs, { signal: undefined }],
      [DOCUMENT_RPC_FUNCTIONS.updateBaselineDocument, baselineUpdateArgs, { signal: undefined }],
      [DOCUMENT_RPC_FUNCTIONS.deleteBaselineDocument, baselineDeleteArgs, { signal: undefined }],
      [
        DOCUMENT_RPC_FUNCTIONS.upsertBaselineCitation,
        baselineCitationUpsertArgs,
        { signal: undefined },
      ],
      [
        DOCUMENT_RPC_FUNCTIONS.deleteBaselineCitation,
        baselineCitationDeleteArgs,
        { signal: undefined },
      ],
      [DOCUMENT_RPC_FUNCTIONS.createReferenceDocument, referenceCreateArgs, { signal: undefined }],
      [DOCUMENT_RPC_FUNCTIONS.updateReferenceDocument, referenceUpdateArgs, { signal: undefined }],
      [DOCUMENT_RPC_FUNCTIONS.deleteReferenceDocument, referenceDeleteArgs, { signal: undefined }],
      [
        DOCUMENT_RPC_FUNCTIONS.upsertReferenceCitation,
        referenceCitationUpsertArgs,
        { signal: undefined },
      ],
      [
        DOCUMENT_RPC_FUNCTIONS.deleteReferenceCitation,
        referenceCitationDeleteArgs,
        { signal: undefined },
      ],
    ])
  })

  it("returns the paginated discriminated document wire shape unchanged", async () => {
    const { listTechnicalConfigurationBaselineDocuments } = await importDocumentRpcAdapter()
    const expectedResponse = {
      data: [
        {
          id: "baseline-document-1",
          owner_type: "baseline",
          owner_id: "version-1",
          name: "Baseline guide",
          url: "HtTpS://EXAMPLE.com/a/../baseline.pdf",
          created_by: 1,
          created_at: "2026-07-18T00:00:00.000Z",
          updated_at: "2026-07-18T00:00:00.000Z",
          citations: [
            {
              id: "baseline-citation-1",
              criterion_id: "criterion-1",
              page_section: "p. 2",
              excerpt: "Nguon dien 220V",
            },
          ],
        },
        {
          id: "reference-document-1",
          owner_type: "reference_product",
          owner_id: "reference-product-1",
          name: "Reference guide",
          url: "https://example.com/reference.pdf",
          created_by: 1,
          created_at: "2026-07-18T00:00:00.000Z",
          updated_at: "2026-07-18T00:00:00.000Z",
          citations: [],
        },
      ],
      total: 2,
      page: 2,
      page_size: 25,
    }
    callRpcMock.mockResolvedValueOnce(expectedResponse)

    const result = await listTechnicalConfigurationBaselineDocuments({
      p_baseline_version_id: "version-1",
      p_page: 2,
      p_page_size: 25,
    })

    expect(result).toEqual(expectedResponse)
  })

  it("returns document, citation, and delete mutation wire data unchanged", async () => {
    const {
      createTechnicalConfigurationBaselineDocument,
      deleteTechnicalConfigurationBaselineCitation,
      deleteTechnicalConfigurationBaselineDocument,
      upsertTechnicalConfigurationBaselineCitation,
    } = await importDocumentRpcAdapter()
    const documentMutation = {
      data: {
        id: "baseline-document-1",
        owner_type: "baseline",
        owner_id: "version-1",
        name: "Baseline guide",
        url: "HtTpS://EXAMPLE.com/a/../baseline.pdf",
        created_by: 1,
        created_at: "2026-07-18T00:00:00.000Z",
        updated_at: "2026-07-18T00:00:00.000Z",
        citations: [],
        revision: 2,
      },
    }
    const citationMutation = {
      data: {
        id: "baseline-citation-1",
        criterion_id: "criterion-1",
        page_section: "p. 2",
        excerpt: "Nguon dien 220V",
        revision: 3,
      },
    }
    const documentDelete = {
      data: {
        id: "baseline-document-1",
        revision: 4,
        affected_link_count: 1,
      },
    }
    const citationDelete = {
      data: {
        id: "baseline-citation-1",
        revision: 5,
      },
    }
    callRpcMock
      .mockResolvedValueOnce(documentMutation)
      .mockResolvedValueOnce(citationMutation)
      .mockResolvedValueOnce(documentDelete)
      .mockResolvedValueOnce(citationDelete)

    const documentResult = await createTechnicalConfigurationBaselineDocument({
      p_baseline_version_id: "version-1",
      p_name: "Baseline guide",
      p_url: "HtTpS://EXAMPLE.com/a/../baseline.pdf",
      p_expected_revision: 1,
    })
    const citationResult = await upsertTechnicalConfigurationBaselineCitation({
      p_baseline_document_id: "baseline-document-1",
      p_criterion_id: "criterion-1",
      p_page_section: "p. 2",
      p_excerpt: "Nguon dien 220V",
      p_expected_revision: 2,
    })
    const documentDeleteResult = await deleteTechnicalConfigurationBaselineDocument({
      p_baseline_document_id: "baseline-document-1",
      p_expected_revision: 3,
    })
    const citationDeleteResult = await deleteTechnicalConfigurationBaselineCitation({
      p_baseline_citation_id: "baseline-citation-1",
      p_expected_revision: 4,
    })

    expect(documentResult).toEqual(documentMutation)
    expect(citationResult).toEqual(citationMutation)
    expect(documentDeleteResult).toEqual(documentDelete)
    expect(citationDeleteResult).toEqual(citationDelete)
  })
})
